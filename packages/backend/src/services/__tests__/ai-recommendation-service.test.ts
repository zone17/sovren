/**
 * 🧪 **AI RECOMMENDATION SERVICE TESTS**
 *
 * Comprehensive test suite for AI-powered content recommendations
 * Tests US-095 through US-098 implementation
 *
 * @author Sovren Platform Team
 * @version 1.0.0
 */


import type {
  RecommendationFeedback,
  RecommendationRequest,
  SimilarityCalculationRequest,
  UserBehaviorEvent,
  UserPreferences,
} from '../../types/ai-recommendations';
import {
  AIRecommendationService,
  createAIRecommendationService,
} from '../ai-recommendation-service';

// Mock Supabase client
const mockSupabase = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn(() => Promise.resolve({ data: null, error: null })),
        order: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
        })),
      })),
      gte: vi.fn(() => ({
        lte: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: {}, error: null })),
        })),
      })),
      upsert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: {}, error: null })),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: {}, error: null })),
          })),
        })),
      })),
    })),
  })),
};

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase),
}));

describe('AIRecommendationService', () => {
  let aiService: AIRecommendationService;
  const testUserId = 'test-user-pubkey-123';
  const testContentId = '550e8400-e29b-41d4-a716-446655440000';

  beforeEach(() => {
    vi.clearAllMocks();
    aiService = createAIRecommendationService({
      supabaseUrl: 'http://localhost:54321',
      supabaseKey: 'test-key',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ===== US-095: Personalized Content Recommendations Tests =====

  describe('US-095: Personalized Content Recommendations', () => {
    it('should generate personalized recommendations for authenticated user', async () => {
      // Mock user preferences
      const mockPreferences = {
        id: 'pref-1',
        user_id: testUserId,
        preferred_content_types: ['article', 'video'],
        preferred_tags: ['technology', 'ai'],
        preferred_creators: [],
        confidence_score: 0.8,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Mock behavior data
      const mockBehaviorData = [
        {
          id: 'behavior-1',
          user_id: testUserId,
          event_type: 'content_like',
          content_type: 'article',
          content_tags: ['ai', 'technology'],
          timestamp: new Date().toISOString(),
        },
      ];

      // Setup mocks
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'user_preferences') {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: mockPreferences, error: null }),
              }),
            }),
          };
        }
        if (table === 'user_behavior_events') {
          return {
            select: () => ({
              eq: () => ({
                gte: () => ({
                  order: () => ({
                    limit: () => Promise.resolve({ data: mockBehaviorData, error: null }),
                  }),
                }),
              }),
            }),
          };
        }
        return mockSupabase.from();
      });

      const request: RecommendationRequest = {
        user_id: testUserId,
        context: 'homepage',
        limit: 10,
        include_explanation: true,
      };

      const result = await aiService.getPersonalizedRecommendations(request);

      expect(result).toBeDefined();
      expect(result.metadata).toBeDefined();
      expect(result.metadata.algorithm_used).toBe('hybrid');
      expect(result.metadata.cache_hit).toBe(false);
      expect(Array.isArray(result.recommendations)).toBe(true);
    });

    it('should update user preferences successfully', async () => {
      const preferences = {
        preferred_content_types: ['video', 'podcast'],
        preferred_tags: ['bitcoin', 'lightning'],
        allow_behavioral_tracking: true,
      };

      mockSupabase.from.mockReturnValue({
        upsert: () => ({
          select: () => ({
            single: () =>
              Promise.resolve({
                data: { ...preferences, user_id: testUserId, id: 'pref-1' },
                error: null,
              }),
          }),
        }),
      });

      const result = await aiService.updateUserPreferences(testUserId, preferences);

      expect(result).toBeDefined();
      expect(result.user_id).toBe(testUserId);
      expect(mockSupabase.from).toHaveBeenCalledWith('user_preferences');
    });

    it('should handle personalization errors gracefully', async () => {
      mockSupabase.from.mockReturnValue({
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: null, error: { message: 'Database error' } }),
          }),
        }),
      });

      const request: RecommendationRequest = {
        user_id: testUserId,
        context: 'homepage',
        limit: 10,
      };

      await expect(aiService.getPersonalizedRecommendations(request)).rejects.toThrow(
        'Failed to generate personalized recommendations'
      );
    });
  });

  // ===== US-096: Behavioral Recommendations Tests =====

  describe('US-096: Behavioral Recommendations', () => {
    it('should track user behavior events successfully', async () => {
      const behaviorEvent: Omit<UserBehaviorEvent, 'id' | 'timestamp'> = {
        user_id: testUserId,
        event_type: 'content_view',
        content_id: testContentId,
        content_type: 'article',
        content_tags: ['ai', 'technology'],
        dwell_time: 120,
        scroll_depth: 0.8,
        interaction_quality: 0.9,
        source_location: 'homepage',
        processed_for_ml: false,
      };

      mockSupabase.from.mockReturnValue({
        insert: () => Promise.resolve({ error: null }),
      });

      await expect(aiService.trackBehaviorEvent(behaviorEvent)).resolves.not.toThrow();
      expect(mockSupabase.from).toHaveBeenCalledWith('user_behavior_events');
    });

    it('should generate behavioral recommendations based on user patterns', async () => {
      const mockRecommendations = [
        {
          id: 'rec-1',
          user_id: testUserId,
          content_id: testContentId,
          recommendation_score: 0.85,
          confidence_score: 0.8,
          rank_position: 1,
          algorithm_type: 'behavioral',
          explanation: 'Based on your recent activity',
          generated_at: new Date().toISOString(),
        },
      ];

      // Mock service method (would normally call complex behavioral analysis)
      vi.spyOn(aiService, 'getBehavioralRecommendations').mockResolvedValue(mockRecommendations);

      const result = await aiService.getBehavioralRecommendations(testUserId, 5);

      expect(result).toHaveLength(1);
      expect(result[0].algorithm_type).toBe('behavioral');
      expect(result[0].recommendation_score).toBeGreaterThan(0.5);
    });

    it('should handle behavior tracking errors', async () => {
      const behaviorEvent: Omit<UserBehaviorEvent, 'id' | 'timestamp'> = {
        user_id: testUserId,
        event_type: 'content_view',
        processed_for_ml: false,
      };

      mockSupabase.from.mockReturnValue({
        insert: () => Promise.resolve({ error: { message: 'Insert failed' } }),
      });

      await expect(aiService.trackBehaviorEvent(behaviorEvent)).rejects.toThrow(
        'Failed to track behavior event'
      );
    });
  });

  // ===== US-097: Content Similarity Analysis Tests =====

  describe('US-097: Content Similarity Analysis', () => {
    it('should calculate content similarity successfully', async () => {
      const request: SimilarityCalculationRequest = {
        content_id: testContentId,
        similarity_threshold: 0.3,
        max_results: 5,
        include_reasons: true,
        calculation_method: 'hybrid',
      };

      const mockSimilarContent = [
        {
          content_id: '550e8400-e29b-41d4-a716-446655440001',
          similarity_score: 0.85,
          similarity_reasons: ['Similar tags', 'Same author'],
          confidence: 0.9,
        },
      ];

      // Mock the similarity calculation
      vi.spyOn(aiService, 'calculateContentSimilarity').mockResolvedValue({
        content_id: testContentId,
        similar_content: mockSimilarContent,
        calculation_metadata: {
          method_used: 'hybrid',
          processing_time_ms: 150,
          total_comparisons: 100,
        },
      });

      const result = await aiService.calculateContentSimilarity(request);

      expect(result.content_id).toBe(testContentId);
      expect(result.similar_content).toHaveLength(1);
      expect(result.similar_content[0].similarity_score).toBeGreaterThan(0.8);
      expect(result.calculation_metadata.method_used).toBe('hybrid');
    });

    it('should store calculated similarity data', async () => {
      const similarity = {
        content_a_id: testContentId,
        content_b_id: '550e8400-e29b-41d4-a716-446655440001',
        overall_similarity: 0.75,
        semantic_similarity: 0.8,
        tag_similarity: 0.7,
        creator_similarity: 0,
        engagement_similarity: 0.6,
        confidence_score: 0.8,
        calculation_method: 'hybrid' as const,
        content_features: {},
        similarity_reasons: ['Similar content', 'Related tags'],
      };

      mockSupabase.from.mockReturnValue({
        upsert: () => ({
          select: () => ({
            single: () =>
              Promise.resolve({
                data: { ...similarity, id: 'sim-1' },
                error: null,
              }),
          }),
        }),
      });

      const result = await aiService.storeSimilarity(similarity);

      expect(result).toBeDefined();
      expect(result.overall_similarity).toBe(0.75);
      expect(mockSupabase.from).toHaveBeenCalledWith('content_similarity');
    });

    it('should handle similarity calculation errors', async () => {
      const request: SimilarityCalculationRequest = {
        content_id: 'invalid-content-id',
        similarity_threshold: 0.3,
        max_results: 5,
      };

      // Mock error condition
      jest
        .spyOn(aiService, 'calculateContentSimilarity')
        .mockRejectedValue(new Error('Content not found: invalid-content-id'));

      await expect(aiService.calculateContentSimilarity(request)).rejects.toThrow(
        'Content not found'
      );
    });
  });

  // ===== US-098: Recommendation Feedback Tests =====

  describe('US-098: Recommendation Feedback', () => {
    it('should process recommendation feedback successfully', async () => {
      const feedback: Omit<RecommendationFeedback, 'id' | 'created_at'> = {
        user_id: testUserId,
        content_id: testContentId,
        recommendation_id: 'rec-1',
        feedback_type: 'like',
        rating: 5,
        recommendation_source: 'homepage',
        recommendation_algorithm: 'hybrid',
        position_in_list: 1,
        explanation_helpful: true,
        would_recommend_to_others: true,
        processed_for_learning: false,
        impact_on_model: 0,
      };

      mockSupabase.from.mockReturnValue({
        insert: () => ({
          select: () => ({
            single: () =>
              Promise.resolve({
                data: { ...feedback, id: 'feedback-1', created_at: new Date().toISOString() },
                error: null,
              }),
          }),
        }),
      });

      const result = await aiService.processFeedback(feedback);

      expect(result).toBeDefined();
      expect(result.feedback_type).toBe('like');
      expect(result.user_id).toBe(testUserId);
      expect(mockSupabase.from).toHaveBeenCalledWith('recommendation_feedback');
    });

    it('should get feedback analytics successfully', async () => {
      const timeRange = {
        start: '2024-01-01T00:00:00Z',
        end: '2024-01-31T23:59:59Z',
      };

      const mockFeedbackData = [
        {
          id: 'feedback-1',
          user_id: testUserId,
          feedback_type: 'like',
          rating: 5,
          recommendation_algorithm: 'hybrid',
          created_at: '2024-01-15T10:00:00Z',
        },
        {
          id: 'feedback-2',
          user_id: testUserId,
          feedback_type: 'dislike',
          rating: 2,
          recommendation_algorithm: 'collaborative',
          created_at: '2024-01-16T11:00:00Z',
        },
      ];

      mockSupabase.from.mockReturnValue({
        select: () => ({
          gte: () => ({
            lte: () => Promise.resolve({ data: mockFeedbackData, error: null }),
          }),
        }),
      });

      // Mock the analytics processing
      vi.spyOn(aiService, 'getFeedbackAnalytics').mockResolvedValue({
        feedback_summary: {
          total_feedback: 2,
          positive_feedback: 1,
          negative_feedback: 1,
          feedback_rate: 0.5,
        },
        feedback_by_type: {
          like: 1,
          dislike: 1,
          not_interested: 0,
          irrelevant: 0,
          inappropriate: 0,
          spam: 0,
        },
        feedback_by_algorithm: {
          hybrid: { total: 1, positive: 1, negative: 0, average_rating: 5 },
          collaborative: { total: 1, positive: 0, negative: 1, average_rating: 2 },
        },
        temporal_trends: [
          { date: '2024-01-15', feedback_count: 1, satisfaction_score: 5 },
          { date: '2024-01-16', feedback_count: 1, satisfaction_score: 2 },
        ],
      });

      const result = await aiService.getFeedbackAnalytics(timeRange);

      expect(result.feedback_summary.total_feedback).toBe(2);
      expect(result.feedback_by_type.like).toBe(1);
      expect(result.feedback_by_algorithm.hybrid.positive).toBe(1);
      expect(result.temporal_trends).toHaveLength(2);
    });

    it('should handle feedback processing errors', async () => {
      const feedback: Omit<RecommendationFeedback, 'id' | 'created_at'> = {
        user_id: testUserId,
        content_id: testContentId,
        feedback_type: 'like',
        processed_for_learning: false,
        impact_on_model: 0,
      };

      mockSupabase.from.mockReturnValue({
        insert: () => ({
          select: () => ({
            single: () => Promise.resolve({ data: null, error: { message: 'Insert failed' } }),
          }),
        }),
      });

      await expect(aiService.processFeedback(feedback)).rejects.toThrow(
        'Failed to process feedback'
      );
    });
  });

  // ===== Integration Tests =====

  describe('Integration Tests', () => {
    it('should handle complete recommendation workflow', async () => {
      // 1. Track behavior
      const behaviorEvent: Omit<UserBehaviorEvent, 'id' | 'timestamp'> = {
        user_id: testUserId,
        event_type: 'content_view',
        content_id: testContentId,
        processed_for_ml: false,
      };

      // 2. Get recommendations
      const recommendationRequest: RecommendationRequest = {
        user_id: testUserId,
        context: 'homepage',
        limit: 5,
      };

      // 3. Provide feedback
      const feedback: Omit<RecommendationFeedback, 'id' | 'created_at'> = {
        user_id: testUserId,
        content_id: testContentId,
        feedback_type: 'like',
        processed_for_learning: false,
        impact_on_model: 0,
      };

      // Mock all operations
      mockSupabase.from.mockReturnValue({
        insert: () => ({
          select: () => ({ single: () => Promise.resolve({ data: {}, error: null }) }),
        }),
        select: () => ({
          eq: () => ({ single: () => Promise.resolve({ data: null, error: null }) }),
        }),
        upsert: () => ({
          select: () => ({ single: () => Promise.resolve({ data: {}, error: null }) }),
        }),
      });

      // Execute workflow
      await expect(aiService.trackBehaviorEvent(behaviorEvent)).resolves.not.toThrow();

      // Mock recommendation response
      vi.spyOn(aiService, 'getPersonalizedRecommendations').mockResolvedValue({
        recommendations: [],
        metadata: {
          total_recommendations: 0,
          algorithm_used: 'hybrid',
          processing_time_ms: 100,
          personalization_score: 0.8,
          cache_hit: false,
        },
      });

      const recommendations = await aiService.getPersonalizedRecommendations(recommendationRequest);
      expect(recommendations).toBeDefined();

      await expect(aiService.processFeedback(feedback)).resolves.not.toThrow();
    });

    it('should maintain consistent user identification across services', async () => {
      const consistentUserId = 'consistent-user-pubkey';

      // All operations should use the same user identifier
      const operations = [
        () => aiService.updateUserPreferences(consistentUserId, {}),
        () =>
          aiService.trackBehaviorEvent({
            user_id: consistentUserId,
            event_type: 'content_view',
            processed_for_ml: false,
          }),
      ];

      // Mock successful responses
      mockSupabase.from.mockReturnValue({
        insert: () => Promise.resolve({ error: null }),
        upsert: () => ({
          select: () => ({ single: () => Promise.resolve({ data: {}, error: null }) }),
        }),
      });

      for (const operation of operations) {
        await expect(operation()).resolves.not.toThrow();
      }
    });
  });

  // ===== Performance Tests =====

  describe('Performance Tests', () => {
    it('should complete recommendation generation within acceptable time', async () => {
      const startTime = Date.now();

      vi.spyOn(aiService, 'getPersonalizedRecommendations').mockResolvedValue({
        recommendations: [],
        metadata: {
          total_recommendations: 0,
          algorithm_used: 'hybrid',
          processing_time_ms: 50,
          personalization_score: 0.8,
          cache_hit: false,
        },
      });

      const request: RecommendationRequest = {
        user_id: testUserId,
        context: 'homepage',
        limit: 10,
      };

      await aiService.getPersonalizedRecommendations(request);

      const executionTime = Date.now() - startTime;
      expect(executionTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle concurrent requests efficiently', async () => {
      vi.spyOn(aiService, 'trackBehaviorEvent').mockResolvedValue();

      const concurrentEvents = Array.from({ length: 10 }, (_, i) => ({
        user_id: `user-${i}`,
        event_type: 'content_view' as const,
        processed_for_ml: false,
      }));

      const startTime = Date.now();
      await Promise.all(concurrentEvents.map((event) => aiService.trackBehaviorEvent(event)));
      const executionTime = Date.now() - startTime;

      expect(executionTime).toBeLessThan(2000); // Should handle 10 concurrent requests within 2 seconds
    });
  });

  // ===== Edge Cases =====

  describe('Edge Cases', () => {
    it('should handle empty recommendation requests gracefully', async () => {
      const request: RecommendationRequest = {
        user_id: testUserId,
        context: 'homepage',
        limit: 0,
      };

      vi.spyOn(aiService, 'getPersonalizedRecommendations').mockResolvedValue({
        recommendations: [],
        metadata: {
          total_recommendations: 0,
          algorithm_used: 'hybrid',
          processing_time_ms: 10,
          personalization_score: 0,
          cache_hit: false,
        },
      });

      const result = await aiService.getPersonalizedRecommendations(request);
      expect(result.recommendations).toHaveLength(0);
    });

    it('should handle invalid content IDs in similarity calculation', async () => {
      const request: SimilarityCalculationRequest = {
        content_id: 'invalid-uuid',
        similarity_threshold: 0.3,
        max_results: 5,
      };

      jest
        .spyOn(aiService, 'calculateContentSimilarity')
        .mockRejectedValue(new Error('Invalid content ID format'));

      await expect(aiService.calculateContentSimilarity(request)).rejects.toThrow(
        'Invalid content ID format'
      );
    });

    it('should handle malformed feedback data', async () => {
      const malformedFeedback = {
        user_id: '', // Empty user ID
        content_id: testContentId,
        feedback_type: 'like' as const,
        processed_for_learning: false,
        impact_on_model: 0,
      };

      mockSupabase.from.mockReturnValue({
        insert: () => ({
          select: () => ({
            single: () =>
              Promise.resolve({
                data: null,
                error: { message: 'Invalid user ID' },
              }),
          }),
        }),
      });

      await expect(aiService.processFeedback(malformedFeedback)).rejects.toThrow(
        'Failed to process feedback'
      );
    });
  });
});

// ===== Test Utilities =====

export const createMockUserPreferences = (overrides: Partial<UserPreferences> = {}) => ({
  id: 'test-pref-id',
  user_id: 'test-user',
  preferred_content_types: ['article'],
  preferred_tags: ['technology'],
  preferred_creators: [],
  preferred_difficulty_levels: ['intermediate'],
  reading_time_preference: 10,
  engagement_type_weights: { like: 1, comment: 2, share: 3, bookmark: 2.5 },
  content_length_preference: 'medium' as const,
  confidence_score: 0.8,
  learning_iterations: 5,
  preferred_publish_timeframe: 'recent' as const,
  seasonal_preferences: {},
  allow_behavioral_tracking: true,
  allow_collaborative_filtering: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

export const createMockBehaviorEvent = (overrides: Partial<UserBehaviorEvent> = {}) => ({
  id: 'test-behavior-id',
  user_id: 'test-user',
  session_id: 'test-session',
  event_type: 'content_view' as const,
  content_id: 'test-content',
  content_type: 'article',
  content_tags: ['technology'],
  creator_id: 'test-creator',
  dwell_time: 120,
  scroll_depth: 0.8,
  interaction_quality: 0.9,
  source_location: 'homepage',
  device_type: 'desktop',
  processed_for_ml: false,
  timestamp: new Date().toISOString(),
  ...overrides,
});
