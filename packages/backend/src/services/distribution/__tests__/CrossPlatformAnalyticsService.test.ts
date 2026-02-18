/**
 * Tests for Cross-Platform Analytics Service
 * EPIC-009: Aggregate metrics across connected platforms
 */

import { CrossPlatformAnalyticsService } from '../CrossPlatformAnalyticsService';

describe('CrossPlatformAnalyticsService', () => {
  let service: CrossPlatformAnalyticsService;
  let mockDb: any;
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

    mockPlatformService = {
      getAdapter: jest.fn(),
      getDecryptedToken: jest.fn().mockResolvedValue('decrypted-token'),
      getStatus: jest.fn(),
    };

    mockDb = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      order: jest.fn(),
      upsert: jest.fn().mockResolvedValue({ error: null }),
    };

    service = new CrossPlatformAnalyticsService(mockDb, mockPlatformService, mockLogger);
  });

  describe('getOverview', () => {
    it('should aggregate metrics across platforms', async () => {
      const metricsData = [
        {
          platform: 'mastodon',
          followers: 1000,
          engagement_rate: '3.5',
          impressions_30d: 50000,
          recorded_at: '2026-02-16',
        },
        {
          platform: 'bluesky',
          followers: 500,
          engagement_rate: '5.0',
          impressions_30d: 25000,
          recorded_at: '2026-02-16',
        },
      ];

      // First call: latest metrics
      mockDb.order.mockResolvedValueOnce({ data: metricsData, error: null });
      // Second call: old metrics (30 days ago)
      mockDb.order.mockResolvedValueOnce({
        data: [
          { platform: 'mastodon', followers: 800 },
          { platform: 'bluesky', followers: 400 },
        ],
        error: null,
      });

      const result = await service.getOverview(creatorId);

      expect(result.total_followers).toBe(1500);
      expect(result.total_engagement_30d).toBe(75000);
      expect(result.platforms).toHaveLength(2);
      expect(result.updated_at).toBeDefined();

      const mastodon = result.platforms.find((p) => p.platform === 'mastodon');
      expect(mastodon?.followers).toBe(1000);
      expect(mastodon?.engagement_rate).toBe(3.5);
      // Growth: (1000-800)/800 * 100 = 25%
      expect(mastodon?.growth_30d).toBe(25);
    });

    it('should handle zero followers in old metrics (no growth)', async () => {
      mockDb.order.mockResolvedValueOnce({
        data: [{ platform: 'twitter', followers: 100, engagement_rate: '2.0', impressions_30d: 5000, recorded_at: '2026-02-16' }],
        error: null,
      });
      mockDb.order.mockResolvedValueOnce({
        data: [{ platform: 'twitter', followers: 0 }],
        error: null,
      });

      const result = await service.getOverview(creatorId);

      const twitter = result.platforms.find((p) => p.platform === 'twitter');
      expect(twitter?.growth_30d).toBe(0);
    });

    it('should handle no metrics data', async () => {
      mockDb.order.mockResolvedValueOnce({ data: [], error: null });
      mockDb.order.mockResolvedValueOnce({ data: [], error: null });

      const result = await service.getOverview(creatorId);

      expect(result.total_followers).toBe(0);
      expect(result.total_engagement_30d).toBe(0);
      expect(result.platforms).toHaveLength(0);
    });

    it('should throw on database error', async () => {
      mockDb.order.mockResolvedValueOnce({ data: null, error: new Error('DB error') });

      await expect(service.getOverview(creatorId)).rejects.toThrow('DB error');
    });
  });

  describe('getContentComparison', () => {
    it('should return comparison data for published cross-posts', async () => {
      const crossPosts = [
        {
          platform: 'mastodon',
          platform_post_id: 'masto-123',
          published_at: '2026-02-16T12:00:00Z',
          metrics_json: { views: 1000, likes: 50, shares: 10, comments: 5, engagement_rate: 6.5 },
        },
        {
          platform: 'bluesky',
          platform_post_id: 'bsky-456',
          published_at: '2026-02-16T12:05:00Z',
          metrics_json: { views: 500, likes: 30, shares: 5, comments: 2, engagement_rate: 7.4 },
        },
      ];

      // getContentComparison uses eq chaining without order, so mock at eq level
      mockDb.eq.mockReturnValue({ data: crossPosts, error: null });

      const result = await service.getContentComparison(creatorId, contentId);

      expect(result).toHaveLength(2);
      expect(result[0].platform).toBe('mastodon');
      expect(result[0].views).toBe(1000);
      expect(result[0].likes).toBe(50);
      expect(result[1].platform).toBe('bluesky');
      expect(result[1].engagement_rate).toBe(7.4);
    });

    it('should handle null metrics_json', async () => {
      mockDb.eq.mockReturnValue({
        data: [{
          platform: 'twitter',
          platform_post_id: null,
          published_at: '2026-02-16T12:00:00Z',
          metrics_json: null,
        }],
        error: null,
      });

      const result = await service.getContentComparison(creatorId, contentId);

      expect(result[0].views).toBe(0);
      expect(result[0].likes).toBe(0);
      expect(result[0].platform_post_id).toBe('');
    });

    it('should throw on database error', async () => {
      mockDb.eq.mockReturnValue({ data: null, error: new Error('DB error') });

      await expect(service.getContentComparison(creatorId, contentId)).rejects.toThrow();
    });
  });

  describe('getROI', () => {
    it('should calculate ROI and rank platforms by engagement per hour', async () => {
      // Latest metrics
      mockDb.order.mockResolvedValueOnce({
        data: [
          { platform: 'mastodon', impressions_30d: 10000, engagement_rate: '3.0' },
          { platform: 'bluesky', impressions_30d: 5000, engagement_rate: '5.0' },
        ],
        error: null,
      });

      // Cross post counts
      mockDb.gte.mockResolvedValueOnce({
        data: [
          { platform: 'mastodon' },
          { platform: 'mastodon' },
          { platform: 'mastodon' },
          { platform: 'mastodon' },
          { platform: 'bluesky' },
        ],
        error: null,
      });

      const result = await service.getROI(creatorId);

      expect(result).toHaveLength(2);
      // Mastodon: 4 posts * 0.5h = 2h, 10000/2 = 5000 engagement/hr
      // Bluesky: 1 post * 0.5h = 0.5h, 5000/0.5 = 10000 engagement/hr
      // Bluesky should rank 1 (higher engagement per hour)
      expect(result[0].platform).toBe('bluesky');
      expect(result[0].rank).toBe(1);
      expect(result[0].engagement_per_hour).toBe(10000);

      expect(result[1].platform).toBe('mastodon');
      expect(result[1].rank).toBe(2);
      expect(result[1].engagement_per_hour).toBe(5000);
    });

    it('should handle platforms with no cross posts', async () => {
      mockDb.order.mockResolvedValueOnce({
        data: [{ platform: 'mastodon', impressions_30d: 1000, engagement_rate: '2.0' }],
        error: null,
      });
      mockDb.gte.mockResolvedValueOnce({ data: [], error: null });

      const result = await service.getROI(creatorId);

      // No cross posts => postCount defaults to 1, estimatedHours = 0.5
      expect(result[0].estimated_hours_30d).toBe(0.5);
      expect(result[0].engagement_per_hour).toBe(2000); // 1000/0.5
    });

    it('should return empty array when no metrics exist', async () => {
      mockDb.order.mockResolvedValueOnce({ data: [], error: null });
      mockDb.gte.mockResolvedValueOnce({ data: [], error: null });

      const result = await service.getROI(creatorId);
      expect(result).toHaveLength(0);
    });
  });

});
