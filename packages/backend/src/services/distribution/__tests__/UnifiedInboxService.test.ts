/**
 * Tests for Unified Inbox Service
 * EPIC-009: Multi-platform message aggregation
 */

import { UnifiedInboxService } from '../UnifiedInboxService';

describe('UnifiedInboxService', () => {
  let service: UnifiedInboxService;
  let mockDb: any;
  let mockPlatformService: any;
  let mockLogger: any;

  const creatorId = 'creator-pubkey-123';

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };

    mockPlatformService = {
      getAdapter: vi.fn(),
      getDecryptedToken: vi.fn().mockResolvedValue('decrypted-token'),
      getStatus: vi.fn(),
    };

    mockDb = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      single: vi.fn(),
      update: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockResolvedValue({ error: null }),
      order: vi.fn().mockReturnThis(),
      range: vi.fn(),
      limit: vi.fn().mockReturnThis(),
    };

    service = new UnifiedInboxService(mockDb, mockPlatformService, mockLogger);
  });

  describe('getMessages', () => {
    const baseQuery = {
      platform: 'all' as const,
      status: 'all' as const,
      page: 1,
      limit: 20,
    };

    it('should return paginated messages', async () => {
      const mockData = [
        {
          id: 'msg-1',
          platform: 'mastodon',
          author: '@user@mastodon.social',
          author_avatar_url: null,
          content: 'Hello!',
          type: 'mention',
          parent_post_id: null,
          is_read: false,
          platform_created_at: '2026-02-16T12:00:00Z',
        },
      ];

      mockDb.range.mockResolvedValue({ data: mockData, error: null, count: 1 });

      const result = await service.getMessages(creatorId, baseQuery);

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].platform).toBe('mastodon');
      expect(result.pagination.total).toBe(1);
      expect(result.pagination.totalPages).toBe(1);
      expect(result.pagination.hasNext).toBe(false);
      expect(result.pagination.hasPrev).toBe(false);
    });

    it('should filter by platform when not "all"', async () => {
      mockDb.range.mockResolvedValue({ data: [], error: null, count: 0 });

      await service.getMessages(creatorId, { ...baseQuery, platform: 'mastodon' });

      // The eq method is called multiple times; we verify the platform filter was applied
      expect(mockDb.eq).toHaveBeenCalledWith('platform', 'mastodon');
    });

    it('should filter unread messages when status is "unread"', async () => {
      mockDb.range.mockResolvedValue({ data: [], error: null, count: 0 });

      await service.getMessages(creatorId, { ...baseQuery, status: 'unread' });

      expect(mockDb.eq).toHaveBeenCalledWith('is_read', false);
    });

    it('should calculate pagination correctly', async () => {
      mockDb.range.mockResolvedValue({ data: [], error: null, count: 45 });

      const result = await service.getMessages(creatorId, { ...baseQuery, page: 2 });

      expect(result.pagination.totalPages).toBe(3); // ceil(45/20)
      expect(result.pagination.hasNext).toBe(true);
      expect(result.pagination.hasPrev).toBe(true);
    });

    it('should throw on database error', async () => {
      mockDb.range.mockResolvedValue({ data: null, error: new Error('DB error'), count: 0 });

      await expect(service.getMessages(creatorId, baseQuery)).rejects.toThrow();
    });
  });

  describe('reply', () => {
    it('should route reply to the correct platform adapter', async () => {
      const mockSendReply = vi.fn().mockResolvedValue(undefined);
      mockDb.single.mockResolvedValue({
        data: { platform: 'mastodon', platform_message_id: 'masto-msg-123' },
        error: null,
      });
      mockPlatformService.getAdapter.mockReturnValue({ sendReply: mockSendReply });

      await service.reply(creatorId, 'msg-1', 'Thanks!');

      expect(mockPlatformService.getAdapter).toHaveBeenCalledWith('mastodon');
      expect(mockSendReply).toHaveBeenCalledWith(
        expect.objectContaining({ access_token: 'decrypted-token' }),
        'masto-msg-123',
        'Thanks!'
      );
    });

    it('should delegate NOSTR replies to NostrService', async () => {
      mockDb.single.mockResolvedValue({
        data: { platform: 'nostr', platform_message_id: 'nostr-msg-123' },
        error: null,
      });

      await service.reply(creatorId, 'msg-1', 'Reply text');

      expect(mockPlatformService.getAdapter).not.toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        '[UnifiedInboxService] NOSTR reply delegated to NostrService',
        expect.objectContaining({ messageId: 'msg-1' })
      );
    });

    it('should throw when message not found', async () => {
      mockDb.single.mockResolvedValue({ data: null, error: { message: 'Not found' } });

      await expect(service.reply(creatorId, 'nonexistent', 'Hello')).rejects.toThrow(
        'Message not found or access denied'
      );
    });

    it('should log reply success', async () => {
      mockDb.single.mockResolvedValue({
        data: { platform: 'bluesky', platform_message_id: 'bsky-msg' },
        error: null,
      });
      mockPlatformService.getAdapter.mockReturnValue({
        sendReply: vi.fn().mockResolvedValue(undefined),
      });

      await service.reply(creatorId, 'msg-1', 'Thanks!');

      expect(mockLogger.info).toHaveBeenCalledWith(
        '[UnifiedInboxService] Reply sent',
        expect.objectContaining({ creatorId, messageId: 'msg-1', platform: 'bluesky' })
      );
    });
  });

  describe('batchAction', () => {
    it('should mark messages as read', async () => {
      mockDb.in.mockResolvedValue({ error: null, count: 3 });

      const count = await service.batchAction(creatorId, ['msg-1', 'msg-2', 'msg-3'], 'mark_read');

      expect(count).toBe(3);
      expect(mockDb.update).toHaveBeenCalledWith({ is_read: true });
    });

    it('should mark messages as unread', async () => {
      mockDb.in.mockResolvedValue({ error: null, count: 2 });

      const count = await service.batchAction(creatorId, ['msg-1', 'msg-2'], 'mark_unread');

      expect(count).toBe(2);
      expect(mockDb.update).toHaveBeenCalledWith({ is_read: false });
    });

    it('should archive messages', async () => {
      mockDb.in.mockResolvedValue({ error: null, count: 1 });

      const count = await service.batchAction(creatorId, ['msg-1'], 'archive');

      expect(count).toBe(1);
      expect(mockDb.update).toHaveBeenCalledWith({ is_archived: true });
    });

    it('should throw on database error', async () => {
      mockDb.in.mockResolvedValue({ error: new Error('DB error'), count: 0 });

      await expect(
        service.batchAction(creatorId, ['msg-1'], 'mark_read')
      ).rejects.toThrow();
    });

    it('should return 0 when count is null', async () => {
      mockDb.in.mockResolvedValue({ error: null, count: null });

      const count = await service.batchAction(creatorId, ['msg-1'], 'mark_read');
      expect(count).toBe(0);
    });
  });

});
