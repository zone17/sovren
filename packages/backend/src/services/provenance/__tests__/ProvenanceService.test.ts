/**
 * ProvenanceService Unit Tests
 * Tests content signing, chain retrieval, certificate export, and revocation
 * EPIC-008: Content Shield (US-E8-002, US-E8-007)
 */

import { ProvenanceService } from '../ProvenanceService';

function createMockDb() {
  const chain: any = {};
  const methods = ['select', 'eq', 'single', 'upsert', 'update', 'from'];
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
        relay_confirmations: [{ relay: 'wss://relay.example.com', confirmed_at: '2026-02-15T10:01:00Z' }],
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
      expect(result!.nip05_verified).toBe(true);
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

    it('should throw NotFoundError when creator does not own the content', async () => {
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
        /Provenance record/
      );
    });
  });

  describe('signContent', () => {
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

      const result = await service.signContent({
        contentId: 'content-1',
        creatorId: 'pubkey-abc',
        contentBody: 'Hello, this is my original article content.',
        nostrEventId: 'nevent-id-123',
        signature: 'nostr-sig-hex',
        relays: ['wss://relay.example.com'],
      });

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

    it('should compute SHA-256 hash of content body', async () => {
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

      await service.signContent({
        contentId: 'content-1',
        creatorId: 'pubkey-abc',
        contentBody: 'Test content',
        nostrEventId: 'event-id',
        signature: 'sig',
        relays: [],
      });

      // Verify upsert was called with content_hash
      expect(mockDb._chain.upsert).toHaveBeenCalled();
      const upsertCall = mockDb._chain.upsert.mock.calls[0];
      expect(upsertCall[0].content_hash).toMatch(/^[0-9a-f]{64}$/); // SHA-256 hex
    });

    it('should throw on database error', async () => {
      mockDb._chain.single.mockReturnValue({
        data: null,
        error: { message: 'Unique constraint violated' },
      });

      await expect(
        service.signContent({
          contentId: 'content-1',
          creatorId: 'pubkey-abc',
          contentBody: 'content',
          nostrEventId: 'event',
          signature: 'sig',
          relays: [],
        })
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

      const result = await service.signContent({
        contentId: 'content-1',
        creatorId: 'pubkey-abc',
        contentBody: 'content',
        nostrEventId: 'event-id',
        signature: 'sig',
        relays: ['wss://relay1.example.com', 'wss://relay2.example.com'],
      });

      expect(result.relay_confirmations).toHaveLength(2);
    });
  });

  describe('revokeProvenance', () => {
    it('should revoke a provenance record owned by creator', async () => {
      // First call: getProvenanceChain → returns the record
      mockDb._chain.single
        .mockReturnValueOnce({
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

      // Second call: update → succeeds
      mockDb._chain.eq.mockReturnValue(mockDb._chain);
      mockDb._chain.update = vi.fn().mockReturnValue(mockDb._chain);
      // Make the update's eq chain return no error
      const updateChain: any = {};
      updateChain.eq = vi.fn().mockReturnValue(updateChain);
      mockDb._chain.update.mockReturnValue(updateChain);
      updateChain.eq.mockReturnValue({ error: null });

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

    it('should throw NotFoundError when creator does not own the record', async () => {
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
        /Provenance record/
      );
    });
  });
});
