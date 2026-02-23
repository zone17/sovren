/**
 * Tests for Cross-Post Service
 * EPIC-009: Cross-platform publishing queue
 */

import { CrossPostService } from '../CrossPostService';
import { createMockChain } from '../../../test-utils/supabase-mock';
import { createQueueServiceMock } from '../../../test-utils/queue-mock';
import type { IQueueService } from '../../../interfaces/queue/IQueueService';
import type { ILogger } from '../../../interfaces/shared/ILogger';
import type { ISupabaseClient } from '../../../interfaces/shared/ISupabaseClient';
import type { IPlatformConnectionService } from '../../../interfaces/distribution/IPlatformConnectionService';

describe('CrossPostService', () => {
  let service: CrossPostService;
  let mockDb: Partial<ISupabaseClient>;
  let mockQueueService: IQueueService;
  let mockPlatformService: Partial<IPlatformConnectionService>;
  let mockLogger: Partial<ILogger>;

  // `any` is intentional: createMockChain returns Vitest mock objects whose chained
  // methods (.mockReturnValue, .mockResolvedValue) conflict with SupabaseFilterBuilder types.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let contentChain: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let crossPostsChain: any;

  const creatorId = 'creator-pubkey-123';
  const contentId = '550e8400-e29b-41d4-a716-446655440000';

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };

    mockQueueService = createQueueServiceMock();

    mockPlatformService = {
      getAdapter: vi.fn(),
      getDecryptedToken: vi.fn(),
    };

    // Content table chain: .from('content').select().eq().single()
    contentChain = createMockChain({ id: contentId, creator_id: creatorId });

    // Cross-posts table chain: .from('cross_posts').insert().select() / .update().eq()...
    crossPostsChain = createMockChain();

    mockDb = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'content') return contentChain;
        return crossPostsChain;
      }),
    };

    service = new CrossPostService(
      mockDb as ISupabaseClient,
      mockQueueService,
      mockPlatformService as IPlatformConnectionService,
      mockLogger as ILogger
    );
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
    beforeEach(() => {
      // Make the cross_posts insert().select() chain resolve with inserted row data.
      // The service calls: db.from('cross_posts').insert(rows).select('...')
      // Since insert returns the chain and select returns the chain, we make the
      // chain awaitable by overriding select to resolve with data for the insert path.
      crossPostsChain.insert.mockImplementation((rows: any[]) => {
        const insertedRows = rows.map((r: any) => ({
          id: r.id,
          platform: r.platform,
          status: r.status,
          scheduled_at: r.scheduled_at,
        }));
        const insertChain = {
          select: vi.fn().mockResolvedValue({ data: insertedRows, error: null }),
        };
        return insertChain;
      });
    });

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

      // Single batch insert call (not one per platform)
      expect(crossPostsChain.insert).toHaveBeenCalledTimes(1);
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
      crossPostsChain.insert.mockImplementation(() => ({
        select: vi.fn().mockResolvedValue({ data: null, error: new Error('DB error') }),
      }));

      await expect(
        service.publish(creatorId, { content_id: contentId, platforms: ['mastodon'] })
      ).rejects.toThrow();
    });

    it('should throw when content not found', async () => {
      contentChain.single.mockResolvedValue({ data: null, error: { code: 'PGRST116' } });

      await expect(
        service.publish(creatorId, { content_id: 'nonexistent', platforms: ['mastodon'] })
      ).rejects.toThrow('Content not found');
    });

    it('should throw when caller does not own the content', async () => {
      contentChain.single.mockResolvedValue({
        data: { id: contentId, creator_id: 'other-creator' },
        error: null,
      });

      await expect(
        service.publish(creatorId, { content_id: contentId, platforms: ['mastodon'] })
      ).rejects.toThrow('Not authorized to cross-post this content');
    });

    it('should mark un-enqueued rows as failed when enqueue fails mid-loop', async () => {
      // Arrange: 3 platforms; addJob succeeds for the first, fails on the second
      const platforms = ['mastodon', 'bluesky', 'nostr'] as const;
      const insertedRows = platforms.map((platform, i) => ({
        id: `cp-id-${i}`,
        platform,
        status: 'queued',
        scheduled_at: null,
      }));

      crossPostsChain.insert.mockImplementation(() => ({
        select: vi.fn().mockResolvedValue({ data: insertedRows, error: null }),
      }));

      // addJob resolves for index 0, rejects for index 1 (and never reaches index 2)
      (mockQueueService.addJob as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce('job-1')
        .mockRejectedValueOnce(new Error('Redis connection lost'));

      // Mock the compensating update so we can assert on it
      const updateChain = {
        in: vi.fn().mockResolvedValue({ error: null }),
      };
      crossPostsChain.update.mockReturnValue(updateChain);

      // Act
      await expect(
        service.publish(creatorId, { content_id: contentId, platforms: [...platforms] })
      ).rejects.toThrow('Redis connection lost');

      // Assert: addJob was called twice (succeeded once, failed once; third never reached)
      expect(mockQueueService.addJob).toHaveBeenCalledTimes(2);

      // Assert: error logged before compensating
      expect(mockLogger.error).toHaveBeenCalledWith(
        '[CrossPostService] Enqueue failed mid-loop; compensating',
        expect.objectContaining({ enqueuedCount: 1, totalCount: 3 })
      );

      // Assert: compensating update targets only the un-enqueued rows (bluesky + nostr)
      expect(crossPostsChain.update).toHaveBeenCalledWith({
        status: 'failed',
        error_message: 'Queue enqueue failed',
        updated_at: expect.any(String),
      });
      expect(updateChain.in).toHaveBeenCalledWith('id', ['cp-id-1', 'cp-id-2']);
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

      crossPostsChain.order.mockResolvedValue({ data: mockData, error: null });

      const results = await service.getStatus(creatorId, contentId);

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('published');
    });
  });

  describe('cancel', () => {
    it('should cancel a queued cross-post', async () => {
      crossPostsChain.in.mockResolvedValue({ error: null });

      await service.cancel(creatorId, 'cp-1');

      expect(mockDb.from).toHaveBeenCalledWith('cross_posts');
      expect(mockLogger.info).toHaveBeenCalledWith(
        '[CrossPostService] Cross-post cancelled',
        expect.objectContaining({ creatorId, crossPostId: 'cp-1' })
      );
    });
  });
});
