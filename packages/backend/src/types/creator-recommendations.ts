/**
 * 🎭 CREATOR RECOMMENDATIONS TYPES
 * Elite TypeScript type definitions for AI-powered creator recommendations
 * Part of US-099 through US-102 implementation
 *
 * @fileoverview Comprehensive type system for creator discovery and recommendation features
 * @version 1.0.0
 * @author Sovren Team
 */

// ============================================================================
// CORE TYPES AND ENUMS
// ============================================================================

/**
 * Content style categories for creator classification
 */
export enum ContentStyle {
  EDUCATIONAL = 'educational',
  ENTERTAINMENT = 'entertainment',
  INFORMATIONAL = 'informational',
  INSPIRATIONAL = 'inspirational',
  MIXED = 'mixed',
}

/**
 * Audience skill/experience levels
 */
export enum AudienceLevel {
  BEGINNER = 'beginner',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced',
  EXPERT = 'expert',
}

/**
 * Content posting frequency patterns
 */
export enum PostingFrequency {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  BIWEEKLY = 'biweekly',
  MONTHLY = 'monthly',
  IRREGULAR = 'irregular',
}

/**
 * Creator verification status levels
 */
export enum VerificationStatus {
  UNVERIFIED = 'unverified',
  VERIFIED = 'verified',
  FEATURED = 'featured',
  SPONSORED = 'sponsored',
}

/**
 * Interest source types for user-interest mapping
 */
export enum InterestSource {
  EXPLICIT = 'explicit', // User explicitly selected
  BEHAVIORAL = 'behavioral', // Inferred from behavior
  INFERRED = 'inferred', // ML inference
  COLLABORATIVE = 'collaborative', // Based on similar users
}

/**
 * Creator discovery methods
 */
export enum DiscoveryMethod {
  BROWSE = 'browse',
  SEARCH = 'search',
  RECOMMENDATIONS = 'recommendations',
  TRENDING = 'trending',
  CATEGORIES = 'categories',
  RANDOM = 'random',
}

/**
 * Recommendation algorithms available
 */
export enum RecommendationAlgorithm {
  COLLABORATIVE_FILTERING = 'collaborative_filtering',
  CONTENT_BASED = 'content_based',
  SOCIAL_NETWORK = 'social_network',
  HYBRID = 'hybrid',
  TRENDING = 'trending',
  ONBOARDING = 'onboarding',
}

/**
 * Follow source tracking
 */
export enum FollowSource {
  RECOMMENDATION = 'recommendation',
  SEARCH = 'search',
  PROFILE_VISIT = 'profile_visit',
  DISCOVERY = 'discovery',
  MANUAL = 'manual',
}

// ============================================================================
// US-099: CREATOR MATCHING BASED ON INTERESTS
// ============================================================================

/**
 * Creator profile for interest-based matching
 */
export interface CreatorProfile {
  id: string;
  creatorId: string;

  // Profile Information
  bio?: string;
  expertiseAreas: string[];
  contentCategories: string[];
  primaryTopics: string[];

  // Creator Characteristics
  contentStyle: ContentStyle;
  audienceLevel: AudienceLevel;
  postingFrequency: PostingFrequency;

  // Engagement Metrics
  avgContentQuality: number; // 0-5 scale
  communityEngagementScore: number; // 0-1 scale
  followerGrowthRate: number;

  // Creator Embeddings (for similarity matching)
  profileEmbedding?: number[];
  contentStyleEmbedding?: number[];
  topicEmbedding?: number[];

  // Social Network Analysis
  collaborationNetwork: Record<string, any>;
  influenceScore: number; // 0-1 scale

  // Creator Activity Patterns
  activeHours: Record<string, number>; // hour -> activity level
  activeDays: Record<string, number>; // day -> activity level
  contentPublishingPattern: Record<string, any>;

  // Verification and Trust
  verificationStatus: VerificationStatus;
  trustScore: number; // 0-1 scale

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  lastAnalyzedAt?: Date;
}

/**
 * Creator profile creation/update request
 */
export interface CreatorProfileRequest {
  bio?: string;
  expertiseAreas?: string[];
  contentCategories?: string[];
  primaryTopics?: string[];
  contentStyle?: ContentStyle;
  audienceLevel?: AudienceLevel;
  postingFrequency?: PostingFrequency;
}

/**
 * Creator profile analytics
 */
export interface CreatorProfileAnalytics {
  profileViews: number;
  profileClicks: number;
  discoveryRank: number;
  recommendationFrequency: number;
  engagementTrends: Record<string, number>;
  topicPerformance: Record<string, number>;
}

/**
 * Creator similarity calculation result
 */
export interface CreatorSimilarity {
  id: string;
  creatorAId: string;
  creatorBId: string;

  // Similarity Scores
  overallSimilarity: number; // 0-1 scale
  contentSimilarity: number;
  styleSimilarity: number;
  audienceSimilarity: number;
  topicSimilarity: number;
  engagementPatternSimilarity: number;

  // Similarity Explanations
  similarityFactors: string[];
  sharedTopics: string[];
  sharedAudienceInterests: string[];

  // Machine Learning Features
  featureVectorDistance?: number;
  embeddingCosineSimilarity?: number;

  // Calculation Metadata
  calculationMethod: string;
  confidenceScore: number;
  calculationVersion: string;

  // Timestamps
  calculatedAt: Date;
  lastUpdatedAt: Date;
}

/**
 * Creator matching request parameters
 */
export interface CreatorMatchingRequest {
  targetCreatorId: string;
  maxMatches?: number;
  minSimilarityThreshold?: number;
  includeExplanations?: boolean;
  weightFactors?: {
    content?: number;
    style?: number;
    audience?: number;
    topic?: number;
    engagement?: number;
  };
}

/**
 * Creator matching response
 */
export interface CreatorMatchingResponse {
  targetCreatorId: string;
  matches: Array<{
    creatorId: string;
    creatorProfile: Partial<CreatorProfile>;
    similarity: CreatorSimilarity;
    matchReasons: string[];
    confidenceScore: number;
  }>;
  totalMatches: number;
  processingTimeMs: number;
}

// ============================================================================
// US-100: INTEREST-BASED CREATOR SUGGESTIONS
// ============================================================================

/**
 * Interest taxonomy for hierarchical interest organization
 */
export interface InterestTaxonomy {
  id: string;

  // Taxonomy Structure
  name: string;
  slug: string;
  description?: string;
  parentId?: string;
  level: number; // 0-5 hierarchy depth
  path?: string; // Materialized path

  // Interest Characteristics
  category?: string; // technology, arts, business, etc.
  keywords: string[];
  synonyms: string[];
  relatedInterests: string[];

  // Machine Learning Features
  interestEmbedding?: number[];
  semanticClusterId?: string;

  // Popularity and Trends
  followerCount: number;
  contentCount: number;
  engagementScore: number;
  trendingScore: number;

  // Metadata
  isActive: boolean;
  isFeatured: boolean;
  displayOrder: number;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

/**
 * User interest mapping with learning capabilities
 */
export interface UserInterestMapping {
  id: string;
  userId: string;
  interestId: string;

  // Interest Strength and Source
  interestStrength: number; // 0-1 scale
  confidenceScore: number; // 0-1 scale
  source: InterestSource;

  // Learning and Adaptation
  learningIterations: number;
  lastEngagementAt?: Date;
  engagementCount: number;

  // Temporal Dynamics
  interestDecayRate: number; // 0-1 scale
  seasonalVariance: Record<string, any>;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Creator interest mapping with expertise levels
 */
export interface CreatorInterestMapping {
  id: string;
  creatorId: string;
  interestId: string;

  // Creator-Interest Relationship
  expertiseLevel: number; // 0-1 scale
  contentVolumeScore: number; // 0-1 scale
  audienceAlignmentScore: number; // 0-1 scale

  // Performance Metrics
  engagementRate: number;
  contentQualityScore: number;
  followerInterestOverlap: number;

  // Content Analysis
  primaryContentType?: string; // article, video, podcast, course
  contentFrequency: number; // posts per month
  lastContentPublishedAt?: Date;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Interest-based creator suggestion request
 */
export interface InterestBasedSuggestionRequest {
  userId: string;
  interestIds?: string[]; // Specific interests to focus on
  maxSuggestions?: number;
  minExpertiseLevel?: number;
  contentTypes?: string[];
  excludeFollowed?: boolean;
  diversityWeight?: number; // 0-1 scale for result diversity
}

/**
 * Interest-based creator suggestion response
 */
export interface InterestBasedSuggestionResponse {
  userId: string;
  suggestions: Array<{
    creatorId: string;
    creatorProfile: Partial<CreatorProfile>;
    matchedInterests: Array<{
      interestId: string;
      interestName: string;
      expertiseLevel: number;
      userInterestStrength: number;
    }>;
    overallScore: number;
    explanations: string[];
  }>;
  totalSuggestions: number;
  processingTimeMs: number;
}

/**
 * Interest exploration request
 */
export interface InterestExplorationRequest {
  userId: string;
  currentInterestId?: string;
  explorationDepth?: number; // How many levels to explore
  maxRelatedInterests?: number;
  includeCreatorSamples?: boolean;
}

/**
 * Interest exploration response
 */
export interface InterestExplorationResponse {
  currentInterest: InterestTaxonomy;
  relatedInterests: Array<{
    interest: InterestTaxonomy;
    relationshipType: string; // parent, child, sibling, semantic
    relationshipStrength: number;
    topCreators: Partial<CreatorProfile>[];
  }>;
  explorationPath: string[];
  suggestions: string[];
}

// ============================================================================
// US-101: DISCOVERY INTERFACE FOR NEW CREATORS
// ============================================================================

/**
 * Creator discovery session tracking
 */
export interface CreatorDiscoverySession {
  id: string;
  userId: string;

  // Session Details
  sessionStart: Date;
  sessionEnd?: Date;
  discoveryMethod: DiscoveryMethod;

  // Discovery Context
  searchQuery?: string;
  selectedCategories: string[];
  filtersApplied: Record<string, any>;

  // Session Metrics
  creatorsViewed: number;
  creatorsClicked: number;
  creatorsFollowed: number;
  timeSpentSeconds: number;

  // Personalization Data
  personalizationAlgorithm?: string;
  recommendationConfidence: number;
  diversityScore: number;

  // User Feedback
  sessionSatisfaction?: number; // 1-5 scale
  feedbackComments?: string;

  // Device and Context
  deviceType?: string;
  platform?: string;
  referrerSource?: string;

  // Timestamps
  updatedAt: Date;
}

/**
 * Creator discovery request parameters
 */
export interface CreatorDiscoveryRequest {
  userId: string;
  discoveryMethod?: DiscoveryMethod;

  // Search and Filtering
  searchQuery?: string;
  categories?: string[];
  interests?: string[];
  contentTypes?: string[];
  audienceLevel?: AudienceLevel;
  verificationStatus?: VerificationStatus[];

  // Personalization
  usePersonalization?: boolean;
  diversityWeight?: number; // 0-1 scale
  noveltyWeight?: number; // 0-1 scale

  // Pagination and Limits
  page?: number;
  limit?: number;
  sortBy?: 'relevance' | 'popularity' | 'recent' | 'engagement';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Creator discovery response
 */
export interface CreatorDiscoveryResponse {
  sessionId: string;
  discoveryMethod: DiscoveryMethod;

  // Discovery Results
  creators: Array<{
    creatorId: string;
    creatorProfile: Partial<CreatorProfile>;
    discoveryScore: number;
    discoveryReasons: string[];
    personalizedRank: number;

    // Preview Information
    recentContent: Array<{
      id: string;
      title: string;
      type: string;
      publishedAt: Date;
      engagementMetrics: Record<string, number>;
    }>;

    // Engagement Indicators
    isFollowing: boolean;
    mutualConnections: number;
    matchingInterests: string[];
  }>;

  // Pagination and Metadata
  totalCreators: number;
  currentPage: number;
  totalPages: number;
  hasNextPage: boolean;

  // Discovery Analytics
  algorithmUsed: string;
  personalizedResults: boolean;
  diversityScore: number;
  processingTimeMs: number;
}

/**
 * Creator discovery filters
 */
export interface CreatorDiscoveryFilters {
  categories?: string[];
  interests?: string[];
  contentTypes?: string[];
  audienceLevel?: AudienceLevel[];
  verificationStatus?: VerificationStatus[];
  contentStyle?: ContentStyle[];
  postingFrequency?: PostingFrequency[];

  // Engagement Filters
  minFollowerCount?: number;
  maxFollowerCount?: number;
  minEngagementScore?: number;
  minContentQuality?: number;

  // Activity Filters
  activeInLastDays?: number;
  hasRecentContent?: boolean;
  minContentCount?: number;

  // Geographic and Language
  languages?: string[];
  regions?: string[];
  timeZones?: string[];
}

/**
 * Creator discovery analytics
 */
export interface CreatorDiscoveryAnalytics {
  sessionId: string;
  userId: string;

  // Discovery Performance
  algorithmsUsed: string[];
  totalCreatorsShown: number;
  uniqueCreatorsShown: number;
  clickThroughRate: number;
  followConversionRate: number;

  // User Engagement
  averageTimePerCreator: number;
  averageScrollDepth: number;
  filterUsageCount: number;
  searchRefinements: number;

  // Content Performance
  topPerformingCategories: Array<{
    category: string;
    clickRate: number;
    followRate: number;
  }>;

  // Personalization Effectiveness
  personalizationScore: number;
  diversityAchieved: number;
  noveltyAchieved: number;
}

// ============================================================================
// US-102: FOLLOW RECOMMENDATIONS
// ============================================================================

/**
 * Creator recommendation with detailed scoring
 */
export interface CreatorRecommendation {
  id: string;
  userId: string;
  recommendedCreatorId: string;

  // Recommendation Algorithm and Scoring
  algorithmUsed: RecommendationAlgorithm;
  recommendationScore: number; // 0-1 scale
  confidenceLevel: number; // 0-1 scale

  // Recommendation Reasons
  primaryReason: string;
  secondaryReasons: string[];
  explanationFactors: Record<string, any>;

  // Interest and Topic Alignment
  sharedInterests: string[];
  topicSimilarityScore: number;
  contentStyleMatch: number;

  // Social Network Factors
  mutualConnections: number;
  socialDistance: number; // degrees of separation
  networkInfluenceScore: number;

  // Timing and Context
  recommendationContext: string; // onboarding, homepage, search, profile_view
  optimalPresentationTime?: Date;
  expiresAt?: Date;

  // User Interaction Tracking
  presentedAt?: Date;
  viewedAt?: Date;
  clickedAt?: Date;
  followedAt?: Date;
  dismissedAt?: Date;

  // Performance Metrics
  positionInList?: number;
  clickThroughRate: number;
  conversionRate: number;

  // A/B Testing
  experimentId?: string;
  controlGroup: boolean;

  // Timestamps
  createdAt: Date;
}

/**
 * Follow relationship tracking with analytics
 */
export interface FollowRelationship {
  id: string;
  followerId: string;
  followingId: string;

  // Follow Details
  followedAt: Date;
  followSource: FollowSource;
  recommendationId?: string;

  // Relationship Metrics
  engagementScore: number; // 0-1 scale
  interactionFrequency: number;
  contentConsumptionRate: number;

  // Follow Success Indicators
  daysRemainedFollowed: number;
  unfollowedAt?: Date;
  unfollowReason?: string;

  // Network Effect Tracking
  influencedAdditionalFollows: number;
  recommendationSuccessScore: number;

  // Timestamps
  lastInteractionAt?: Date;
  updatedAt: Date;
}

/**
 * Follow recommendation request
 */
export interface FollowRecommendationRequest {
  userId: string;
  context?: string; // onboarding, homepage, search, etc.
  algorithm?: RecommendationAlgorithm;

  // Recommendation Parameters
  maxRecommendations?: number;
  minScore?: number;
  includeExplanations?: boolean;
  diversityWeight?: number;

  // Filtering Options
  excludeRecentlyDismissed?: boolean;
  excludeRecentInteractions?: boolean;
  requireMutualInterests?: boolean;

  // Social Network Parameters
  maxSocialDistance?: number;
  minMutualConnections?: number;
  weightSocialSignals?: number;
}

/**
 * Follow recommendation response
 */
export interface FollowRecommendationResponse {
  userId: string;
  context: string;

  // Recommendations
  recommendations: Array<{
    recommendation: CreatorRecommendation;
    creatorProfile: Partial<CreatorProfile>;

    // Detailed Scoring Breakdown
    scoringFactors: {
      interestAlignment: number;
      socialSignals: number;
      contentQuality: number;
      engagementPotential: number;
      novelty: number;
    };

    // Explanation Details
    explanations: {
      primary: string;
      secondary: string[];
      confidence: number;
    };

    // Social Context
    mutualConnections: Array<{
      userId: string;
      username: string;
      relationship: string;
    }>;

    // Content Preview
    recentContent: Array<{
      id: string;
      title: string;
      type: string;
      engagementScore: number;
    }>;
  }>;

  // Response Metadata
  totalRecommendations: number;
  algorithmUsed: RecommendationAlgorithm;
  personalizationScore: number;
  diversityAchieved: number;
  processingTimeMs: number;
}

/**
 * Follow recommendation feedback
 */
export interface FollowRecommendationFeedback {
  recommendationId: string;
  userId: string;

  // Interaction Type
  interactionType: 'viewed' | 'clicked' | 'followed' | 'dismissed' | 'hidden';
  interactionAt: Date;

  // User Feedback
  satisfactionRating?: number; // 1-5 scale
  feedbackReason?: string;
  improvementSuggestions?: string;

  // Context Information
  deviceType?: string;
  sessionId?: string;
  timeSpentViewing?: number; // seconds
}

/**
 * Follow recommendation analytics aggregated data
 */
export interface FollowRecommendationAnalytics {
  id: string;

  // Time Period
  datePeriod: Date;
  hourPeriod?: number; // 0-23

  // Algorithm Performance
  algorithmName: RecommendationAlgorithm;
  totalRecommendations: number;
  totalPresentations: number;
  totalClicks: number;
  totalFollows: number;

  // Success Metrics
  clickThroughRate: number;
  followConversionRate: number;
  averageRecommendationScore: number;

  // User Engagement
  uniqueUsersServed: number;
  avgRecommendationsPerUser: number;
  userSatisfactionScore: number;

  // Creator Impact
  uniqueCreatorsRecommended: number;
  newCreatorsDiscovered: number;
  creatorsWithSuccessfulRecommendations: number;

  // Quality Metrics
  diversityScore: number;
  noveltyScore: number;
  relevanceScore: number;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// REQUEST/RESPONSE TYPES AND ERROR HANDLING
// ============================================================================

/**
 * Generic API response wrapper for creator recommendations
 */
export interface CreatorRecommendationApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
  metadata: {
    timestamp: Date;
    requestId: string;
    processingTimeMs: number;
    version: string;
  };
}

/**
 * Paginated response for creator lists
 */
export interface PaginatedCreatorResponse<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
  filters?: CreatorDiscoveryFilters;
  sorting?: {
    field: string;
    order: 'asc' | 'desc';
  };
}

/**
 * Creator recommendation system configuration
 */
export interface CreatorRecommendationConfig {
  // Algorithm Weights
  algorithmWeights: {
    collaborative: number;
    contentBased: number;
    socialNetwork: number;
    trending: number;
  };

  // Recommendation Limits
  maxRecommendationsPerUser: number;
  maxRecommendationsPerContext: number;
  recommendationExpirationHours: number;

  // Quality Thresholds
  minRecommendationScore: number;
  minCreatorTrustScore: number;
  minInterestStrength: number;

  // Diversity Settings
  diversityWeight: number;
  noveltyWeight: number;
  maxSimilarCreatorsInSet: number;

  // Performance Settings
  cacheExpirationMinutes: number;
  batchProcessingSize: number;
  maxProcessingTimeMs: number;

  // A/B Testing
  experimentalAlgorithms: string[];
  trafficSplitPercentage: number;
}

/**
 * Creator recommendation errors
 */
export class CreatorRecommendationError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'CreatorRecommendationError';
  }
}

/**
 * Creator recommendation validation errors
 */
export class CreatorRecommendationValidationError extends CreatorRecommendationError {
  constructor(
    message: string,
    public field: string,
    public value: any,
    details?: Record<string, any>
  ) {
    super(message, 'VALIDATION_ERROR', 400, details);
    this.name = 'CreatorRecommendationValidationError';
  }
}

/**
 * Creator recommendation service unavailable errors
 */
export class CreatorRecommendationServiceError extends CreatorRecommendationError {
  constructor(
    message: string,
    public service: string,
    details?: Record<string, any>
  ) {
    super(message, 'SERVICE_ERROR', 503, details);
    this.name = 'CreatorRecommendationServiceError';
  }
}

// ============================================================================
// UTILITY TYPES AND HELPERS
// ============================================================================

/**
 * Utility type for partial creator recommendation updates
 */
export type PartialCreatorRecommendationUpdate = Partial<
  Pick<
    CreatorRecommendation,
    | 'recommendationScore'
    | 'confidenceLevel'
    | 'primaryReason'
    | 'secondaryReasons'
    | 'explanationFactors'
    | 'expiresAt'
  >
>;

/**
 * Utility type for creator profile summary
 */
export type CreatorProfileSummary = Pick<
  CreatorProfile,
  | 'id'
  | 'creatorId'
  | 'primaryTopics'
  | 'contentStyle'
  | 'audienceLevel'
  | 'avgContentQuality'
  | 'communityEngagementScore'
  | 'verificationStatus'
  | 'trustScore'
>;

/**
 * Utility type for interest summary
 */
export type InterestSummary = Pick<
  InterestTaxonomy,
  | 'id'
  | 'name'
  | 'slug'
  | 'category'
  | 'level'
  | 'followerCount'
  | 'trendingScore'
  | 'isActive'
  | 'isFeatured'
>;

/**
 * Type guard for creator recommendation responses
 */
export function isCreatorRecommendationResponse(
  obj: any
): obj is CreatorRecommendationApiResponse<any> {
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.success === 'boolean' &&
    obj.metadata &&
    typeof obj.metadata.timestamp !== 'undefined' &&
    typeof obj.metadata.requestId === 'string'
  );
}

/**
 * Type guard for valid recommendation algorithms
 */
export function isValidRecommendationAlgorithm(
  algorithm: string
): algorithm is RecommendationAlgorithm {
  return Object.values(RecommendationAlgorithm).includes(algorithm as RecommendationAlgorithm);
}

/**
 * Default configuration values
 */
export const DEFAULT_CREATOR_RECOMMENDATION_CONFIG: CreatorRecommendationConfig = {
  algorithmWeights: {
    collaborative: 0.3,
    contentBased: 0.4,
    socialNetwork: 0.2,
    trending: 0.1,
  },
  maxRecommendationsPerUser: 50,
  maxRecommendationsPerContext: 10,
  recommendationExpirationHours: 24,
  minRecommendationScore: 0.3,
  minCreatorTrustScore: 0.5,
  minInterestStrength: 0.2,
  diversityWeight: 0.3,
  noveltyWeight: 0.2,
  maxSimilarCreatorsInSet: 3,
  cacheExpirationMinutes: 30,
  batchProcessingSize: 100,
  maxProcessingTimeMs: 5000,
  experimentalAlgorithms: [],
  trafficSplitPercentage: 0.1,
};
