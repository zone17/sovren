/**
 * Tests for Cross-Post Service
 * EPIC-009: Cross-platform publishing queue
 */

import { CrossPostService } from '../CrossPostService';

describe('CrossPostService', () => {
  let service: CrossPostService;
  let mockDb: any;
  let mockQueueService: any;
  let mockPlatformService: any;
  let mockLogger: any;

  const creatorId = 'creator-pubkey-123';
  const contentId = '550e8400-e29b-41d4-a716-446655440000';

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    mockQueueService = {
      createQueue: jest.fn(),
      addJob: jest.fn().mockResolvedValue('job-123'),
    };

    mockPlatformService = {
      getAdapter: jest.fn(),
      getDecryptedToken: jest.fn(),
    };

    mockDb = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      insert: jest.fn().mockResolvedValue({ error: null }),
      update: jest.fn().mockReturnThis(),
      order: jest.fn(),
    };

    service = new CrossPostService(mockDb, mockQueueService, mockPlatformService, mockLogger);
  });

  describe('constructor', () => {
    it('should create the cross-publish queue', () => {
      expect(mockQueueService.createQueue).toHaveBeenCalledWith(
        'cross-publish',
        expect.objectContaining({
          defaultJobOptions: expect.objectContaining({
            attempts: 3,
          }),
        })
      );
    });
  });

  describe('publish', () => {
    it('should create cross-post entries and queue jobs for each platform', async () => {
      const request = {
        content_id: contentId,
        platforms: ['mastodon' as const, 'bluesky' as const],
      };

      const result = await service.publish(creatorId, request);

      expect(result.platforms).toHaveLength(2);
      expect(result.platforms[0].platform).toBe('mastodon');
      expect(result.platforms[0].status).toBe('queued');
      expect(result.platforms[1].platform).toBe('bluesky');

      expect(mockDb.insert).toHaveBeenCalledTimes(2);
      expect(mockQueueService.addJob).toHaveBeenCalledTimes(2);
    });

    it('should set scheduled status when schedule provided', async () => {
      const scheduleTime = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      const request = {
        content_id: contentId,
        platforms: ['mastodon' as const],
        schedule: { mastodon: scheduleTime },
      };

      const result = await service.publish(creatorId, request);

      expect(result.platforms[0].status).toBe('scheduled');
      expect(result.platforms[0].scheduled_at).toBe(scheduleTime);
    });

    it('should add delay to BullMQ job for scheduled posts', async () => {
      const futureTime = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      const request = {
        content_id: contentId,
        platforms: ['mastodon' as const],
        schedule: { mastodon: futureTime },
      };

      await service.publish(creatorId, request);

      expect(mockQueueService.addJob).toHaveBeenCalledWith(
        'cross-publish',
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({
          delay: expect.any(Number),
        })
      );
    });

    it('should throw on database error', async () => {
      mockDb.insert.mockResolvedValue({ error: new Error('DB error') });

      await expect(
        service.publish(creatorId, { content_id: contentId, platforms: ['mastodon'] })
      ).rejects.toThrow();
    });
  });

  describe('getStatus', () => {
    it('should return cross-post entries for content', async () => {
      const mockData = [
        {
          id: 'cp-1',
          content_id: contentId,
          platform: 'mastodon',
          status: 'published',
          platform_post_id: 'masto-123',
          platform_url: 'https://mastodon.social/@user/masto-123',
          scheduled_at: null,
          published_at: '2026-02-16T12:00:00Z',
          error_message: null,
        },
      ];

      mockDb.order.mockResolvedValue({ data: mockData, error: null });

      const results = await service.getStatus(creatorId, contentId);

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('published');
    });
  });

  describe('cancel', () => {
    it('should cancel a queued cross-post', async () => {
      mockDb.in.mockResolvedValue({ error: null });

      await service.cancel(creatorId, 'cp-1');

      expect(mockDb.from).toHaveBeenCalledWith('cross_posts');
      expect(mockLogger.info).toHaveBeenCalledWith(
        '[CrossPostService] Cross-post cancelled',
        expect.objectContaining({ creatorId, crossPostId: 'cp-1' })
      );
    });
  });
});
