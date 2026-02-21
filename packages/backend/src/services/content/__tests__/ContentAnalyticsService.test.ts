/**
 * ContentAnalyticsService Unit Tests
 * Epic 005 - US-E5-016
 * Target: 95%+ code coverage
 */

import { ContentAnalyticsService } from '../ContentAnalyticsService';
import { Logger } from 'winston';
import {
  MetricType,
  AggregationDimension,
  AnalyticsQuery,
  EngagementMetrics,
} from '../../../types/analytics';

// Mock dependencies
const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
} as unknown as Logger;

interface MockCacheService {
  get: any;
  set: any;
  delete: any;
  exists: any;
  clear: any;
}

interface MockMetricsService {
  incrementCounter: any;
  recordHistogram: any;
  recordGauge: any;
}

const mockCache = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
  exists: vi.fn(),
  clear: vi.fn(),
} as MockCacheService;

const mockMetrics = {
  incrementCounter: vi.fn(),
  recordHistogram: vi.fn(),
  recordGauge: vi.fn(),
} as MockMetricsService;

describe('ContentAnalyticsService', () => {
  let service: ContentAnalyticsService;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    service = new ContentAnalyticsService(
      mockLogger,
      mockCache as any,
      mockMetrics as any
    );
  });

  afterEach(async () => {
    await service.shutdown();
    vi.useRealTimers();
  });

  // ============================================================================
  // Track Engagement Tests
  // ============================================================================

  describe('trackEngagement', () => {
    it('should track engagement event successfully', async () => {
      // Arrange
      const contentId = 'content-123';
      const userId = 'user-456';
      const eventType = MetricType.VIEW;
      const metadata = { duration: 120, sessionId: 'session-789' };

      // Act
      await service.trackEngagement(contentId, userId, eventType, metadata);

      // Assert
      expect(mockMetrics.incrementCounter).toHaveBeenCalledWith(
        'content.engagement.view'
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Engagement tracked',
        expect.objectContaining({
          contentId,
          userId,
          eventType,
        })
      );
    });

    it('should update real-time metrics in cache', async () => {
      // Arrange
      mockCache.get.mockResolvedValue(5); // Existing count

      // Act
      await service.trackEngagement(
        'content-123',
        'user-456',
        MetricType.LIKE
      );

      // Assert
      expect(mockCache.set).toHaveBeenCalledWith(
        expect.stringContaining('realtime:content-123:like'),
        6, // Incremented
        300 // TTL
      );
    });

    it('should emit engagement:tracked event', (done) => {
      // Arrange
      const contentId = 'content-123';
      const userId = 'user-456';

      service.on('engagement:tracked', (metric: EngagementMetrics) => {
        expect(metric.contentId).toBe(contentId);
        expect(metric.userId).toBe(userId);
        done();
      });

      // Act
      service.trackEngagement(contentId, userId, MetricType.VIEW);
    });

    it('should handle tracking errors gracefully', async () => {
      // Arrange
      mockCache.get.mockRejectedValue(new Error('Cache error'));

      // Act
      await service.trackEngagement(
        'content-123',
        'user-456',
        MetricType.VIEW
      );

      // Assert - Should not throw
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to track engagement',
        expect.any(Object)
      );
      expect(mockMetrics.incrementCounter).toHaveBeenCalledWith(
        'analytics.engagement.error'
      );
    });

    it('should track multiple event types', async () => {
      // Arrange & Act
      await service.trackEngagement('content-1', 'user-1', MetricType.VIEW);
      await service.trackEngagement('content-1', 'user-1', MetricType.LIKE);
      await service.trackEngagement('content-1', 'user-1', MetricType.SHARE);

      // Assert
      expect(mockMetrics.incrementCounter).toHaveBeenCalledWith(
        'content.engagement.view'
      );
      expect(mockMetrics.incrementCounter).toHaveBeenCalledWith(
        'content.engagement.like'
      );
      expect(mockMetrics.incrementCounter).toHaveBeenCalledWith(
        'content.engagement.share'
      );
    });
  });

  // ============================================================================
  // Get Analytics Tests
  // ============================================================================

  describe('getAnalytics', () => {
    const baseQuery: AnalyticsQuery = {
      contentIds: ['content-123'],
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-31'),
      metrics: [MetricType.VIEW, MetricType.LIKE],
      dimensions: [AggregationDimension.DAY],
    };

    beforeEach(async () => {
      // Seed some test data
      await service.trackEngagement('content-123', 'user-1', MetricType.VIEW);
      await service.trackEngagement('content-123', 'user-2', MetricType.VIEW);
      await service.trackEngagement('content-123', 'user-1', MetricType.LIKE);
    });

    it('should return analytics result with metrics', async () => {
      // Arrange
      mockCache.get.mockResolvedValue(null); // No cache hit

      // Act
      const result = await service.getAnalytics(baseQuery);

      // Assert
      expect(result).toMatchObject({
        query: baseQuery,
        metrics: expect.any(Object),
        totalEvents: expect.any(Number),
        uniqueUsers: expect.any(Number),
        generatedAt: expect.any(Date),
      });
    });

    it('should return cached results on cache hit', async () => {
      // Arrange
      const cachedResult = {
        query: baseQuery,
        metrics: { views: 100 },
        totalEvents: 100,
        uniqueUsers: 50,
        generatedAt: new Date(),
      };
      mockCache.get.mockResolvedValue(cachedResult);

      // Act
      const result = await service.getAnalytics(baseQuery);

      // Assert
      expect(result).toEqual(cachedResult);
      expect(mockMetrics.incrementCounter).toHaveBeenCalledWith(
        'analytics.cache.hit'
      );
    });

    it('should calculate unique users correctly', async () => {
      // Arrange
      mockCache.get.mockResolvedValue(null);

      // Act
      const result = await service.getAnalytics(baseQuery);

      // Assert
      expect(result.uniqueUsers).toBe(2); // user-1 and user-2
    });

    it('should include time series when requested', async () => {
      // Arrange
      const queryWithTimeSeries: AnalyticsQuery = {
        ...baseQuery,
        includeTimeSeries: true,
        interval: 'hour',
      };
      mockCache.get.mockResolvedValue(null);

      // Act
      const result = await service.getAnalytics(queryWithTimeSeries);

      // Assert
      expect(result.timeSeries).toBeDefined();
      expect(Array.isArray(result.timeSeries)).toBe(true);
    });

    it('should calculate performance indicators', async () => {
      // Arrange
      mockCache.get.mockResolvedValue(null);

      // Act
      const result = await service.getAnalytics(baseQuery);

      // Assert
      expect(result.performance).toBeDefined();
      expect(result.performance).toHaveProperty('engagementRate');
      expect(result.performance).toHaveProperty('viralityScore');
    });

    it('should cache analytics results', async () => {
      // Arrange
      mockCache.get.mockResolvedValue(null);

      // Act
      await service.getAnalytics(baseQuery);

      // Assert
      expect(mockCache.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          metrics: expect.any(Object),
        }),
        300 // 5 minutes TTL
      );
    });

    it('should handle query errors', async () => {
      // Arrange
      mockCache.get.mockRejectedValue(new Error('Query error'));

      // Act & Assert
      await expect(service.getAnalytics(baseQuery)).rejects.toThrow();
      expect(mockMetrics.incrementCounter).toHaveBeenCalledWith(
        'analytics.query.error'
      );
    });
  });

  // ============================================================================
  // Dashboard Metrics Tests
  // ============================================================================

  describe('getDashboardMetrics', () => {
    beforeEach(async () => {
      // Seed test data
      await service.trackEngagement('content-1', 'user-1', MetricType.VIEW, {
        duration: 60,
      });
      await service.trackEngagement('content-1', 'user-2', MetricType.LIKE);
      await service.trackEngagement('content-1', 'user-3', MetricType.SHARE);
    });

    it('should return dashboard with summary metrics', async () => {
      // Arrange
      mockCache.get.mockResolvedValue(null);

      // Act
      const dashboard = await service.getDashboardMetrics();

      // Assert
      expect(dashboard).toHaveProperty('summary');
      expect(dashboard.summary).toHaveProperty('totalViews');
      expect(dashboard.summary).toHaveProperty('totalLikes');
      expect(dashboard.summary).toHaveProperty('engagementRate');
    });

    it('should include daily and weekly metrics', async () => {
      // Arrange
      mockCache.get.mockResolvedValue(null);

      // Act
      const dashboard = await service.getDashboardMetrics();

      // Assert
      expect(dashboard).toHaveProperty('daily');
      expect(dashboard).toHaveProperty('weekly');
    });

    it('should calculate engagement rate', async () => {
      // Arrange
      mockCache.get.mockResolvedValue(null);

      // Act
      const dashboard = await service.getDashboardMetrics();

      // Assert
      expect(dashboard.summary.engagementRate).toBeGreaterThanOrEqual(0);
    });
  });

  // ============================================================================
  // Performance Calculation Tests
  // ============================================================================

  describe('Performance Calculations', () => {
    it('should calculate engagement rate correctly', async () => {
      // Arrange
      await service.trackEngagement('content-1', 'user-1', MetricType.VIEW);
      await service.trackEngagement('content-1', 'user-2', MetricType.VIEW);
      await service.trackEngagement('content-1', 'user-1', MetricType.LIKE);

      mockCache.get.mockResolvedValue(null);
      const query: AnalyticsQuery = {
        contentIds: ['content-1'],
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        metrics: [MetricType.VIEW, MetricType.LIKE],
      };

      // Act
      const result = await service.getAnalytics(query);

      // Assert
      expect(result.performance).toBeDefined();
      expect(result.performance!.engagementRate).toBeGreaterThan(0);
    });

    it('should handle zero views gracefully', async () => {
      // Arrange
      mockCache.get.mockResolvedValue(null);
      const query: AnalyticsQuery = {
        contentIds: ['non-existent'],
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
      };

      // Act
      const result = await service.getAnalytics(query);

      // Assert
      expect(result.performance).toBeDefined();
      expect(result.performance!.engagementRate).toBe(0);
    });
  });

  // ============================================================================
  // Shutdown Tests
  // ============================================================================

  describe('Shutdown', () => {
    it('should flush buffer on shutdown', async () => {
      // Arrange
      await service.trackEngagement('content-1', 'user-1', MetricType.VIEW);

      const flushPromise = new Promise((resolve) => {
        service.on('metrics:flushed', resolve);
      });

      // Act
      await service.shutdown();

      // Assert
      await expect(flushPromise).resolves.toBeDefined();
    });

    it('should remove all event listeners', async () => {
      // Arrange
      const handler = vi.fn();
      service.on('engagement:tracked', handler);

      // Act
      await service.shutdown();
      service.emit('engagement:tracked', {});

      // Assert
      expect(handler).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle empty content IDs array', async () => {
      // Arrange
      mockCache.get.mockResolvedValue(null);
      const query: AnalyticsQuery = {
        contentIds: [],
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
      };

      // Act
      const result = await service.getAnalytics(query);

      // Assert
      expect(result.totalEvents).toBe(0);
      expect(result.uniqueUsers).toBe(0);
    });

    it('should handle concurrent tracking requests', async () => {
      // Act
      const promises = Array(10)
        .fill(null)
        .map((_, i) =>
          service.trackEngagement(`content-${i}`, `user-${i}`, MetricType.VIEW)
        );

      // Assert - Should all complete without errors
      await expect(Promise.all(promises)).resolves.toBeDefined();
    });
  });
});
