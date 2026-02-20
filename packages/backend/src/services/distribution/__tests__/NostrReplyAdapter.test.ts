/**
 * Tests for NOSTR Reply Adapter
 * EPIC-009B: kind:1 events with NIP-10 threading
 * Regression test for silent void return bug in UnifiedInboxService.reply()
 */

// Mock nostr-tools to avoid actual network calls
vi.mock('nostr-tools/pure', () => ({
  finalizeEvent: vi.fn().mockImplementation((template, _key) => ({
    ...template,
    id: 'mock-event-id-abc123',
    pubkey: 'mock-pubkey',
    sig: 'mock-sig',
  })),
}));

vi.mock('nostr-tools/pool', () => {
  return {
    SimplePool: vi.fn().mockImplementation(() => ({
      publish: vi.fn().mockResolvedValue(undefined),
    })),
  };
});

vi.mock('@noble/hashes/utils', () => ({
  hexToBytes: vi.fn().mockReturnValue(new Uint8Array(32)),
}));

// Mock the crypto module for private key decryption
vi.mock('../crypto', () => ({
  decryptToken: vi.fn().mockReturnValue('decrypted-private-key-hex'),
  getEncryptionKey: vi.fn().mockReturnValue(Buffer.alloc(32)),
}));

import { NostrReplyAdapter } from '../NostrReplyAdapter';
import { finalizeEvent } from 'nostr-tools/pure';

describe('NostrReplyAdapter', () => {
  let adapter: NostrReplyAdapter;
  let mockDb: any;
  let mockLogger: any;

  const creatorId = 'creator-pubkey-xyz';
  const originalEventId = 'original-event-id-456';
  const content = 'Hello from Sovren!';

  beforeEach(() => {
    vi.clearAllMocks();

    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };

    const singleCreatorKey = vi.fn().mockResolvedValue({
      data: {
        nostr_private_key_encrypted: 'deadbeef',
        nostr_private_key_iv: null, // plaintext mode for tests
        nostr_private_key_auth_tag: null,
        nostr_pubkey: 'author-pubkey',
      },
      error: null,
    });

    const singleOriginalMessage = vi.fn().mockResolvedValue({
      data: {
        platform_message_id: originalEventId,
        author: 'original-author-pubkey',
      },
    });

    let callCount = 0;
    mockDb = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockImplementation(() => {
        callCount++;
        return callCount === 1 ? singleCreatorKey() : singleOriginalMessage();
      }),
      maybeSingle: singleOriginalMessage,
    };

    adapter = new NostrReplyAdapter(mockDb, mockLogger);
  });

  describe('reply', () => {
    it('should return an eventId (not void) — regression test for silent void bug', async () => {
      const result = await adapter.reply(creatorId, originalEventId, content);

      // This was the EPIC-009B P1 bug: UnifiedInboxService.reply() returned void for NOSTR
      // NostrReplyAdapter must return { eventId } to confirm the event was published
      expect(result).toBeDefined();
      expect(result.eventId).toBe('mock-event-id-abc123');
    });

    it('should create a kind:1 event', async () => {
      await adapter.reply(creatorId, originalEventId, content);

      expect(finalizeEvent).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 1, content }),
        expect.any(Uint8Array)
      );
    });

    it('should include NIP-10 threading tags with root and reply markers', async () => {
      await adapter.reply(creatorId, originalEventId, content);

      const callArgs = (finalizeEvent as any).mock.calls[0][0];
      const tags: string[][] = callArgs.tags;

      // NIP-10: ["e", <event-id>, "", "root"]
      expect(tags).toContainEqual(['e', originalEventId, '', 'root']);

      // NIP-10: ["e", <event-id>, "", "reply"]
      expect(tags).toContainEqual(['e', originalEventId, '', 'reply']);
    });

    it('should include a "p" tag for the original author pubkey', async () => {
      await adapter.reply(creatorId, originalEventId, content);

      const callArgs = (finalizeEvent as any).mock.calls[0][0];
      const tags: string[][] = callArgs.tags;

      expect(tags).toContainEqual(['p', 'original-author-pubkey']);
    });

    it('should set created_at as unix timestamp', async () => {
      const before = Math.floor(Date.now() / 1000);
      await adapter.reply(creatorId, originalEventId, content);
      const after = Math.floor(Date.now() / 1000);

      const callArgs = (finalizeEvent as any).mock.calls[0][0];
      expect(callArgs.created_at).toBeGreaterThanOrEqual(before);
      expect(callArgs.created_at).toBeLessThanOrEqual(after);
    });

    it('should log the published event', async () => {
      await adapter.reply(creatorId, originalEventId, content);

      expect(mockLogger.info).toHaveBeenCalledWith(
        '[NostrReplyAdapter] Reply event published',
        expect.objectContaining({
          creatorId,
          originalEventId,
          replyEventId: 'mock-event-id-abc123',
        })
      );
    });

    it('should throw when private key is not found', async () => {
      mockDb.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Not found' },
      });

      await expect(adapter.reply(creatorId, originalEventId, content)).rejects.toThrow(
        /NOSTR private key not found/
      );
    });

    it('should handle missing author pubkey gracefully (no "p" tag)', async () => {
      // Reconfigure mockDb to return null for original author
      const singleKeyCall = vi.fn().mockResolvedValue({
        data: {
          nostr_private_key_encrypted: 'deadbeef',
          nostr_private_key_iv: null,
          nostr_private_key_auth_tag: null,
          nostr_pubkey: 'author-pubkey',
        },
        error: null,
      });

      mockDb.single = vi.fn().mockResolvedValue(singleKeyCall());
      mockDb.maybeSingle = vi.fn().mockResolvedValue({ data: null });

      await adapter.reply(creatorId, originalEventId, content);

      const callArgs = (finalizeEvent as any).mock.calls[0][0];
      const pTags = callArgs.tags.filter((t: string[]) => t[0] === 'p');
      expect(pTags).toHaveLength(0);
    });
  });
});
