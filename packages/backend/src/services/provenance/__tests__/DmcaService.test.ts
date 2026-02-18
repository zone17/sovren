/**
 * DmcaService Unit Tests
 * Tests DMCA report generation with provenance data
 * EPIC-008: Content Shield (US-E8-004c)
 */

import { DmcaService } from '../DmcaService';

function createMockDb() {
  const chain: any = {};
  const methods = ['select', 'eq', 'single', 'from'];
  for (const method of methods) {
    chain[method] = jest.fn().mockReturnValue(chain);
  }
  return { from: jest.fn().mockReturnValue(chain), _chain: chain };
}

const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

describe('DmcaService', () => {
  let service: DmcaService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    service = new DmcaService(mockDb as any, mockLogger);
    jest.clearAllMocks();
  });

  describe('generateReport', () => {
    const mockAlert = {
      id: 'alert-1',
      creator_id: 'creator-pubkey-abc',
      original_content_id: 'content-1',
      original_title: 'My Original Article',
      detected_copy_url: 'nostr:nevent1abc123',
      detected_author_pubkey: 'copier-pubkey-xyz',
      similarity_score: '0.9200',
      match_level: 'derivative',
      hash_type: 'simhash',
      status: 'reviewed',
      detected_at: '2026-02-15T08:00:00Z',
      relay: 'wss://relay.example.com',
    };

    const mockProvenance = {
      content_id: 'content-1',
      creator_id: 'creator-pubkey-abc',
      signature: 'nostr-sig-hex-12345',
      nostr_event_id: 'nevent-original-id',
      content_hash: 'sha256-content-hash',
      relay_confirmations: [
        { relay: 'wss://relay1.example.com', confirmed_at: '2026-02-14T10:00:00Z' },
        { relay: 'wss://relay2.example.com', confirmed_at: '2026-02-14T10:01:00Z' },
      ],
      created_at: '2026-02-14T10:00:00Z',
    };

    it('should generate a complete DMCA report', async () => {
      // First call: get alert
      mockDb._chain.single
        .mockReturnValueOnce({ data: mockAlert, error: null })
        // Second call: get provenance
        .mockReturnValueOnce({ data: mockProvenance, error: null });

      const report = await service.generateReport('creator-pubkey-abc', 'alert-1');

      expect(report.title).toBe('DMCA Takedown Report');
      expect(report.generated_at).toBeTruthy();
      expect(report.claimant.pubkey).toBe('creator-pubkey-abc');

      // Original content proof
      expect(report.original_content.content_id).toBe('content-1');
      expect(report.original_content.provenance_signature).toBe('nostr-sig-hex-12345');
      expect(report.original_content.nostr_event_id).toBe('nevent-original-id');
      expect(report.original_content.content_hash).toBe('sha256-content-hash');
      expect(report.original_content.relay_confirmations).toHaveLength(2);

      // Infringing content evidence
      expect(report.infringing_content.url).toBe('nostr:nevent1abc123');
      expect(report.infringing_content.author_pubkey).toBe('copier-pubkey-xyz');
      expect(report.infringing_content.similarity_score).toBe(0.92);
      expect(report.infringing_content.match_level).toBe('derivative');

      expect(report.verification_url).toContain('content-1');
    });

    it('should throw NotFoundError when alert does not exist', async () => {
      mockDb._chain.single.mockReturnValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      });

      await expect(
        service.generateReport('creator-pubkey-abc', 'nonexistent')
      ).rejects.toThrow(/Alert/);
    });

    it('should throw NotFoundError when alert belongs to another creator', async () => {
      mockDb._chain.single.mockReturnValueOnce({
        data: null,
        error: { code: 'PGRST116', message: 'not found' },
      });

      await expect(
        service.generateReport('other-creator', 'alert-1')
      ).rejects.toThrow(/Alert/);
    });

    it('should throw NotFoundError when provenance record is missing', async () => {
      mockDb._chain.single
        .mockReturnValueOnce({ data: mockAlert, error: null })
        .mockReturnValueOnce({ data: null, error: { code: 'PGRST116' } });

      await expect(
        service.generateReport('creator-pubkey-abc', 'alert-1')
      ).rejects.toThrow(/Provenance record/);
    });

    it('should handle null relay_confirmations in provenance', async () => {
      const provenanceNoRelays = { ...mockProvenance, relay_confirmations: null };

      mockDb._chain.single
        .mockReturnValueOnce({ data: mockAlert, error: null })
        .mockReturnValueOnce({ data: provenanceNoRelays, error: null });

      const report = await service.generateReport('creator-pubkey-abc', 'alert-1');

      expect(report.original_content.relay_confirmations).toEqual([]);
    });

    it('should log report generation', async () => {
      mockDb._chain.single
        .mockReturnValueOnce({ data: mockAlert, error: null })
        .mockReturnValueOnce({ data: mockProvenance, error: null });

      await service.generateReport('creator-pubkey-abc', 'alert-1');

      expect(mockLogger.info).toHaveBeenCalledWith(
        'DMCA report generated',
        { alertId: 'alert-1', creatorId: 'creator-pubkey-abc' }
      );
    });
  });
});
