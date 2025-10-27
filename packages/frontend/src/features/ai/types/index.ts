// 🤖 AI Content Recommendations Types
// Implementation of US-095 through US-098: Complete AI recommendation system

import { z } from 'zod';

// =====================================================
// US-095: PERSONALIZED CONTENT RECOMMENDATIONS TYPES
// =====================================================

export const UserInteractionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  contentId: z.string(),
  type: z.enum(['view', 'like', 'share', 'comment', 'save', 'click', 'hover', 'scroll']),
  timestamp: z.date(),
  duration: z.number().optional(), // Duration in seconds
  intensity: z.number().min(0).max(1), // Interaction intensity score
  context: z.object({
    source: z.string(), // Where the interaction occurred
    device: z.string(),
    sessionId: z.string(),
    referrer: z.string().optional(),
  }),
  metadata: z.record(z.any()).optional(),
});

export const UserPreferenceSchema = z.object({
  userId: z.string(),
  categories: z.array(z.string()),
  topics: z.array(z.string()),
  contentTypes: z.array(z.enum(['article', 'video', 'audio', 'image', 'live', 'course'])),
  creators: z.array(z.string()),
  tags: z.array(z.string()),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced', 'expert']).optional(),
  length: z.enum(['short', 'medium', 'long', 'any']).optional(),
  lastUpdated: z.date(),
  confidence: z.number().min(0).max(1), // How confident we are in these preferences
  isExplicit: z.boolean(), // Whether user explicitly set these or inferred
});

export const ContentRecommendationSchema = z.object({
  id: z.string(),
  userId: z.string(),
  contentId: z.string(),
  title: z.string(),
  description: z.string().optional(),
  thumbnailUrl: z.string().optional(),
  contentType: z.enum(['article', 'video', 'audio', 'image', 'live', 'course']),
  creatorId: z.string(),
  creatorName: z.string(),
  category: z.string(),
  tags: z.array(z.string()),
  relevanceScore: z.number().min(0).max(1),
  confidenceScore: z.number().min(0).max(1),
  reason: z.string(), // Explanation for why recommended
  algorithm: z.string(), // Which algorithm generated this
  generatedAt: z.date(),
  expiresAt: z.date(),
  metadata: z.object({
    estimatedReadTime: z.number().optional(),
    difficulty: z.string().optional(),
    isPremium: z.boolean().default(false),
    publishedAt: z.date(),
    viewCount: z.number().default(0),
    engagementRate: z.number().min(0).max(1).optional(),
  }),
});

export const RecommendationAlgorithmSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.string(),
  type: z.enum(['collaborative', 'content-based', 'hybrid', 'behavioral', 'trending']),
  accuracy: z.number().min(0).max(1),
  precision: z.number().min(0).max(1),
  recall: z.number().min(0).max(1),
  isActive: z.boolean(),
  weight: z.number().min(0).max(1), // Weight in ensemble
  parameters: z.record(z.any()),
  lastTrained: z.date(),
  performance: z.object({
    clickThroughRate: z.number().min(0).max(1),
    conversionRate: z.number().min(0).max(1),
    engagementRate: z.number().min(0).max(1),
    diversityScore: z.number().min(0).max(1),
  }),
});

// =====================================================
// US-096: BEHAVIORAL RECOMMENDATIONS TYPES
// =====================================================

export const BehaviorPatternSchema = z.object({
  userId: z.string(),
  sessionId: z.string(),
  patterns: z.object({
    browsingPattern: z.enum(['explorer', 'focused', 'casual', 'researcher']),
    engagementStyle: z.enum(['quick', 'deep', 'social', 'passive']),
    contentConsumption: z.enum(['binge', 'regular', 'occasional', 'sporadic']),
    timePreference: z.enum(['morning', 'afternoon', 'evening', 'night', 'varied']),
    devicePreference: z.enum(['mobile', 'desktop', 'tablet', 'mixed']),
  }),
  metrics: z.object({
    avgSessionDuration: z.number(),
    avgContentTime: z.number(),
    interactionFrequency: z.number(),
    scrollVelocity: z.number(),
    clickPatterns: z.array(z.number()),
    returnFrequency: z.number(),
  }),
  preferences: z.object({
    categoryAffinity: z.record(z.number()),
    creatorAffinity: z.record(z.number()),
    topicInterest: z.record(z.number()),
    contentTypePreference: z.record(z.number()),
  }),
  confidence: z.number().min(0).max(1),
  lastUpdated: z.date(),
  sampleSize: z.number(), // Number of interactions used to build pattern
});

export const AdaptiveModelSchema = z.object({
  id: z.string(),
  userId: z.string(),
  modelType: z.enum(['neural', 'ensemble', 'decision_tree', 'gradient_boost']),
  parameters: z.record(z.any()),
  weights: z.array(z.number()),
  performance: z.object({
    accuracy: z.number().min(0).max(1),
    precision: z.number().min(0).max(1),
    recall: z.number().min(0).max(1),
    f1Score: z.number().min(0).max(1),
  }),
  trainingData: z.object({
    size: z.number(),
    lastUpdate: z.date(),
    features: z.array(z.string()),
    labels: z.array(z.string()),
  }),
  version: z.string(),
  isPersonalized: z.boolean(),
  createdAt: z.date(),
  lastTrained: z.date(),
});

// =====================================================
// US-097: CONTENT SIMILARITY ANALYSIS TYPES
// =====================================================

export const ContentFeatureSchema = z.object({
  contentId: z.string(),
  features: z.object({
    textual: z.object({
      keywords: z.array(z.string()),
      topics: z.array(z.string()),
      sentiment: z.number().min(-1).max(1),
      readability: z.number().min(0).max(100),
      complexity: z.number().min(0).max(1),
      wordCount: z.number(),
      language: z.string(),
    }),
    visual: z
      .object({
        hasImages: z.boolean(),
        hasVideos: z.boolean(),
        colorPalette: z.array(z.string()).optional(),
        visualComplexity: z.number().min(0).max(1).optional(),
      })
      .optional(),
    metadata: z.object({
      category: z.string(),
      tags: z.array(z.string()),
      difficulty: z.string(),
      duration: z.number().optional(),
      format: z.string(),
    }),
    engagement: z.object({
      viewCount: z.number(),
      likeCount: z.number(),
      shareCount: z.number(),
      commentCount: z.number(),
      averageRating: z.number().min(0).max(5),
      engagementRate: z.number().min(0).max(1),
    }),
  }),
  vector: z.array(z.number()), // Feature vector for similarity calculations
  lastUpdated: z.date(),
});

export const SimilarityScoreSchema = z.object({
  sourceContentId: z.string(),
  targetContentId: z.string(),
  similarityScore: z.number().min(0).max(1),
  similarityType: z.enum(['textual', 'topical', 'behavioral', 'collaborative', 'hybrid']),
  components: z.object({
    contentSimilarity: z.number().min(0).max(1),
    topicSimilarity: z.number().min(0).max(1),
    styleSimilarity: z.number().min(0).max(1),
    engagementSimilarity: z.number().min(0).max(1),
  }),
  confidence: z.number().min(0).max(1),
  computedAt: z.date(),
  algorithm: z.string(),
});

export const ContentClusterSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  contentIds: z.array(z.string()),
  centroid: z.array(z.number()), // Cluster center in feature space
  characteristics: z.object({
    dominantTopics: z.array(z.string()),
    avgEngagement: z.number(),
    avgDifficulty: z.number(),
    commonTags: z.array(z.string()),
  }),
  quality: z.object({
    cohesion: z.number().min(0).max(1), // How similar items in cluster are
    separation: z.number().min(0).max(1), // How different from other clusters
    silhouetteScore: z.number().min(-1).max(1),
  }),
  size: z.number(),
  createdAt: z.date(),
  lastUpdated: z.date(),
});

// =====================================================
// US-098: RECOMMENDATION FEEDBACK TYPES
// =====================================================

export const RecommendationFeedbackSchema = z.object({
  id: z.string(),
  userId: z.string(),
  recommendationId: z.string(),
  contentId: z.string(),
  feedbackType: z.enum(['explicit', 'implicit']),
  rating: z.number().min(1).max(5).optional(), // Explicit rating
  action: z.enum(['like', 'dislike', 'save', 'share', 'click', 'ignore', 'hide', 'report']),
  relevanceScore: z.number().min(0).max(1).optional(), // User's assessment of relevance
  satisfaction: z.number().min(0).max(1).optional(), // Overall satisfaction
  reason: z.string().optional(), // Why they liked/disliked
  context: z.object({
    timeSpent: z.number().optional(), // Time spent with recommended content
    didComplete: z.boolean().optional(), // Did they finish consuming content
    sharedTo: z.array(z.string()).optional(), // Where they shared it
    timestamp: z.date(),
    sessionId: z.string(),
  }),
  metadata: z.record(z.any()).optional(),
});

export const FeedbackAnalyticsSchema = z.object({
  userId: z.string(),
  period: z.enum(['day', 'week', 'month', 'quarter']),
  metrics: z.object({
    totalRecommendations: z.number(),
    totalFeedback: z.number(),
    feedbackRate: z.number().min(0).max(1),
    avgRating: z.number().min(1).max(5),
    satisfactionScore: z.number().min(0).max(1),
    clickThroughRate: z.number().min(0).max(1),
    conversionRate: z.number().min(0).max(1),
  }),
  distribution: z.object({
    ratingDistribution: z.record(z.number()), // 1-5 star distribution
    actionDistribution: z.record(z.number()), // Action type distribution
    categoryPerformance: z.record(z.number()), // Performance by category
    algorithmPerformance: z.record(z.number()), // Performance by algorithm
  }),
  trends: z.object({
    ratingTrend: z.array(z.number()),
    engagementTrend: z.array(z.number()),
    diversityTrend: z.array(z.number()),
  }),
  generatedAt: z.date(),
});

export const ModelUpdateEventSchema = z.object({
  id: z.string(),
  modelId: z.string(),
  updateType: z.enum(['feedback', 'batch', 'online', 'manual']),
  trigger: z.string(), // What triggered the update
  changes: z.object({
    parametersChanged: z.array(z.string()),
    weightsAdjusted: z.boolean(),
    featuresAdded: z.array(z.string()),
    featuresRemoved: z.array(z.string()),
  }),
  performance: z.object({
    beforeUpdate: z.record(z.number()),
    afterUpdate: z.record(z.number()),
    improvement: z.record(z.number()),
  }),
  feedbackIncorporated: z.number(), // Number of feedback items used
  timestamp: z.date(),
  duration: z.number(), // Update duration in milliseconds
});

// =====================================================
// COMBINED SYSTEM TYPES
// =====================================================

export const AIRecommendationSystemSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.string(),
  algorithms: z.array(RecommendationAlgorithmSchema),
  isOnline: z.boolean(),
  performance: z.object({
    overallAccuracy: z.number().min(0).max(1),
    avgResponseTime: z.number(), // milliseconds
    throughput: z.number(), // recommendations per second
    uptime: z.number().min(0).max(1),
  }),
  configuration: z.object({
    maxRecommendations: z.number(),
    diversityThreshold: z.number().min(0).max(1),
    freshnessWeight: z.number().min(0).max(1),
    popularityWeight: z.number().min(0).max(1),
    personalizedWeight: z.number().min(0).max(1),
  }),
  lastUpdated: z.date(),
});

export const RecommendationRequestSchema = z.object({
  userId: z.string(),
  context: z.object({
    currentContent: z.string().optional(),
    sessionId: z.string(),
    device: z.string(),
    location: z.string().optional(),
    timeOfDay: z.string(),
  }),
  preferences: z.object({
    maxResults: z.number().default(10),
    categories: z.array(z.string()).optional(),
    excludeContent: z.array(z.string()).optional(),
    includePremium: z.boolean().default(true),
    diversityLevel: z.number().min(0).max(1).default(0.3),
  }),
  algorithm: z.string().optional(), // Force specific algorithm
});

export const RecommendationResponseSchema = z.object({
  userId: z.string(),
  recommendations: z.array(ContentRecommendationSchema),
  metadata: z.object({
    requestId: z.string(),
    algorithmUsed: z.string(),
    totalCandidates: z.number(),
    processingTime: z.number(),
    diversityScore: z.number().min(0).max(1),
    freshnessScore: z.number().min(0).max(1),
    personalizedScore: z.number().min(0).max(1),
  }),
  explanation: z.object({
    primaryFactors: z.array(z.string()),
    weights: z.record(z.number()),
    reasoning: z.string(),
  }),
  generatedAt: z.date(),
  expiresAt: z.date(),
});

// TypeScript types from Zod schemas
export type UserInteraction = z.infer<typeof UserInteractionSchema>;
export type UserPreference = z.infer<typeof UserPreferenceSchema>;
export type ContentRecommendation = z.infer<typeof ContentRecommendationSchema>;
export type RecommendationAlgorithm = z.infer<typeof RecommendationAlgorithmSchema>;
export type BehaviorPattern = z.infer<typeof BehaviorPatternSchema>;
export type AdaptiveModel = z.infer<typeof AdaptiveModelSchema>;
export type ContentFeature = z.infer<typeof ContentFeatureSchema>;
export type SimilarityScore = z.infer<typeof SimilarityScoreSchema>;
export type ContentCluster = z.infer<typeof ContentClusterSchema>;
export type RecommendationFeedback = z.infer<typeof RecommendationFeedbackSchema>;
export type FeedbackAnalytics = z.infer<typeof FeedbackAnalyticsSchema>;
export type ModelUpdateEvent = z.infer<typeof ModelUpdateEventSchema>;
export type AIRecommendationSystem = z.infer<typeof AIRecommendationSystemSchema>;
export type RecommendationRequest = z.infer<typeof RecommendationRequestSchema>;
export type RecommendationResponse = z.infer<typeof RecommendationResponseSchema>;

// Component Props Types
export interface AIContentRecommendationsProps {
  userId: string;
  maxRecommendations?: number;
  enableFeedback?: boolean;
  enableExplanations?: boolean;
  enableDiversification?: boolean;
  enableBehavioralLearning?: boolean;
  className?: string;
  onRecommendationClick?: (recommendation: ContentRecommendation) => void;
  onFeedback?: (feedback: RecommendationFeedback) => void;
}

export interface PersonalizedRecommendationsProps {
  userId: string;
  context?: Partial<RecommendationRequest['context']>;
  preferences?: Partial<RecommendationRequest['preferences']>;
  onRecommendationInteraction?: (recommendationId: string, action: string) => void;
  className?: string;
}

export interface BehavioralAnalysisProps {
  userId: string;
  enableRealTimeTracking?: boolean;
  enablePatternRecognition?: boolean;
  enableAdaptiveLearning?: boolean;
  onPatternDetected?: (pattern: BehaviorPattern) => void;
  className?: string;
}

export interface ContentSimilarityProps {
  contentId: string;
  maxSimilarItems?: number;
  enableClustering?: boolean;
  enableExplanations?: boolean;
  onSimilarContentClick?: (contentId: string) => void;
  className?: string;
}

export interface RecommendationFeedbackProps {
  recommendationId: string;
  contentId: string;
  enableQuickFeedback?: boolean;
  enableDetailedFeedback?: boolean;
  enableIncentives?: boolean;
  onFeedbackSubmitted?: (feedback: RecommendationFeedback) => void;
  className?: string;
}

// Error Types
export class AIRecommendationError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'AIRecommendationError';
  }
}

export class ModelTrainingError extends Error {
  constructor(
    message: string,
    public modelId: string,
    public phase: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ModelTrainingError';
  }
}

export class FeedbackProcessingError extends Error {
  constructor(
    message: string,
    public feedbackId: string,
    public details?: any
  ) {
    super(message);
    this.name = 'FeedbackProcessingError';
  }
}
