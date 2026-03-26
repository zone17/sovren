/**
 * 🎭 CREATOR RECOMMENDATION SERVICE
 * Elite AI-powered creator recommendation service
 * Part of US-099 through US-102 implementation
 */

import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import {
  CreatorDiscoveryRequest,
  CreatorDiscoveryResponse,
  CreatorDiscoverySession,
  CreatorMatchingRequest,
  CreatorMatchingResponse,
  CreatorProfile,
  CreatorProfileRequest,
  CreatorRecommendationConfig,
  CreatorRecommendationServiceError,
  CreatorRecommendationValidationError,
  DEFAULT_CREATOR_RECOMMENDATION_CONFIG,
  DiscoveryMethod,
  FollowRecommendationRequest,
  FollowRecommendationResponse,
  FollowRelationship,
  InterestBasedSuggestionRequest,
  InterestBasedSuggestionResponse,
  InterestTaxonomy,
  RecommendationAlgorithm,
  UserInterestMapping,
} from '../types/creator-recommendations';

/**
 * Elite Creator Recommendation Service
 * Handles all creator discovery and recommendation logic
 */
export class CreatorRecommendationService {
  private supabase;
  private config: CreatorRecommendationConfig;
  private cache: Map<string, any> = new Map();

  constructor(
    supabaseUrl: string = process.env.SUPABASE_URL!,
    supabaseKey: string = process.env.SUPABASE_ANON_KEY!,
    config: Partial<CreatorRecommendationConfig> = {}
  ) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.config = { ...DEFAULT_CREATOR_RECOMMENDATION_CONFIG, ...config };
  }

  // ============================================================================
  // US-099: CREATOR MATCHING BASED ON INTERESTS
  // ============================================================================

  /**
   * Create or update creator profile
   */
  async createOrUpdateCreatorProfile(
    creatorId: string,
    profileData: CreatorProfileRequest
  ): Promise<CreatorProfile> {
    try {
      const { data, error } = await this.supabase
        .from('creator_profiles')
        .upsert({
          creator_id: creatorId,
          ...profileData,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return this.mapCreatorProfile(data);
    } catch (error) {
      throw new CreatorRecommendationServiceError(
        'Failed to create/update creator profile',
        'database',
        { creatorId, error }
      );
    }
  }

  /**
   * Get creator profile by ID
   */
  async getCreatorProfile(creatorId: string): Promise<CreatorProfile | null> {
    try {
      const { data, error } = await this.supabase
        .from('creator_profiles')
        .select('*')
        .eq('creator_id', creatorId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data ? this.mapCreatorProfile(data) : null;
    } catch (error) {
      throw new CreatorRecommendationServiceError('Failed to get creator profile', 'database', {
        creatorId,
        error,
      });
    }
  }

  /**
   * Find similar creators based on profile matching
   */
  async findSimilarCreators(request: CreatorMatchingRequest): Promise<CreatorMatchingResponse> {
    const startTime = Date.now();

    try {
      // Get target creator profile
      const targetProfile = await this.getCreatorProfile(request.targetCreatorId);
      if (!targetProfile) {
        throw new CreatorRecommendationValidationError(
          'Target creator not found',
          'targetCreatorId',
          request.targetCreatorId
        );
      }

      // Calculate similarities using database function
      const { data: similarities, error } = await this.supabase.rpc('get_creator_recommendations', {
        target_user: request.targetCreatorId,
        algorithm: 'content_based',
        max_recommendations: request.maxMatches || 10,
        min_score: request.minSimilarityThreshold || 0.3,
      });

      if (error) throw error;

      // Batch-load all creator profiles in a single query instead of N individual calls
      const recommendedIds = similarities.map((sim: any) => sim.recommended_creator_id);
      const { data: profileRows, error: profileError } = await this.supabase
        .from('creator_profiles')
        .select('*')
        .in('creator_id', recommendedIds);
      if (profileError) throw profileError;

      const profileMap = new Map<string, CreatorProfile>();
      for (const row of profileRows ?? []) {
        profileMap.set(row.creator_id, this.mapCreatorProfile(row));
      }

      const matches = similarities.map((sim: any) => ({
        creatorId: sim.recommended_creator_id,
        creatorProfile: profileMap.get(sim.recommended_creator_id) ?? {},
        similarity: {
          overallSimilarity: sim.recommendation_score,
          contentSimilarity: sim.recommendation_score,
          topicSimilarity: sim.recommendation_score,
          calculationMethod: 'algorithmic',
          confidenceScore: 0.85,
        },
        matchReasons: [sim.primary_reason],
        confidenceScore: sim.recommendation_score,
      }));

      return {
        targetCreatorId: request.targetCreatorId,
        matches,
        totalMatches: matches.length,
        processingTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      throw new CreatorRecommendationServiceError('Failed to find similar creators', 'matching', {
        request,
        error,
      });
    }
  }

  // ============================================================================
  // US-100: INTEREST-BASED CREATOR SUGGESTIONS
  // ============================================================================

  /**
   * Create interest taxonomy entry
   */
  async createInterest(interest: Partial<InterestTaxonomy>): Promise<InterestTaxonomy> {
    try {
      const { data, error } = await this.supabase
        .from('interest_taxonomy')
        .insert(interest)
        .select()
        .single();

      if (error) throw error;
      return this.mapInterestTaxonomy(data);
    } catch (error) {
      throw new CreatorRecommendationServiceError('Failed to create interest', 'database', {
        interest,
        error,
      });
    }
  }

  /**
   * Get user interests
   */
  async getUserInterests(userId: string): Promise<UserInterestMapping[]> {
    try {
      const { data, error } = await this.supabase
        .from('user_interest_mapping')
        .select(
          `
          *,
          interest_taxonomy(*)
        `
        )
        .eq('user_id', userId)
        .gte('interest_strength', 0.2);

      if (error) throw error;
      return data.map(this.mapUserInterestMapping);
    } catch (error) {
      throw new CreatorRecommendationServiceError('Failed to get user interests', 'database', {
        userId,
        error,
      });
    }
  }

  /**
   * Get interest-based creator suggestions
   */
  async getInterestBasedSuggestions(
    request: InterestBasedSuggestionRequest
  ): Promise<InterestBasedSuggestionResponse> {
    const startTime = Date.now();

    try {
      // Get user interests if not specified
      let targetInterests = request.interestIds;
      if (!targetInterests) {
        const userInterests = await this.getUserInterests(request.userId);
        targetInterests = userInterests
          .sort((a, b) => b.interestStrength - a.interestStrength)
          .slice(0, 5)
          .map((ui) => ui.interestId);
      }

      // Find creators matching these interests
      const { data: suggestions, error } = await this.supabase
        .from('creator_interest_mapping')
        .select(
          `
          creator_id,
          interest_id,
          expertise_level,
          engagement_rate,
          creator_profiles(*)
        `
        )
        .in('interest_id', targetInterests)
        .gte('expertise_level', request.minExpertiseLevel || 0.3)
        .order('expertise_level', { ascending: false })
        .limit(request.maxSuggestions || 20);

      if (error) throw error;

      // Group by creator and calculate scores
      const creatorScores = new Map();
      suggestions.forEach((s: any) => {
        if (!creatorScores.has(s.creator_id)) {
          creatorScores.set(s.creator_id, {
            creatorId: s.creator_id,
            creatorProfile: this.mapCreatorProfile(s.creator_profiles),
            matchedInterests: [],
            totalScore: 0,
            interestCount: 0,
          });
        }

        const creator = creatorScores.get(s.creator_id);
        creator.matchedInterests.push({
          interestId: s.interest_id,
          interestName: 'Interest', // Would need to join with taxonomy
          expertiseLevel: s.expertise_level,
          userInterestStrength: 0.5, // Would need user interest data
        });
        creator.totalScore += s.expertise_level;
        creator.interestCount++;
      });

      // Calculate final scores and format response
      const finalSuggestions = Array.from(creatorScores.values())
        .map((creator) => ({
          ...creator,
          overallScore: creator.totalScore / creator.interestCount,
          explanations: [`Strong expertise in ${creator.interestCount} shared interests`],
        }))
        .sort((a, b) => b.overallScore - a.overallScore)
        .slice(0, request.maxSuggestions || 10);

      return {
        userId: request.userId,
        suggestions: finalSuggestions,
        totalSuggestions: finalSuggestions.length,
        processingTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      throw new CreatorRecommendationServiceError(
        'Failed to get interest-based suggestions',
        'suggestions',
        { request, error }
      );
    }
  }

  // ============================================================================
  // US-101: DISCOVERY INTERFACE FOR NEW CREATORS
  // ============================================================================

  /**
   * Start creator discovery session
   */
  async startDiscoverySession(
    userId: string,
    discoveryMethod: DiscoveryMethod
  ): Promise<CreatorDiscoverySession> {
    try {
      const { data, error } = await this.supabase
        .from('creator_discovery_sessions')
        .insert({
          user_id: userId,
          discovery_method: discoveryMethod,
          session_start: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return this.mapCreatorDiscoverySession(data);
    } catch (error) {
      throw new CreatorRecommendationServiceError('Failed to start discovery session', 'database', {
        userId,
        discoveryMethod,
        error,
      });
    }
  }

  /**
   * Discover new creators based on request parameters
   */
  async discoverCreators(request: CreatorDiscoveryRequest): Promise<CreatorDiscoveryResponse> {
    const startTime = Date.now();

    try {
      // Start discovery session
      const session = await this.startDiscoverySession(
        request.userId,
        request.discoveryMethod || DiscoveryMethod.RECOMMENDATIONS
      );

      let query = this.supabase.from('creator_profiles').select(`
          *,
          creator_interest_mapping(
            interest_id,
            expertise_level,
            interest_taxonomy(name, category)
          )
        `);

      // Apply filters
      if (request.categories?.length) {
        query = query.overlaps('content_categories', request.categories);
      }

      if (request.verificationStatus?.length) {
        query = query.in('verification_status', request.verificationStatus);
      }

      // Pagination
      const page = request.page || 1;
      const limit = request.limit || 20;
      const offset = (page - 1) * limit;

      query = query.range(offset, offset + limit - 1);

      // Sorting
      switch (request.sortBy) {
        case 'popularity':
          query = query.order('community_engagement_score', { ascending: false });
          break;
        case 'recent':
          query = query.order('created_at', { ascending: false });
          break;
        default:
          query = query.order('avg_content_quality', { ascending: false });
      }

      const { data: creators, error } = await query;
      if (error) throw error;

      // Format response
      const discoveryResults = creators.map((creator: any, index: number) => ({
        creatorId: creator.creator_id,
        creatorProfile: this.mapCreatorProfile(creator),
        discoveryScore: 1 - index * 0.05, // Simple scoring
        discoveryReasons: ['High quality content', 'Matches your interests'],
        personalizedRank: index + 1,
        recentContent: [], // Would need to fetch actual content
        isFollowing: false, // Would need to check follow status
        mutualConnections: 0,
        matchingInterests:
          creator.creator_interest_mapping
            ?.map((cim: any) => cim.interest_taxonomy?.name)
            .filter(Boolean) || [],
      }));

      return {
        sessionId: session.id,
        discoveryMethod: request.discoveryMethod || DiscoveryMethod.RECOMMENDATIONS,
        creators: discoveryResults,
        totalCreators: discoveryResults.length,
        currentPage: page,
        totalPages: Math.ceil(discoveryResults.length / limit),
        hasNextPage: discoveryResults.length === limit,
        algorithmUsed: 'content_quality',
        personalizedResults: request.usePersonalization || false,
        diversityScore: 0.8,
        processingTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      throw new CreatorRecommendationServiceError('Failed to discover creators', 'discovery', {
        request,
        error,
      });
    }
  }

  // ============================================================================
  // US-102: FOLLOW RECOMMENDATIONS
  // ============================================================================

  /**
   * Generate follow recommendations for a user
   */
  async getFollowRecommendations(
    request: FollowRecommendationRequest
  ): Promise<FollowRecommendationResponse> {
    const startTime = Date.now();

    try {
      const { data: recommendations, error } = await this.supabase.rpc(
        'get_creator_recommendations',
        {
          target_user: request.userId,
          algorithm: request.algorithm || 'hybrid',
          max_recommendations: request.maxRecommendations || 10,
          min_score: request.minScore || 0.3,
        }
      );

      if (error) throw error;

      // Batch-load all creator profiles in a single query (avoid N+1)
      const recommendedIds = recommendations.map((r: any) => r.recommended_creator_id);
      const { data: profiles } = await this.supabase
        .from('creator_profiles')
        .select('*')
        .in('creator_id', recommendedIds);
      const profileMap = new Map((profiles || []).map((p: any) => [p.creator_id, p]));

      // Format recommendations with detailed information
      const formattedRecommendations = recommendations.map((rec: any) => {
          const creatorProfile = profileMap.get(rec.recommended_creator_id) || null;

          return {
            recommendation: {
              id:
                rec.id ||
                `rec_${Date.now()}_${crypto.randomUUID().replace(/-/g, '').substring(0, 12)}`,
              userId: request.userId,
              recommendedCreatorId: rec.recommended_creator_id,
              algorithmUsed: request.algorithm || RecommendationAlgorithm.HYBRID,
              recommendationScore: rec.recommendation_score,
              confidenceLevel: 0.8,
              primaryReason: rec.primary_reason,
              secondaryReasons: rec.shared_interests || [],
              explanationFactors: {},
              sharedInterests: rec.shared_interests || [],
              topicSimilarityScore: rec.recommendation_score,
              contentStyleMatch: 0.7,
              mutualConnections: 0,
              socialDistance: 2,
              networkInfluenceScore: 0.5,
              recommendationContext: request.context || 'homepage',
              clickThroughRate: 0,
              conversionRate: 0,
              controlGroup: false,
              createdAt: new Date(),
            },
            creatorProfile: creatorProfile || {},
            scoringFactors: {
              interestAlignment: rec.recommendation_score,
              socialSignals: 0.3,
              contentQuality: creatorProfile?.avgContentQuality || 0.5,
              engagementPotential: creatorProfile?.communityEngagementScore || 0.5,
              novelty: 0.6,
            },
            explanations: {
              primary: rec.primary_reason,
              secondary: rec.shared_interests || [],
              confidence: rec.recommendation_score,
            },
            mutualConnections: [],
            recentContent: [],
          };
        })
      );

      return {
        userId: request.userId,
        context: request.context || 'homepage',
        recommendations: formattedRecommendations,
        totalRecommendations: formattedRecommendations.length,
        algorithmUsed: request.algorithm || RecommendationAlgorithm.HYBRID,
        personalizationScore: 0.8,
        diversityAchieved: 0.7,
        processingTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      throw new CreatorRecommendationServiceError(
        'Failed to get follow recommendations',
        'recommendations',
        { request, error }
      );
    }
  }

  /**
   * Track follow relationship
   */
  async trackFollowRelationship(
    followerId: string,
    followingId: string,
    followSource: string,
    recommendationId?: string
  ): Promise<FollowRelationship> {
    try {
      const { data, error } = await this.supabase
        .from('follow_relationships')
        .insert({
          follower_id: followerId,
          following_id: followingId,
          follow_source: followSource,
          recommendation_id: recommendationId,
          followed_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return this.mapFollowRelationship(data);
    } catch (error) {
      throw new CreatorRecommendationServiceError(
        'Failed to track follow relationship',
        'database',
        { followerId, followingId, error }
      );
    }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private mapCreatorProfile(data: any): CreatorProfile {
    return {
      id: data.id,
      creatorId: data.creator_id,
      bio: data.bio,
      expertiseAreas: data.expertise_areas || [],
      contentCategories: data.content_categories || [],
      primaryTopics: data.primary_topics || [],
      contentStyle: data.content_style,
      audienceLevel: data.audience_level,
      postingFrequency: data.posting_frequency,
      avgContentQuality: data.avg_content_quality || 0,
      communityEngagementScore: data.community_engagement_score || 0,
      followerGrowthRate: data.follower_growth_rate || 0,
      collaborationNetwork: data.collaboration_network || {},
      influenceScore: data.influence_score || 0,
      activeHours: data.active_hours || {},
      activeDays: data.active_days || {},
      contentPublishingPattern: data.content_publishing_pattern || {},
      verificationStatus: data.verification_status,
      trustScore: data.trust_score || 0.5,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      lastAnalyzedAt: data.last_analyzed_at ? new Date(data.last_analyzed_at) : undefined,
    };
  }

  private mapInterestTaxonomy(data: any): InterestTaxonomy {
    return {
      id: data.id,
      name: data.name,
      slug: data.slug,
      description: data.description,
      parentId: data.parent_id,
      level: data.level,
      path: data.path,
      category: data.category,
      keywords: data.keywords || [],
      synonyms: data.synonyms || [],
      relatedInterests: data.related_interests || [],
      semanticClusterId: data.semantic_cluster_id,
      followerCount: data.follower_count || 0,
      contentCount: data.content_count || 0,
      engagementScore: data.engagement_score || 0,
      trendingScore: data.trending_score || 0,
      isActive: data.is_active,
      isFeatured: data.is_featured,
      displayOrder: data.display_order || 0,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }

  private mapUserInterestMapping(data: any): UserInterestMapping {
    return {
      id: data.id,
      userId: data.user_id,
      interestId: data.interest_id,
      interestStrength: data.interest_strength,
      confidenceScore: data.confidence_score,
      source: data.source,
      learningIterations: data.learning_iterations || 0,
      lastEngagementAt: data.last_engagement_at ? new Date(data.last_engagement_at) : undefined,
      engagementCount: data.engagement_count || 0,
      interestDecayRate: data.interest_decay_rate || 0.1,
      seasonalVariance: data.seasonal_variance || {},
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }

  private mapCreatorDiscoverySession(data: any): CreatorDiscoverySession {
    return {
      id: data.id,
      userId: data.user_id,
      sessionStart: new Date(data.session_start),
      sessionEnd: data.session_end ? new Date(data.session_end) : undefined,
      discoveryMethod: data.discovery_method,
      searchQuery: data.search_query,
      selectedCategories: data.selected_categories || [],
      filtersApplied: data.filters_applied || {},
      creatorsViewed: data.creators_viewed || 0,
      creatorsClicked: data.creators_clicked || 0,
      creatorsFollowed: data.creators_followed || 0,
      timeSpentSeconds: data.time_spent_seconds || 0,
      personalizationAlgorithm: data.personalization_algorithm,
      recommendationConfidence: data.recommendation_confidence || 0.5,
      diversityScore: data.diversity_score || 0.5,
      sessionSatisfaction: data.session_satisfaction,
      feedbackComments: data.feedback_comments,
      deviceType: data.device_type,
      platform: data.platform,
      referrerSource: data.referrer_source,
      updatedAt: new Date(data.updated_at),
    };
  }

  private mapFollowRelationship(data: any): FollowRelationship {
    return {
      id: data.id,
      followerId: data.follower_id,
      followingId: data.following_id,
      followedAt: new Date(data.followed_at),
      followSource: data.follow_source,
      recommendationId: data.recommendation_id,
      engagementScore: data.engagement_score || 0,
      interactionFrequency: data.interaction_frequency || 0,
      contentConsumptionRate: data.content_consumption_rate || 0,
      daysRemainedFollowed: data.days_remained_followed || 0,
      unfollowedAt: data.unfollowed_at ? new Date(data.unfollowed_at) : undefined,
      unfollowReason: data.unfollow_reason,
      influencedAdditionalFollows: data.influenced_additional_follows || 0,
      recommendationSuccessScore: data.recommendation_success_score || 0,
      lastInteractionAt: data.last_interaction_at ? new Date(data.last_interaction_at) : undefined,
      updatedAt: new Date(data.updated_at),
    };
  }
}
