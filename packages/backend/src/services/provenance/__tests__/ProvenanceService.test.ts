/**
 * ProvenanceService Unit Tests
 * Tests content signing, chain retrieval, certificate export, and revocation
 * EPIC-008: Content Shield (US-E8-002, US-E8-007)
 */

vi.mock('nostr-tools/pure', () => ({
  getEventHash: vi.fn().mockReturnValue('mocked-event-hash'),
  verifyEvent: vi.fn().mockReturnValue(true),
}));

import { verifyEvent } from 'nostr-tools/pure';
import { ProvenanceService } from '../ProvenanceService';

function createMockDb() {
  const chain: any = {};
  const methods = ['select', 'eq', 'single', 'insert', 'upsert', 'update', 'from'];
  for (const method of methods) {
    chain[method] = vi.fn().mockReturnValue(chain);
  }
  return { from: vi.fn().mockReturnValue(chain), _chain: chain };
}

const mockLogger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
};

describe('ProvenanceService', () => {
  let service: ProvenanceService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    service = new ProvenanceService(mockDb as any, mockLogger);
    vi.clearAllMocks();
    // Reset verifyEvent to return true by default
    vi.mocked(verifyEvent).mockReturnValue(true);
  });

  describe('getProvenanceChain', () => {
    it('should return provenance record when found', async () => {
      const dbRecord = {
        content_id: 'content-1',
        creator_id: 'pubkey-abc',
        created_at: '2026-02-15T10:00:00Z',
        signature: 'sig-hex-123',
        nostr_event_id: 'nevent-id',
        content_hash: 'sha256-hash',
        relay_confirmations: [
          { relay: 'wss://relay.example.com', confirmed_at: '2026-02-15T10:01:00Z' },
        ],
        verification_status: 'verified',
      };

      mockDb._chain.single.mockReturnValue({ data: dbRecord, error: null });

      const result = await service.getProvenanceChain('content-1');

      expect(result).not.toBeNull();
      expect(result!.content_id).toBe('content-1');
      expect(result!.author_pubkey).toBe('pubkey-abc');
      expect(result!.signature).toBe('sig-hex-123');
      expect(result!.relay_confirmations).toHaveLength(1);
      expect(result!.verification_status).toBe('verified');
      expect(result!.nip05_verified).toBe(false);
    });

    it('should return null when not found (PGRST116)', async () => {
      mockDb._chain.single.mockReturnValue({
        data: null,
        error: { code: 'PGRST116' },
      });

      const result = await service.getProvenanceChain('nonexistent');
      expect(result).toBeNull();
    });

    it('should throw on database error', async () => {
      mockDb._chain.single.mockReturnValue({
        data: null,
        error: { code: 'INTERNAL', message: 'DB down' },
      });

      await expect(service.getProvenanceChain('content-1')).rejects.toEqual(
        expect.objectContaining({ code: 'INTERNAL' })
      );
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle null relay_confirmations gracefully', async () => {
      mockDb._chain.single.mockReturnValue({
        data: {
          content_id: 'content-1',
          creator_id: 'pubkey',
          created_at: '2026-02-15T10:00:00Z',
          signature: 'sig',
          nostr_event_id: 'event-id',
          content_hash: 'hash',
          relay_confirmations: null,
          verification_status: 'verified',
        },
        error: null,
      });

      const result = await service.getProvenanceChain('content-1');
      expect(result!.relay_confirmations).toEqual([]);
    });
  });

  describe('getCertificate', () => {
    it('should return certificate for valid content owned by creator', async () => {
      const dbRecord = {
        content_id: 'content-1',
        creator_id: 'pubkey-abc',
        created_at: '2026-02-15T10:00:00Z',
        signature: 'sig-hex-123',
        nostr_event_id: 'nevent-id',
        content_hash: 'sha256-hash',
        relay_confirmations: [],
        verification_status: 'verified',
      };
      mockDb._chain.single.mockReturnValue({ data: dbRecord, error: null });

      const cert = await service.getCertificate('content-1', 'pubkey-abc');

      expect(cert.title).toBe('Content Provenance Certificate');
      expect(cert.content_id).toBe('content-1');
      expect(cert.author.pubkey).toBe('pubkey-abc');
      expect(cert.provenance.signature).toBe('sig-hex-123');
      expect(cert.provenance.nostr_event_id).toBe('nevent-id');
      expect(cert.provenance.content_hash).toBe('sha256-hash');
      expect(cert.verification_url).toContain('content-1');
      expect(cert.generated_at).toBeTruthy();
    });

    it('should throw NotFoundError when no provenance record exists', async () => {
      mockDb._chain.single.mockReturnValue({
        data: null,
        error: { code: 'PGRST116' },
      });

      await expect(service.getCertificate('missing', 'pubkey-abc')).rejects.toThrow(
        /Provenance record/
      );
    });

    // #612: Ownership checks throw AuthorizationError, not NotFoundError
    it('should throw AuthorizationError when creator does not own the content', async () => {
      mockDb._chain.single.mockReturnValue({
        data: {
          content_id: 'content-1',
          creator_id: 'other-creator',
          created_at: '2026-02-15T10:00:00Z',
          signature: 'sig',
          nostr_event_id: 'event',
          content_hash: 'hash',
          relay_confirmations: [],
          verification_status: 'verified',
        },
        error: null,
      });

      await expect(service.getCertificate('content-1', 'pubkey-abc')).rejects.toThrow(
        /Not authorized/
      );
    });
  });

  describe('signContent', () => {
    it('should reject signing when callerId does not match creatorId (ownership check)', async () => {
      await expect(
        service.signContent(
          {
            contentId: 'content-1',
            creatorId: 'pubkey-abc',
            contentBody: 'content',
            nostrEventId: 'event',
            signature: 'sig',
            relays: [],
            eventCreatedAt: 1709500000,
          },
          'different-user'
        )
      ).rejects.toThrow(/Cannot sign provenance for content you do not own/);
    });

    it('should create provenance record and return it', async () => {
      const insertedData = {
        content_id: 'content-1',
        creator_id: 'pubkey-abc',
        created_at: '2026-02-15T10:00:00Z',
        signature: 'nostr-sig-hex',
        nostr_event_id: 'nevent-id-123',
        content_hash: expect.any(String),
        relay_confirmations: [
          { relay: 'wss://relay.example.com', confirmed_at: expect.any(String) },
        ],
        verification_status: 'verified',
      };

      mockDb._chain.single.mockReturnValue({ data: insertedData, error: null });

      const result = await service.signContent(
        {
          contentId: 'content-1',
          creatorId: 'pubkey-abc',
          contentBody: 'Hello, this is my original article content.',
          nostrEventId: 'nevent-id-123',
          signature: 'nostr-sig-hex',
          relays: ['wss://relay.example.com'],
          eventCreatedAt: 1709500000,
        },
        'pubkey-abc'
      );

      expect(result.content_id).toBe('content-1');
      expect(result.author_pubkey).toBe('pubkey-abc');
      expect(result.signature).toBe('nostr-sig-hex');
      expect(result.nostr_event_id).toBe('nevent-id-123');
      expect(result.verification_status).toBe('verified');
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Content signed with provenance',
        expect.objectContaining({ contentId: 'content-1' })
      );
    });

    // #609: Backend uses raw content body (not hash), matching tags, and client timestamp
    it('should reconstruct event with raw content body and client timestamp', async () => {
      mockDb._chain.single.mockReturnValue({
        data: {
          content_id: 'content-1',
          creator_id: 'pubkey-abc',
          created_at: '2026-02-15T10:00:00Z',
          signature: 'sig',
          nostr_event_id: 'event-id',
          content_hash: 'sha256-hash',
          relay_confirmations: [],
          verification_status: 'verified',
        },
        error: null,
      });

      const { getEventHash } = await import('nostr-tools/pure');

      await service.signContent(
        {
          contentId: 'content-1',
          creatorId: 'pubkey-abc',
          contentBody: 'Test content',
          nostrEventId: 'event-id',
          signature: 'sig',
          relays: [],
          eventCreatedAt: 1709500000,
        },
        'pubkey-abc'
      );

      // Verify getEventHash was called with raw content body and matching tags
      expect(getEventHash).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 1,
          pubkey: 'pubkey-abc',
          created_at: 1709500000,
          tags: [['t', 'sovren-content']],
          content: 'Test content', // Raw content, not hash
        })
      );
    });

    it('should compute SHA-256 hash of content body for storage', async () => {
      mockDb._chain.single.mockReturnValue({
        data: {
          content_id: 'content-1',
          creator_id: 'pubkey-abc',
          created_at: '2026-02-15T10:00:00Z',
          signature: 'sig',
          nostr_event_id: 'event-id',
          content_hash: 'sha256-hash',
          relay_confirmations: [],
          verification_status: 'verified',
        },
        error: null,
      });

      await service.signContent(
        {
          contentId: 'content-1',
          creatorId: 'pubkey-abc',
          contentBody: 'Test content',
          nostrEventId: 'event-id',
          signature: 'sig',
          relays: [],
          eventCreatedAt: 1709500000,
        },
        'pubkey-abc'
      );

      // #615: Verify insert (not upsert) was called with content_hash
      expect(mockDb._chain.insert).toHaveBeenCalled();
      const insertCall = mockDb._chain.insert.mock.calls[0];
      expect(insertCall[0].content_hash).toMatch(/^[0-9a-f]{64}$/); // SHA-256 hex
    });

    // #613: Invalid signatures must be rejected, not stored as 'unverified'
    it('should reject invalid NOSTR signatures', async () => {
      vi.mocked(verifyEvent).mockReturnValue(false);

      await expect(
        service.signContent(
          {
            contentId: 'content-1',
            creatorId: 'pubkey-abc',
            contentBody: 'content',
            nostrEventId: 'event',
            signature: 'invalid-sig',
            relays: [],
            eventCreatedAt: 1709500000,
          },
          'pubkey-abc'
        )
      ).rejects.toThrow(/Invalid NOSTR signature/);

      // Should NOT have attempted database insert
      expect(mockDb._chain.insert).not.toHaveBeenCalled();
    });

    // #615: Duplicate content_id returns clear error, not silent overwrite
    it('should reject duplicate content_id with clear error', async () => {
      mockDb._chain.single.mockReturnValue({
        data: null,
        error: { code: '23505', message: 'Unique constraint violated' },
      });

      await expect(
        service.signContent(
          {
            contentId: 'content-1',
            creatorId: 'pubkey-abc',
            contentBody: 'content',
            nostrEventId: 'event',
            signature: 'sig',
            relays: [],
            eventCreatedAt: 1709500000,
          },
          'pubkey-abc'
        )
      ).rejects.toThrow(/Provenance record already exists/);
    });

    it('should throw on database error', async () => {
      mockDb._chain.single.mockReturnValue({
        data: null,
        error: { message: 'DB connection failed' },
      });

      await expect(
        service.signContent(
          {
            contentId: 'content-1',
            creatorId: 'pubkey-abc',
            contentBody: 'content',
            nostrEventId: 'event',
            signature: 'sig',
            relays: [],
            eventCreatedAt: 1709500000,
          },
          'pubkey-abc'
        )
      ).rejects.toBeTruthy();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to sign content',
        expect.objectContaining({ contentId: 'content-1' })
      );
    });

    it('should handle multiple relays', async () => {
      mockDb._chain.single.mockReturnValue({
        data: {
          content_id: 'content-1',
          creator_id: 'pubkey-abc',
          created_at: '2026-02-15T10:00:00Z',
          signature: 'sig',
          nostr_event_id: 'event-id',
          content_hash: 'hash',
          relay_confirmations: [
            { relay: 'wss://relay1.example.com', confirmed_at: '2026-02-15T10:00:00Z' },
            { relay: 'wss://relay2.example.com', confirmed_at: '2026-02-15T10:00:00Z' },
          ],
          verification_status: 'verified',
        },
        error: null,
      });

      const result = await service.signContent(
        {
          contentId: 'content-1',
          creatorId: 'pubkey-abc',
          contentBody: 'content',
          nostrEventId: 'event-id',
          signature: 'sig',
          relays: ['wss://relay1.example.com', 'wss://relay2.example.com'],
          eventCreatedAt: 1709500000,
        },
        'pubkey-abc'
      );

      expect(result.relay_confirmations).toHaveLength(2);
    });
  });

  describe('revokeProvenance', () => {
    it('should revoke a provenance record owned by creator', async () => {
      // First from() call: getProvenanceChain → select().eq().single()
      // Second from() call: update → update().eq().eq()
      const selectChain: any = {};
      selectChain.select = vi.fn().mockReturnValue(selectChain);
      selectChain.eq = vi.fn().mockReturnValue(selectChain);
      selectChain.single = vi.fn().mockReturnValue({
        data: {
          content_id: 'content-1',
          creator_id: 'pubkey-abc',
          created_at: '2026-02-15T10:00:00Z',
          signature: 'sig',
          nostr_event_id: 'event',
          content_hash: 'hash',
          relay_confirmations: [],
          verification_status: 'verified',
        },
        error: null,
      });

      const updateChain: any = {};
      updateChain.update = vi.fn().mockReturnValue(updateChain);
      updateChain.eq = vi.fn().mockReturnValue(updateChain);
      // Final .eq() resolves the promise (the chain is awaited)
      updateChain.eq.mockReturnValueOnce(updateChain).mockReturnValue({ error: null });

      let callCount = 0;
      const localMockDb = {
        from: vi.fn(() => {
          callCount++;
          return callCount === 1 ? selectChain : updateChain;
        }),
      };

      service = new ProvenanceService(localMockDb as any, mockLogger);
      const result = await service.revokeProvenance('content-1', 'pubkey-abc');

      expect(result.content_id).toBe('content-1');
      expect(result.status).toBe('revoked');
      expect(result.revoked_at).toBeTruthy();
    });

    it('should throw NotFoundError when provenance does not exist', async () => {
      mockDb._chain.single.mockReturnValue({
        data: null,
        error: { code: 'PGRST116' },
      });

      await expect(service.revokeProvenance('missing', 'pubkey-abc')).rejects.toThrow(
        /Provenance record/
      );
    });

    // #612: Ownership checks throw AuthorizationError, not NotFoundError
    it('should throw AuthorizationError when creator does not own the record', async () => {
      mockDb._chain.single.mockReturnValue({
        data: {
          content_id: 'content-1',
          creator_id: 'other-creator',
          created_at: '2026-02-15T10:00:00Z',
          signature: 'sig',
          nostr_event_id: 'event',
          content_hash: 'hash',
          relay_confirmations: [],
          verification_status: 'verified',
        },
        error: null,
      });

      await expect(service.revokeProvenance('content-1', 'pubkey-abc')).rejects.toThrow(
        /Not authorized/
      );
    });
  });
});
