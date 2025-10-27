/**
 * 🧪 CREATOR RECOMMENDATION SERVICE TESTS
 * Elite test suite for AI-powered creator recommendations
 * Comprehensive coverage for US-099 through US-102
 */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  AudienceLevel,
  ContentStyle,
  CreatorDiscoveryRequest,
  CreatorMatchingRequest,
  CreatorProfile,
  CreatorProfileRequest,
  DiscoveryMethod,
  FollowRecommendationRequest,
  InterestBasedSuggestionRequest,
  InterestSource,
  PostingFrequency,
  RecommendationAlgorithm,
  VerificationStatus,
} from '../../types/creator-recommendations';
import { CreatorRecommendationService } from '../creator-recommendation-service';

// Mock Supabase client
const mockSupabase = {
  from: jest.fn(),
  rpc: jest.fn(),
};

const mockQuery = {
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  upsert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  neq: jest.fn().mockReturnThis(),
  gt: jest.fn().mockReturnThis(),
  gte: jest.fn().mockReturnThis(),
  lt: jest.fn().mockReturnThis(),
  lte: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(),
  contains: jest.fn().mockReturnThis(),
  overlaps: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  range: jest.fn().mockReturnThis(),
  single: jest.fn(),
  maybeSingle: jest.fn(),
};

// Mock createClient
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabase),
}));

describe('CreatorRecommendationService', () => {
  let service: CreatorRecommendationService;

  // Global mock data accessible to all tests
  const mockCreatorProfile: CreatorProfile = {
    id: 'profile_123',
    creatorId: 'creator_123',
    bio: 'Passionate tech educator and content creator',
    expertiseAreas: ['javascript', 'react', 'web development'],
    contentCategories: ['tutorial', 'technology', 'programming'],
    primaryTopics: ['frontend development', 'web design', 'coding tutorials'],
    contentStyle: ContentStyle.EDUCATIONAL,
    audienceLevel: AudienceLevel.INTERMEDIATE,
    postingFrequency: PostingFrequency.WEEKLY,
    avgContentQuality: 4.5,
    communityEngagementScore: 0.85,
    followerGrowthRate: 0.12,
    collaborationNetwork: {},
    influenceScore: 0.7,
    activeHours: { '9': 0.8, '14': 0.9, '20': 0.6 },
    activeDays: { monday: 0.8, wednesday: 0.9, friday: 0.7 },
    contentPublishingPattern: {},
    verificationStatus: VerificationStatus.VERIFIED,
    trustScore: 0.9,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-15'),
    lastAnalyzedAt: new Date('2024-01-14'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase.from.mockReturnValue(mockQuery);
    mockSupabase.rpc.mockReturnValue(mockQuery);
    service = new CreatorRecommendationService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // US-099: CREATOR MATCHING BASED ON INTERESTS
  // ============================================================================

  describe('US-099: Creator Matching Based on Interests', () => {
    describe('7.1.1: Creator profiling system', () => {
      it('should create a new creator profile successfully', async () => {
        const profileRequest: CreatorProfileRequest = {
          bio: 'Tech educator specializing in React',
          expertiseAreas: ['react', 'javascript'],
          contentCategories: ['tutorial', 'technology'],
          primaryTopics: ['react development', 'javascript fundamentals'],
          contentStyle: ContentStyle.EDUCATIONAL,
          audienceLevel: AudienceLevel.INTERMEDIATE,
        };

        mockQuery.single.mockResolvedValue({
          data: { id: 'profile_123', creator_id: 'creator_123', ...profileRequest },
          error: null,
        });

        const result = await service.createOrUpdateCreatorProfile('creator_123', profileRequest);

        expect(mockSupabase.from).toHaveBeenCalledWith('creator_profiles');
        expect(mockQuery.upsert).toHaveBeenCalledWith({
          creator_id: 'creator_123',
          ...profileRequest,
          updated_at: expect.any(String),
        });
        expect(result.creatorId).toBe('creator_123');
        expect(result.contentStyle).toBe(ContentStyle.EDUCATIONAL);
      });

      it('should update existing creator profile', async () => {
        const updateRequest: CreatorProfileRequest = {
          bio: 'Updated bio with more experience',
          expertiseAreas: ['react', 'typescript', 'next.js'],
        };

        mockQuery.single.mockResolvedValue({
          data: { ...mockCreatorProfile, ...updateRequest },
          error: null,
        });

        const result = await service.createOrUpdateCreatorProfile('creator_123', updateRequest);

        expect(result.bio).toBe('Updated bio with more experience');
        expect(result.expertiseAreas).toContain('typescript');
      });

      it('should handle profile creation errors gracefully', async () => {
        mockQuery.single.mockResolvedValue({
          data: null,
          error: { message: 'Database constraint violation' },
        });

        await expect(service.createOrUpdateCreatorProfile('invalid_creator', {})).rejects.toThrow(
          'Failed to create/update creator profile'
        );
      });
    });

    describe('7.1.2: Interest-based matching algorithms', () => {
      it('should find similar creators based on interests and topics', async () => {
        const matchingRequest: CreatorMatchingRequest = {
          targetCreatorId: 'creator_123',
          maxMatches: 5,
          minSimilarityThreshold: 0.6,
          includeExplanations: true,
        };

        const mockSimilarCreators = [
          {
            recommended_creator_id: 'creator_456',
            recommendation_score: 0.85,
            primary_reason: 'Strong expertise in shared topics',
            shared_interests: ['react', 'javascript'],
          },
          {
            recommended_creator_id: 'creator_789',
            recommendation_score: 0.75,
            primary_reason: 'Similar content style and audience level',
            shared_interests: ['web development', 'tutorial'],
          },
        ];

        // Mock the database function call
        mockSupabase.rpc.mockResolvedValue({
          data: mockSimilarCreators,
          error: null,
        });

        // Mock profile retrieval for each match
        mockQuery.single
          .mockResolvedValueOnce({
            data: { ...mockCreatorProfile, creator_id: 'creator_456' },
            error: null,
          })
          .mockResolvedValueOnce({
            data: { ...mockCreatorProfile, creator_id: 'creator_789' },
            error: null,
          });

        const result = await service.findSimilarCreators(matchingRequest);

        expect(mockSupabase.rpc).toHaveBeenCalledWith('get_creator_recommendations', {
          target_user: 'creator_123',
          algorithm: 'content_based',
          max_recommendations: 5,
          min_score: 0.6,
        });

        expect(result.targetCreatorId).toBe('creator_123');
        expect(result.matches).toHaveLength(2);
        expect(result.matches[0].creatorId).toBe('creator_456');
        expect(result.matches[0].similarity.overallSimilarity).toBe(0.85);
        expect(result.processingTimeMs).toBeGreaterThan(0);
      });

      it('should handle empty similarity results', async () => {
        mockSupabase.rpc.mockResolvedValue({
          data: [],
          error: null,
        });

        const result = await service.findSimilarCreators({
          targetCreatorId: 'creator_123',
        });

        expect(result.matches).toHaveLength(0);
        expect(result.totalMatches).toBe(0);
      });
    });

    describe('7.1.3: Creator similarity metrics', () => {
      it('should calculate comprehensive similarity scores', async () => {
        const mockSimilarCreators = [
          {
            recommended_creator_id: 'creator_456',
            recommendation_score: 0.92,
            primary_reason: 'High content and style similarity',
            shared_interests: ['react', 'typescript', 'tutorial'],
          },
        ];

        mockSupabase.rpc.mockResolvedValue({
          data: mockSimilarCreators,
          error: null,
        });

        mockQuery.single.mockResolvedValue({
          data: mockCreatorProfile,
          error: null,
        });

        const result = await service.findSimilarCreators({
          targetCreatorId: 'creator_123',
          includeExplanations: true,
        });

        const similarity = result.matches[0].similarity;
        expect(similarity.overallSimilarity).toBe(0.92);
        expect(similarity.calculationMethod).toBe('algorithmic');
        expect(similarity.confidenceScore).toBe(0.85);
      });
    });

    describe('7.1.4-7.1.8: Additional creator matching features', () => {
      it('should provide comprehensive match explanations', async () => {
        const mockSimilarCreators = [
          {
            recommended_creator_id: 'creator_456',
            recommendation_score: 0.88,
            primary_reason: 'Excellent match across multiple dimensions',
            shared_interests: ['react', 'javascript', 'web-development'],
          },
        ];

        mockSupabase.rpc.mockResolvedValue({
          data: mockSimilarCreators,
          error: null,
        });

        mockQuery.single.mockResolvedValue({
          data: mockCreatorProfile,
          error: null,
        });

        const result = await service.findSimilarCreators({
          targetCreatorId: 'creator_123',
          includeExplanations: true,
        });

        expect(result.matches[0].matchReasons).toContain(
          'Excellent match across multiple dimensions'
        );
        expect(result.matches[0].confidenceScore).toBe(0.88);
      });
    });
  });

  // ============================================================================
  // US-100: INTEREST-BASED CREATOR SUGGESTIONS
  // ============================================================================

  describe('US-100: Interest-based Creator Suggestions', () => {
    describe('7.2.1: Interest taxonomy system', () => {
      it('should create interest taxonomy entries', async () => {
        const interestData = {
          name: 'React Development',
          slug: 'react-development',
          description: 'Frontend library for building user interfaces',
          category: 'technology',
          keywords: ['react', 'javascript', 'frontend', 'components'],
        };

        mockQuery.single.mockResolvedValue({
          data: { id: 'interest_123', ...interestData },
          error: null,
        });

        const result = await service.createInterest(interestData);

        expect(mockSupabase.from).toHaveBeenCalledWith('interest_taxonomy');
        expect(result.name).toBe('React Development');
        expect(result.slug).toBe('react-development');
        expect(result.keywords).toContain('react');
      });
    });

    describe('7.2.2: Interest extraction algorithms', () => {
      it('should retrieve user interests with strength scores', async () => {
        const mockUserInterests = [
          {
            id: 'mapping_1',
            user_id: 'user_123',
            interest_id: 'interest_123',
            interest_strength: 0.9,
            confidence_score: 0.85,
            source: InterestSource.EXPLICIT,
            learning_iterations: 5,
            engagement_count: 25,
            interest_decay_rate: 0.05,
            seasonal_variance: {},
            created_at: '2024-01-01',
            updated_at: '2024-01-15',
            interest_taxonomy: {
              id: 'interest_123',
              name: 'React Development',
              category: 'technology',
            },
          },
        ];

        mockQuery.gte.mockResolvedValue({
          data: mockUserInterests,
          error: null,
        });

        const result = await service.getUserInterests('user_123');

        expect(mockSupabase.from).toHaveBeenCalledWith('user_interest_mapping');
        expect(result).toHaveLength(1);
        expect(result[0].interestStrength).toBe(0.9);
        expect(result[0].source).toBe(InterestSource.EXPLICIT);
      });
    });

    describe('7.2.3-7.2.8: Interest-based creator suggestions', () => {
      it('should generate interest-based creator suggestions', async () => {
        const suggestionRequest: InterestBasedSuggestionRequest = {
          userId: 'user_123',
          maxSuggestions: 10,
          minExpertiseLevel: 0.7,
          excludeFollowed: true,
          diversityWeight: 0.3,
        };

        const mockCreatorInterests = [
          {
            creator_id: 'creator_456',
            interest_id: 'interest_123',
            expertise_level: 0.9,
            engagement_rate: 0.85,
            creator_profiles: mockCreatorProfile,
          },
          {
            creator_id: 'creator_789',
            interest_id: 'interest_123',
            expertise_level: 0.8,
            engagement_rate: 0.75,
            creator_profiles: { ...mockCreatorProfile, creator_id: 'creator_789' },
          },
        ];

        // Mock user interests
        mockQuery.gte.mockResolvedValueOnce({
          data: [
            {
              user_id: 'user_123',
              interest_id: 'interest_123',
              interest_strength: 0.9,
            },
          ],
          error: null,
        });

        // Mock creator suggestions
        mockQuery.limit.mockResolvedValue({
          data: mockCreatorInterests,
          error: null,
        });

        const result = await service.getInterestBasedSuggestions(suggestionRequest);

        expect(result.userId).toBe('user_123');
        expect(result.suggestions).toHaveLength(2);
        expect(result.suggestions[0].overallScore).toBeGreaterThan(0);
        expect(result.suggestions[0].explanations).toContain(
          'Strong expertise in 1 shared interests'
        );
        expect(result.processingTimeMs).toBeGreaterThan(0);
      });

      it('should handle requests with specific interest IDs', async () => {
        const suggestionRequest: InterestBasedSuggestionRequest = {
          userId: 'user_123',
          interestIds: ['interest_123', 'interest_456'],
          maxSuggestions: 5,
        };

        mockQuery.limit.mockResolvedValue({
          data: [
            {
              creator_id: 'creator_456',
              interest_id: 'interest_123',
              expertise_level: 0.85,
              engagement_rate: 0.8,
              creator_profiles: mockCreatorProfile,
            },
          ],
          error: null,
        });

        const result = await service.getInterestBasedSuggestions(suggestionRequest);

        expect(mockQuery.in).toHaveBeenCalledWith('interest_id', ['interest_123', 'interest_456']);
        expect(result.suggestions).toHaveLength(1);
      });
    });
  });

  // ============================================================================
  // US-101: DISCOVERY INTERFACE FOR NEW CREATORS
  // ============================================================================

  describe('US-101: Discovery Interface for New Creators', () => {
    describe('7.3.1: Creator discovery interface', () => {
      it('should start a creator discovery session', async () => {
        const mockSession = {
          id: 'session_123',
          user_id: 'user_123',
          discovery_method: DiscoveryMethod.RECOMMENDATIONS,
          session_start: '2024-01-15T10:00:00Z',
          creators_viewed: 0,
          creators_clicked: 0,
          creators_followed: 0,
          time_spent_seconds: 0,
          recommendation_confidence: 0.8,
          diversity_score: 0.7,
          updated_at: '2024-01-15T10:00:00Z',
        };

        mockQuery.single.mockResolvedValue({
          data: mockSession,
          error: null,
        });

        const result = await service.startDiscoverySession(
          'user_123',
          DiscoveryMethod.RECOMMENDATIONS
        );

        expect(mockSupabase.from).toHaveBeenCalledWith('creator_discovery_sessions');
        expect(result.userId).toBe('user_123');
        expect(result.discoveryMethod).toBe(DiscoveryMethod.RECOMMENDATIONS);
      });
    });

    describe('7.3.2-7.3.8: Creator discovery algorithms and interface', () => {
      it('should discover creators with comprehensive filtering', async () => {
        const discoveryRequest: CreatorDiscoveryRequest = {
          userId: 'user_123',
          discoveryMethod: DiscoveryMethod.SEARCH,
          searchQuery: 'react tutorial',
          categories: ['technology', 'tutorial'],
          verificationStatus: [VerificationStatus.VERIFIED],
          usePersonalization: true,
          diversityWeight: 0.4,
          page: 1,
          limit: 10,
          sortBy: 'popularity',
        };

        const mockCreators = [
          {
            ...mockCreatorProfile,
            creator_interest_mapping: [
              {
                interest_id: 'interest_123',
                expertise_level: 0.9,
                interest_taxonomy: { name: 'React Development', category: 'technology' },
              },
            ],
          },
          {
            ...mockCreatorProfile,
            creator_id: 'creator_456',
            creator_interest_mapping: [
              {
                interest_id: 'interest_456',
                expertise_level: 0.8,
                interest_taxonomy: { name: 'JavaScript Fundamentals', category: 'technology' },
              },
            ],
          },
        ];

        // Mock session creation
        mockQuery.single.mockResolvedValueOnce({
          data: { id: 'session_123', user_id: 'user_123' },
          error: null,
        });

        // Mock creator discovery
        mockQuery.range.mockResolvedValue({
          data: mockCreators,
          error: null,
        });

        const result = await service.discoverCreators(discoveryRequest);

        expect(result.sessionId).toBe('session_123');
        expect(result.discoveryMethod).toBe(DiscoveryMethod.SEARCH);
        expect(result.creators).toHaveLength(2);
        expect(result.creators[0].discoveryScore).toBeGreaterThan(0);
        expect(result.creators[0].discoveryReasons).toContain('High quality content');
        expect(result.totalCreators).toBe(2);
        expect(result.currentPage).toBe(1);
        expect(result.algorithmUsed).toBe('content_quality');
      });

      it('should handle empty discovery results', async () => {
        mockQuery.single.mockResolvedValueOnce({
          data: { id: 'session_123', user_id: 'user_123' },
          error: null,
        });

        mockQuery.range.mockResolvedValue({
          data: [],
          error: null,
        });

        const result = await service.discoverCreators({ userId: 'user_123' });

        expect(result.creators).toHaveLength(0);
        expect(result.hasNextPage).toBe(false);
      });
    });
  });

  // ============================================================================
  // US-102: FOLLOW RECOMMENDATIONS
  // ============================================================================

  describe('US-102: Follow Recommendations', () => {
    describe('7.4.1-7.4.4: Follow recommendation algorithms', () => {
      it('should generate comprehensive follow recommendations', async () => {
        const followRequest: FollowRecommendationRequest = {
          userId: 'user_123',
          context: 'homepage',
          algorithm: RecommendationAlgorithm.HYBRID,
          maxRecommendations: 5,
          minScore: 0.6,
          includeExplanations: true,
          diversityWeight: 0.3,
        };

        const mockRecommendations = [
          {
            recommended_creator_id: 'creator_456',
            recommendation_score: 0.9,
            primary_reason: 'Strong alignment with your interests',
            shared_interests: ['react', 'javascript', 'web-development'],
          },
          {
            recommended_creator_id: 'creator_789',
            recommendation_score: 0.85,
            primary_reason: 'Popular among your network',
            shared_interests: ['frontend', 'tutorial'],
          },
        ];

        mockSupabase.rpc.mockResolvedValue({
          data: mockRecommendations,
          error: null,
        });

        // Mock profile retrieval for each recommendation
        mockQuery.single
          .mockResolvedValueOnce({
            data: { ...mockCreatorProfile, creator_id: 'creator_456' },
            error: null,
          })
          .mockResolvedValueOnce({
            data: { ...mockCreatorProfile, creator_id: 'creator_789' },
            error: null,
          });

        const result = await service.getFollowRecommendations(followRequest);

        expect(mockSupabase.rpc).toHaveBeenCalledWith('get_creator_recommendations', {
          target_user: 'user_123',
          algorithm: 'hybrid',
          max_recommendations: 5,
          min_score: 0.6,
        });

        expect(result.userId).toBe('user_123');
        expect(result.context).toBe('homepage');
        expect(result.recommendations).toHaveLength(2);
        expect(result.algorithmUsed).toBe(RecommendationAlgorithm.HYBRID);

        const firstRec = result.recommendations[0];
        expect(firstRec.recommendation.recommendationScore).toBe(0.9);
        expect(firstRec.recommendation.primaryReason).toBe('Strong alignment with your interests');
        expect(firstRec.scoringFactors.interestAlignment).toBe(0.9);
        expect(firstRec.explanations.primary).toBe('Strong alignment with your interests');
        expect(firstRec.explanations.confidence).toBe(0.9);
      });

      it('should handle different recommendation algorithms', async () => {
        const algorithms = [
          RecommendationAlgorithm.COLLABORATIVE_FILTERING,
          RecommendationAlgorithm.CONTENT_BASED,
          RecommendationAlgorithm.SOCIAL_NETWORK,
        ];

        for (const algorithm of algorithms) {
          mockSupabase.rpc.mockResolvedValue({
            data: [
              {
                recommended_creator_id: 'creator_456',
                recommendation_score: 0.8,
                primary_reason: `Recommendation via ${algorithm}`,
                shared_interests: ['test'],
              },
            ],
            error: null,
          });

          mockQuery.single.mockResolvedValue({
            data: mockCreatorProfile,
            error: null,
          });

          const result = await service.getFollowRecommendations({
            userId: 'user_123',
            algorithm,
          });

          expect(result.algorithmUsed).toBe(algorithm);
        }
      });
    });

    describe('7.4.5-7.4.8: Follow tracking and analytics', () => {
      it('should track follow relationships with recommendation context', async () => {
        const mockFollowRelationship = {
          id: 'follow_123',
          follower_id: 'user_123',
          following_id: 'creator_456',
          follow_source: 'recommendation',
          recommendation_id: 'rec_123',
          followed_at: '2024-01-15T10:00:00Z',
          engagement_score: 0.0,
          interaction_frequency: 0.0,
          content_consumption_rate: 0.0,
          days_remained_followed: 0,
          influenced_additional_follows: 0,
          recommendation_success_score: 0.0,
          updated_at: '2024-01-15T10:00:00Z',
        };

        mockQuery.single.mockResolvedValue({
          data: mockFollowRelationship,
          error: null,
        });

        const result = await service.trackFollowRelationship(
          'user_123',
          'creator_456',
          'recommendation',
          'rec_123'
        );

        expect(mockSupabase.from).toHaveBeenCalledWith('follow_relationships');
        expect(mockQuery.insert).toHaveBeenCalledWith({
          follower_id: 'user_123',
          following_id: 'creator_456',
          follow_source: 'recommendation',
          recommendation_id: 'rec_123',
          followed_at: expect.any(String),
        });

        expect(result.followerId).toBe('user_123');
        expect(result.followingId).toBe('creator_456');
        expect(result.followSource).toBe('recommendation');
        expect(result.recommendationId).toBe('rec_123');
      });

      it('should handle follow tracking without recommendation ID', async () => {
        const mockFollowRelationship = {
          id: 'follow_124',
          follower_id: 'user_123',
          following_id: 'creator_789',
          follow_source: 'search',
          recommendation_id: null,
          followed_at: '2024-01-15T10:00:00Z',
          engagement_score: 0.0,
          interaction_frequency: 0.0,
          content_consumption_rate: 0.0,
          days_remained_followed: 0,
          influenced_additional_follows: 0,
          recommendation_success_score: 0.0,
          updated_at: '2024-01-15T10:00:00Z',
        };

        mockQuery.single.mockResolvedValue({
          data: mockFollowRelationship,
          error: null,
        });

        const result = await service.trackFollowRelationship('user_123', 'creator_789', 'search');

        expect(result.followSource).toBe('search');
        expect(result.recommendationId).toBeUndefined();
      });
    });
  });

  // ============================================================================
  // PERFORMANCE AND ERROR HANDLING TESTS
  // ============================================================================

  describe('Performance and Error Handling', () => {
    it('should handle database connection errors gracefully', async () => {
      mockQuery.single.mockResolvedValue({
        data: null,
        error: { message: 'Connection timeout' },
      });

      await expect(service.getCreatorProfile('creator_123')).rejects.toThrow(
        'Failed to get creator profile'
      );
    });

    it('should handle invalid input data validation', async () => {
      await expect(
        service.findSimilarCreators({
          targetCreatorId: 'invalid_id',
        })
      ).rejects.toThrow();
    });

    it('should process recommendations within performance thresholds', async () => {
      const startTime = Date.now();

      mockSupabase.rpc.mockResolvedValue({
        data: [
          {
            recommended_creator_id: 'creator_456',
            recommendation_score: 0.8,
            primary_reason: 'Test recommendation',
            shared_interests: ['test'],
          },
        ],
        error: null,
      });

      mockQuery.single.mockResolvedValue({
        data: mockCreatorProfile,
        error: null,
      });

      const result = await service.getFollowRecommendations({
        userId: 'user_123',
      });

      const processingTime = Date.now() - startTime;
      expect(processingTime).toBeLessThan(5000); // Under 5 seconds
      expect(result.processingTimeMs).toBeGreaterThan(0);
    });

    it('should handle concurrent requests efficiently', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: [
          {
            recommended_creator_id: 'creator_456',
            recommendation_score: 0.8,
            primary_reason: 'Concurrent test',
            shared_interests: ['test'],
          },
        ],
        error: null,
      });

      mockQuery.single.mockResolvedValue({
        data: mockCreatorProfile,
        error: null,
      });

      // Simulate concurrent requests
      const promises = Array.from({ length: 10 }, (_, i) =>
        service.getFollowRecommendations({
          userId: `user_${i}`,
        })
      );

      const results = await Promise.all(promises);
      expect(results).toHaveLength(10);
      results.forEach((result, index) => {
        expect(result.userId).toBe(`user_${index}`);
      });
    });
  });

  // ============================================================================
  // INTEGRATION TESTS
  // ============================================================================

  describe('Integration Tests', () => {
    it('should support complete creator recommendation workflow', async () => {
      // 1. Create creator profile
      mockQuery.single.mockResolvedValueOnce({
        data: { id: 'profile_123', creator_id: 'creator_123' },
        error: null,
      });

      await service.createOrUpdateCreatorProfile('creator_123', {
        bio: 'Test creator',
        contentStyle: ContentStyle.EDUCATIONAL,
      });

      // 2. Find similar creators
      mockSupabase.rpc.mockResolvedValueOnce({
        data: [
          {
            recommended_creator_id: 'creator_456',
            recommendation_score: 0.8,
            primary_reason: 'Similar profile',
            shared_interests: ['test'],
          },
        ],
        error: null,
      });

      mockQuery.single.mockResolvedValueOnce({
        data: mockCreatorProfile,
        error: null,
      });

      const matches = await service.findSimilarCreators({
        targetCreatorId: 'creator_123',
      });

      // 3. Generate follow recommendations
      mockSupabase.rpc.mockResolvedValueOnce({
        data: [
          {
            recommended_creator_id: 'creator_456',
            recommendation_score: 0.85,
            primary_reason: 'Highly recommended',
            shared_interests: ['test'],
          },
        ],
        error: null,
      });

      mockQuery.single.mockResolvedValueOnce({
        data: mockCreatorProfile,
        error: null,
      });

      const recommendations = await service.getFollowRecommendations({
        userId: 'user_123',
      });

      // 4. Track follow relationship
      mockQuery.single.mockResolvedValueOnce({
        data: {
          id: 'follow_123',
          follower_id: 'user_123',
          following_id: 'creator_456',
          follow_source: 'recommendation',
        },
        error: null,
      });

      const followResult = await service.trackFollowRelationship(
        'user_123',
        'creator_456',
        'recommendation'
      );

      expect(matches.totalMatches).toBe(1);
      expect(recommendations.totalRecommendations).toBe(1);
      expect(followResult.followerId).toBe('user_123');
    });
  });
});
