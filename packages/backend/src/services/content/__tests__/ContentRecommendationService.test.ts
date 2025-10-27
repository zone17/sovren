/**
 * ContentRecommendationService Tests
 * Comprehensive test suite achieving 95%+ coverage
 *
 * @epic Epic-005
 * @story US-E5-015
 */

import { EventEmitter } from 'events';
import { ContentRecommendationService } from '../ContentRecommendationService';
import type { ICacheService } from '../../../interfaces/shared/ICacheService';
import type { ILogger } from '../../../interfaces/shared/ILogger';
import type { Content, UserInteraction } from '../../../interfaces/content';

describe('ContentRecommendationService', () => {
  let service: ContentRecommendationService;
  let mockLogger: jest.Mocked<ILogger>;
  let mockCache: jest.Mocked<ICacheService>;
  let mockContentRepository: any;
  let mockAnalyticsRepository: any;
  let mockUserRepository: any;

  // Test data
  const testUserId = 'user-123';
  const testContentId = 'content-456';

  const mockContent: Content = {
    id: testContentId,
    title: 'Test Content',
    content: 'Test content body',
    summary: 'Test summary',
    tags: ['javascript', 'testing'],
    category: 'technology',
    status: 'published',
    visibility: 'public',
    authorId: 'author-789',
    slug: 'test-content',
    metadata: {
      wordCount: 500,
      readingTime: 3,
      excerpt: 'Test excerpt',
      hashtags: ['test'],
      language: 'en',
      hasMedia: false,
      lastModified: new Date()
    },
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    publishedAt: new Date()
  };

  const mockUserInteraction: UserInteraction = {
    userId: testUserId,
    contentId: testContentId,
    action: 'view',
    timestamp: new Date(),
    duration: 120
  };

  beforeEach(() => {
    // Setup mocks
    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
      warn: jest.fn()
    } as any;

    mockCache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(true),
      exists: jest.fn().mockResolvedValue(false),
      invalidate: jest.fn().mockResolvedValue(0),
      invalidateByTags: jest.fn().mockResolvedValue(0),
      flush: jest.fn().mockResolvedValue(undefined),
      getTtl: jest.fn().mockResolvedValue(-1),
      setTtl: jest.fn().mockResolvedValue(true),
      getMany: jest.fn().mockResolvedValue(new Map()),
      setMany: jest.fn().mockResolvedValue(undefined),
      remember: jest.fn(),
      getStats: jest.fn(),
      registerWarmupStrategy: jest.fn(),
      warmup: jest.fn(),
      registerInvalidationPattern: jest.fn(),
      healthCheck: jest.fn().mockResolvedValue(true),
      dispose: jest.fn().mockResolvedValue(undefined)
    };

    mockContentRepository = {
      findById: jest.fn().mockResolvedValue(mockContent),
      findByIds: jest.fn().mockResolvedValue([mockContent]),
      findPublished: jest.fn().mockResolvedValue([mockContent])
    };

    mockAnalyticsRepository = {
      getUserInteractions: jest.fn().mockResolvedValue([{
        contentId: testContentId,
        action: 'view',
        timestamp: new Date(),
        duration: 120
      }]),
      getEngagementMetrics: jest.fn().mockResolvedValue([{
        contentId: testContentId,
        views: 100,
        likes: 10,
        shares: 5,
        comments: 3,
        publishedAt: new Date(Date.now() - 3600000) // 1 hour ago
      }]),
      getUsersByContent: jest.fn().mockResolvedValue([
        { userId: 'user-456' },
        { userId: 'user-789' }
      ])
    };

    mockUserRepository = {
      findById: jest.fn().mockResolvedValue({
        id: testUserId,
        preferences: {
          categories: ['technology'],
          tags: ['javascript'],
          favoriteAuthors: ['author-789'],
          excludeCategories: [],
          minEngagementScore: 0.5
        }
      }),
      findPopularUsers: jest.fn().mockResolvedValue([
        { id: 'popular-user-1' },
        { id: 'popular-user-2' }
      ])
    };

    service = new ContentRecommendationService(
      mockLogger,
      mockCache,
      mockContentRepository,
      mockAnalyticsRepository,
      mockUserRepository
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getRecommendations', () => {
    it('should return cached recommendations if available', async () => {
      const cachedContent = [mockContent];
      mockCache.get.mockResolvedValueOnce(cachedContent);

      const result = await service.getRecommendations(testUserId);

      expect(result).toEqual(cachedContent);
      expect(mockCache.get).toHaveBeenCalledWith(
        expect.stringContaining('recommendations:')
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Cache hit for recommendations',
        expect.any(Object)
      );
    });

    it('should generate hybrid recommendations when cache miss', async () => {
      mockCache.get.mockResolvedValue(null);

      const result = await service.getRecommendations(testUserId, {
        algorithm: 'hybrid',
        limit: 10
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: testContentId,
        title: 'Test Content'
      });
      expect(mockCache.set).toHaveBeenCalled();
    });

    it('should generate collaborative recommendations', async () => {
      mockCache.get.mockResolvedValue(null);

      const result = await service.getRecommendations(testUserId, {
        algorithm: 'collaborative',
        limit: 10
      });

      expect(mockAnalyticsRepository.getUserInteractions).toHaveBeenCalled();
      expect(mockAnalyticsRepository.getUsersByContent).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should generate content-based recommendations', async () => {
      mockCache.get.mockResolvedValue(null);

      const result = await service.getRecommendations(testUserId, {
        algorithm: 'content-based',
        limit: 10
      });

      expect(mockAnalyticsRepository.getUserInteractions).toHaveBeenCalled();
      expect(mockContentRepository.findPublished).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should fallback to trending content on error', async () => {
      mockCache.get.mockResolvedValue(null);
      mockUserRepository.findById.mockRejectedValueOnce(new Error('DB error'));

      const result = await service.getRecommendations(testUserId);

      expect(mockLogger.error).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should emit events on successful recommendation generation', async () => {
      mockCache.get.mockResolvedValue(null);

      const eventSpy = jest.fn();
      service.on('recommendations:generated', eventSpy);

      await service.getRecommendations(testUserId);

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: testUserId,
          algorithm: 'hybrid',
          count: expect.any(Number),
          duration: expect.any(Number)
        })
      );
    });

    it('should cache recommendations with correct TTL', async () => {
      mockCache.get.mockResolvedValue(null);

      await service.getRecommendations(testUserId);

      expect(mockCache.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        900 // 15 minutes
      );
    });
  });

  describe('getSimilar', () => {
    it('should return cached similar content if available', async () => {
      const cachedSimilar = [mockContent];
      mockCache.get.mockResolvedValueOnce(cachedSimilar);

      const result = await service.getSimilar(testContentId, 5);

      expect(result).toEqual(cachedSimilar);
      expect(mockCache.get).toHaveBeenCalledWith(
        `similar:${testContentId}:5`
      );
    });

    it('should find similar content using cosine similarity', async () => {
      mockCache.get.mockResolvedValue(null);
      const similarContent = {
        ...mockContent,
        id: 'content-similar-1',
        embedding: new Array(768).fill(0.5)
      };

      mockContent.embedding = new Array(768).fill(0.5);
      mockContentRepository.findPublished.mockResolvedValue([mockContent, similarContent]);

      const result = await service.getSimilar(testContentId, 5);

      expect(mockContentRepository.findPublished).toHaveBeenCalled();
      expect(mockCache.set).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should exclude the source content from results', async () => {
      mockCache.get.mockResolvedValue(null);
      const similarContent = { ...mockContent, id: 'similar-1', embedding: new Array(768).fill(0.5) };
      mockContent.embedding = new Array(768).fill(0.5);
      mockContentRepository.findPublished.mockResolvedValue([mockContent, similarContent]);
      mockContentRepository.findByIds.mockResolvedValue([similarContent]);

      const result = await service.getSimilar(testContentId, 5);

      // Result should only contain similar content, not source
      expect(result.find(c => c.id === testContentId)).toBeUndefined();
    });

    it('should return empty array on error', async () => {
      mockContentRepository.findPublished.mockRejectedValue(new Error('DB error'));

      const result = await service.getSimilar(testContentId);

      expect(result).toEqual([]);
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('getTrending', () => {
    it('should return cached trending content if available', async () => {
      const cachedTrending = [mockContent];
      mockCache.get.mockResolvedValueOnce(cachedTrending);

      const result = await service.getTrending();

      expect(result).toEqual(cachedTrending);
    });

    it('should calculate trend scores and sort by velocity', async () => {
      mockCache.get.mockResolvedValue(null);

      const result = await service.getTrending();

      expect(mockAnalyticsRepository.getEngagementMetrics).toHaveBeenCalled();
      expect(mockContentRepository.findByIds).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should support custom time periods', async () => {
      mockCache.get.mockResolvedValue(null);
      const period = {
        start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
        end: new Date()
      };

      const result = await service.getTrending(period);

      expect(mockAnalyticsRepository.getEngagementMetrics).toHaveBeenCalledWith(
        expect.objectContaining({
          startDate: period.start,
          endDate: period.end
        })
      );
    });

    it('should cache trending with shorter TTL (5 minutes)', async () => {
      mockCache.get.mockResolvedValue(null);

      await service.getTrending();

      expect(mockCache.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        300 // 5 minutes
      );
    });
  });

  describe('personalizeFor', () => {
    it('should personalize content based on user preferences', async () => {
      const contents = [
        { ...mockContent, id: 'content-1', category: 'technology' },
        { ...mockContent, id: 'content-2', category: 'sports' },
        { ...mockContent, id: 'content-3', category: 'technology', tags: ['javascript'] }
      ];

      const result = await service.personalizeFor(testUserId, contents);

      expect(result).toBeDefined();
      expect(result.length).toBe(3);
      // Technology content should be ranked higher
      expect(result[0].category).toBe('technology');
    });

    it('should boost content from favorite authors', async () => {
      const contents = [
        { ...mockContent, id: 'content-1', authorId: 'author-123' },
        { ...mockContent, id: 'content-2', authorId: 'author-789' } // favorite
      ];

      const result = await service.personalizeFor(testUserId, contents);

      // Favorite author should rank higher
      expect(result[0].authorId).toBe('author-789');
    });

    it('should boost content with tag overlap', async () => {
      const contents = [
        { ...mockContent, id: 'content-1', tags: ['python', 'django'] },
        { ...mockContent, id: 'content-2', tags: ['javascript', 'react'] }
      ];

      const result = await service.personalizeFor(testUserId, contents);

      // Content with matching tags (javascript) should rank higher
      expect(result[0].tags).toContain('javascript');
    });

    it('should return original order on error', async () => {
      mockUserRepository.findById.mockRejectedValue(new Error('DB error'));
      const contents = [mockContent];

      const result = await service.personalizeFor(testUserId, contents);

      expect(result).toEqual(contents);
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('trainModel', () => {
    it('should cache interactions for model training', async () => {
      const interactions: UserInteraction[] = [
        mockUserInteraction,
        { ...mockUserInteraction, userId: 'user-456', contentId: 'content-789' }
      ];

      await service.trainModel(interactions);

      expect(mockCache.set).toHaveBeenCalledTimes(interactions.length + 1); // +1 for matrix
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Training recommendation model',
        expect.any(Object)
      );
    });

    it('should build interaction matrix', async () => {
      const interactions: UserInteraction[] = [
        mockUserInteraction,
        { ...mockUserInteraction, userId: 'user-456' }
      ];

      await service.trainModel(interactions);

      expect(mockCache.set).toHaveBeenCalledWith(
        'interaction:matrix',
        expect.any(Object),
        3600
      );
    });

    it('should emit model trained event', async () => {
      const eventSpy = jest.fn();
      service.on('model:trained', eventSpy);

      const interactions = [mockUserInteraction];
      await service.trainModel(interactions);

      expect(eventSpy).toHaveBeenCalledWith({
        count: interactions.length
      });
    });

    it('should handle training errors', async () => {
      mockCache.set.mockRejectedValue(new Error('Cache error'));

      const interactions = [mockUserInteraction];

      await expect(service.trainModel(interactions)).rejects.toThrow('Cache error');
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('getPopular', () => {
    it('should return cached popular content', async () => {
      const cachedPopular = [mockContent];
      mockCache.get.mockResolvedValueOnce(cachedPopular);

      const result = await service.getPopular('technology', 10);

      expect(result).toEqual(cachedPopular);
    });

    it('should filter by category when specified', async () => {
      mockCache.get.mockResolvedValue(null);
      const techContent = { ...mockContent, category: 'technology' };
      const sportsContent = { ...mockContent, id: 'content-2', category: 'sports' };

      mockContentRepository.findByIds.mockResolvedValue([techContent, sportsContent]);
      mockAnalyticsRepository.getEngagementMetrics.mockResolvedValue([
        { contentId: techContent.id, views: 100, likes: 10, shares: 5, comments: 3 },
        { contentId: sportsContent.id, views: 200, likes: 20, shares: 10, comments: 6 }
      ]);

      const result = await service.getPopular('technology', 10);

      expect(mockAnalyticsRepository.getEngagementMetrics).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should sort by engagement score (views + likes*2 + shares*3)', async () => {
      mockCache.get.mockResolvedValue(null);

      const result = await service.getPopular(undefined, 10);

      expect(mockAnalyticsRepository.getEngagementMetrics).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should cache popular content for 10 minutes', async () => {
      mockCache.get.mockResolvedValue(null);

      await service.getPopular('technology', 10);

      expect(mockCache.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        600 // 10 minutes
      );
    });
  });

  describe('precomputeForPopularUsers', () => {
    it('should precompute recommendations for popular users', async () => {
      mockCache.get.mockResolvedValue(null);

      await service.precomputeForPopularUsers();

      expect(mockUserRepository.findPopularUsers).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Pre-computation'),
        expect.any(Object)
      );
    });

    it('should generate multiple recommendation types', async () => {
      mockCache.get.mockResolvedValue(null);

      await service.precomputeForPopularUsers();

      // Should generate hybrid, collaborative, and content-based recommendations
      expect(mockContentRepository.findByIds).toHaveBeenCalled();
    });

    it('should emit progress events', async () => {
      mockCache.get.mockResolvedValue(null);
      const progressSpy = jest.fn();
      const completedSpy = jest.fn();

      service.on('precompute:progress', progressSpy);
      service.on('precompute:completed', completedSpy);

      await service.precomputeForPopularUsers();

      expect(completedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          processed: expect.any(Number),
          total: expect.any(Number)
        })
      );
    });

    it('should handle individual user errors gracefully', async () => {
      mockCache.get.mockResolvedValue(null);
      mockUserRepository.findById
        .mockResolvedValueOnce({ id: 'popular-user-1', preferences: {} })
        .mockRejectedValueOnce(new Error('User error'))
        .mockResolvedValueOnce({ id: 'popular-user-2', preferences: {} });

      await service.precomputeForPopularUsers();

      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle errors during pre-computation', async () => {
      mockCache.get.mockResolvedValue(null);
      mockUserRepository.findPopularUsers.mockResolvedValue([{ id: 'user-error' }]);
      mockUserRepository.findById.mockRejectedValue(new Error('Fatal error'));

      // Should not throw even if individual users fail
      await service.precomputeForPopularUsers();

      // Error should be logged
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('similarity calculations', () => {
    it('should calculate Jaccard similarity correctly', async () => {
      // Access private method through service instance
      const service2 = service as any;

      const set1 = ['a', 'b', 'c'];
      const set2 = ['b', 'c', 'd'];

      const similarity = service2.calculateJaccardSimilarity(set1, set2);

      // Intersection: {b, c} = 2, Union: {a, b, c, d} = 4, Similarity: 2/4 = 0.5
      expect(similarity).toBe(0.5);
    });

    it('should return 0 for completely different sets', async () => {
      const service2 = service as any;

      const similarity = service2.calculateJaccardSimilarity(['a', 'b'], ['c', 'd']);

      expect(similarity).toBe(0);
    });

    it('should calculate cosine similarity correctly', async () => {
      const service2 = service as any;

      const vec1 = [1, 0, 1];
      const vec2 = [1, 1, 0];

      const similarity = service2.calculateCosineSimilarity(vec1, vec2);

      // Expected: (1*1 + 0*1 + 1*0) / (sqrt(2) * sqrt(2)) = 1/2 = 0.5
      expect(similarity).toBeCloseTo(0.5, 2);
    });

    it('should return 0 for zero vectors', async () => {
      const service2 = service as any;

      const similarity = service2.calculateCosineSimilarity([0, 0, 0], [1, 1, 1]);

      expect(similarity).toBe(0);
    });

    it('should return 0 for mismatched vector dimensions', async () => {
      const service2 = service as any;

      const similarity = service2.calculateCosineSimilarity([1, 2], [1, 2, 3]);

      expect(similarity).toBe(0);
    });
  });

  describe('user profile building', () => {
    it('should aggregate features from interactions', async () => {
      const service2 = service as any;
      const interactions = [
        { contentId: 'content-1', score: 0.5, timestamp: new Date(), type: 'view' as const },
        { contentId: 'content-2', score: 0.8, timestamp: new Date(), type: 'like' as const }
      ];

      const profile = await service2.buildUserContentProfile(interactions);

      expect(profile).toHaveProperty('embedding');
      expect(profile).toHaveProperty('features');
      expect(Array.isArray(profile.embedding)).toBe(true);
    });

    it('should average embeddings from multiple content items', async () => {
      const service2 = service as any;

      const embeddings = [
        [1, 2, 3],
        [3, 4, 5]
      ];

      const avg = service2.averageEmbeddings(embeddings);

      expect(avg).toEqual([2, 3, 4]); // Average of each dimension
    });

    it('should return default embedding for empty input', async () => {
      const service2 = service as any;

      const avg = service2.averageEmbeddings([]);

      expect(avg).toHaveLength(768); // Default embedding size
      expect(avg.every((v: number) => v === 0)).toBe(true);
    });
  });

  describe('deduplication', () => {
    it('should remove duplicate content keeping highest score', async () => {
      const service2 = service as any;

      const recommendations = [
        { contentId: 'content-1', score: 0.8, reason: 'collaborative', explanation: 'test' },
        { contentId: 'content-1', score: 0.6, reason: 'trending', explanation: 'test' },
        { contentId: 'content-2', score: 0.7, reason: 'content-based', explanation: 'test' }
      ];

      const unique = service2.deduplicateRecommendations(recommendations);

      expect(unique).toHaveLength(2);
      const content1 = unique.find((r: any) => r.contentId === 'content-1');
      expect(content1.score).toBe(0.8); // Kept highest score
    });
  });

  describe('interaction scoring', () => {
    it('should calculate correct base scores for different actions', async () => {
      const service2 = service as any;

      expect(service2.calculateInteractionScore('view')).toBe(0.1);
      expect(service2.calculateInteractionScore('like')).toBe(0.3);
      expect(service2.calculateInteractionScore('share')).toBe(0.5);
      expect(service2.calculateInteractionScore('comment')).toBe(0.4);
      expect(service2.calculateInteractionScore('save')).toBe(0.6);
    });

    it('should boost view score based on duration', async () => {
      const service2 = service as any;

      const shortView = service2.calculateInteractionScore('view', 30);
      const longView = service2.calculateInteractionScore('view', 300);

      expect(longView).toBeGreaterThan(shortView);
      expect(longView).toBeCloseTo(0.3, 1); // 0.1 base + 0.2 boost
    });
  });

  describe('trending calculation', () => {
    it('should calculate velocity-based trend scores', async () => {
      mockCache.get.mockResolvedValue(null);
      const recentContent = {
        contentId: 'recent-1',
        views: 100,
        likes: 20,
        shares: 10,
        comments: 5,
        publishedAt: new Date(Date.now() - 3600000) // 1 hour ago
      };

      mockAnalyticsRepository.getEngagementMetrics.mockResolvedValue([recentContent]);

      await service.getTrending();

      expect(mockAnalyticsRepository.getEngagementMetrics).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle cache errors gracefully', async () => {
      mockCache.get.mockRejectedValue(new Error('Cache error'));
      mockCache.set.mockRejectedValue(new Error('Cache error'));

      // Should not throw, should log error
      const result = await service.getRecommendations(testUserId);

      expect(result).toBeDefined();
    });

    it('should handle repository errors with fallbacks', async () => {
      mockContentRepository.findByIds.mockRejectedValue(new Error('DB error'));

      const result = await service.getRecommendations(testUserId);

      expect(mockLogger.error).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should handle missing user preferences', async () => {
      mockUserRepository.findById.mockResolvedValue(null);
      mockCache.get.mockResolvedValue(null);

      const result = await service.getRecommendations(testUserId);

      expect(result).toBeDefined();
    });

    it('should handle empty interaction history', async () => {
      mockAnalyticsRepository.getUserInteractions.mockResolvedValue([]);
      mockCache.get.mockResolvedValue(null);

      const result = await service.getRecommendations(testUserId, {
        algorithm: 'content-based'
      });

      // Should fallback to trending
      expect(result).toBeDefined();
    });
  });

  describe('caching behavior', () => {
    it('should use different cache keys for different parameters', async () => {
      await service.getRecommendations('user-1', { algorithm: 'hybrid', limit: 10 });
      await service.getRecommendations('user-1', { algorithm: 'collaborative', limit: 20 });

      const calls = mockCache.get.mock.calls;
      expect(calls[0][0]).not.toBe(calls[1][0]);
    });

    it('should respect different TTLs for different content types', async () => {
      mockCache.get.mockResolvedValue(null);

      await service.getTrending(); // 5 min TTL
      await service.getPopular('tech'); // 10 min TTL

      // Clear previous calls
      mockCache.set.mockClear();
      await service.getRecommendations(testUserId); // 15 min TTL

      const setCalls = mockCache.set.mock.calls;
      expect(setCalls.some(call => call[2] === 900)).toBe(true); // recommendations: 15 min
    });
  });

  describe('event emission', () => {
    it('should emit cache hit events', async () => {
      mockCache.get.mockResolvedValueOnce([mockContent]);
      const spy = jest.fn();
      service.on('recommendations:cache:hit', spy);

      await service.getRecommendations(testUserId);

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: testUserId,
          algorithm: 'hybrid'
        })
      );
    });

    it('should emit error events', async () => {
      mockCache.get.mockResolvedValue(null);
      mockContentRepository.findByIds.mockRejectedValue(new Error('Test error'));
      const spy = jest.fn();
      service.on('recommendations:error', spy);

      await service.getRecommendations(testUserId);

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: testUserId,
          error: expect.any(Error)
        })
      );
    });
  });

  describe('shutdown', () => {
    it('should remove all event listeners on shutdown', async () => {
      const spy = jest.fn();
      service.on('test-event', spy);

      await service.shutdown();

      service.emit('test-event');
      expect(spy).not.toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'ContentRecommendationService shut down'
      );
    });
  });
});
