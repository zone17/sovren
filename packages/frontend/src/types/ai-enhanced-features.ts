/**
 * 🤖 **AI-ENHANCED FEATURES TYPES**
 *
 * Complete type definitions for US-103 through US-106
 * Elite engineering implementation with comprehensive validation
 *
 * Features:
 * - US-103: Automatic Content Tagging
 * - US-104: Topic Extraction for Content
 * - US-105: Content Clustering
 * - US-106: Related Content Suggestions
 *
 * @author Sovren Platform Team
 * @version 1.0.0
 */

import { z } from 'zod';

// =====================================================
// US-103: AUTOMATIC CONTENT TAGGING TYPES
// =====================================================

export const TagConfidenceSchema = z.object({
  tag: z.string(),
  confidence: z.number().min(0).max(1),
  category: z.enum(['topic', 'sentiment', 'entity', 'keyword', 'genre', 'difficulty']),
  source: z.enum(['ai_extraction', 'user_input', 'collaborative_filtering', 'rule_based']),
  reasoning: z.string().optional(),
});

export const AutoTaggingConfigSchema = z.object({
  enabledCategories: z.array(
    z.enum(['topic', 'sentiment', 'entity', 'keyword', 'genre', 'difficulty'])
  ),
  confidenceThreshold: z.number().min(0).max(1).default(0.7),
  maxTagsPerCategory: z.number().min(1).max(20).default(10),
  enableLearningFromCorrections: z.boolean().default(true),
  enableCollaborativeFiltering: z.boolean().default(true),
  enableHumanValidation: z.boolean().default(false),
});

export const ContentTaggingResultSchema = z.object({
  contentId: z.string(),
  suggestedTags: z.array(TagConfidenceSchema),
  validatedTags: z.array(z.string()),
  rejectedTags: z.array(z.string()),
  processingTime: z.number(),
  algorithm: z.string(),
  modelVersion: z.string(),
  lastUpdated: z.date(),
  userFeedback: z
    .object({
      approvedTags: z.array(z.string()).optional(),
      rejectedTags: z.array(z.string()).optional(),
      addedTags: z.array(z.string()).optional(),
      feedback: z.string().optional(),
    })
    .optional(),
});

export const TagValidationRuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  category: z.string(),
  rule: z.object({
    type: z.enum(['regex', 'keyword_match', 'semantic_similarity', 'custom_function']),
    pattern: z.string().optional(),
    threshold: z.number().optional(),
    parameters: z.record(z.any()).optional(),
  }),
  isActive: z.boolean(),
  priority: z.number(),
  createdAt: z.date(),
  lastModified: z.date(),
});

// =====================================================
// US-104: TOPIC EXTRACTION TYPES
// =====================================================

export const ExtractedTopicSchema = z.object({
  id: z.string(),
  name: z.string(),
  displayName: z.string(),
  description: z.string().optional(),
  confidence: z.number().min(0).max(1),
  relevance: z.number().min(0).max(1),
  keyPhrases: z.array(z.string()),
  semanticWeight: z.number().min(0).max(1),
  extractionMethod: z.enum(['lda', 'bert', 'openai', 'hybrid', 'rule_based']),
  parentTopic: z.string().optional(),
  subTopics: z.array(z.string()).optional(),
  relatedTopics: z.array(z.string()).optional(),
});

export const TopicHierarchySchema = z.object({
  id: z.string(),
  rootTopic: z.string(),
  hierarchy: z.record(
    z.object({
      level: z.number(),
      parent: z.string().optional(),
      children: z.array(z.string()),
      weight: z.number().min(0).max(1),
    })
  ),
  maxDepth: z.number(),
  totalTopics: z.number(),
  coherenceScore: z.number().min(0).max(1),
  createdAt: z.date(),
  lastUpdated: z.date(),
});

export const TopicModelConfigSchema = z.object({
  algorithm: z.enum(['lda', 'nmf', 'bert_topic', 'top2vec', 'hybrid']),
  parameters: z.object({
    numTopics: z.number().min(2).max(100).optional(),
    minTopicSize: z.number().min(5).max(100).default(10),
    maxTopicSize: z.number().min(50).max(1000).default(500),
    coherenceThreshold: z.number().min(0).max(1).default(0.6),
    diversityWeight: z.number().min(0).max(1).default(0.3),
  }),
  preprocessingSteps: z.array(
    z.enum(['tokenization', 'stop_words', 'lemmatization', 'stemming', 'ngrams'])
  ),
  embeddingModel: z.string().default('sentence-transformers/all-MiniLM-L6-v2'),
  isRealTime: z.boolean().default(false),
});

export const TopicTrendSchema = z.object({
  topicId: z.string(),
  timeframe: z.enum(['hour', 'day', 'week', 'month', 'year']),
  dataPoints: z.array(
    z.object({
      timestamp: z.date(),
      popularity: z.number().min(0).max(1),
      contentCount: z.number(),
      engagementRate: z.number().min(0).max(1),
      newMentions: z.number(),
    })
  ),
  trendDirection: z.enum(['rising', 'stable', 'declining', 'volatile']),
  trendStrength: z.number().min(0).max(1),
  seasonality: z
    .object({
      hasSeasonality: z.boolean(),
      period: z.string().optional(),
      amplitude: z.number().optional(),
    })
    .optional(),
});

// =====================================================
// US-105: CONTENT CLUSTERING TYPES
// =====================================================

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
    primaryCreators: z.array(z.string()),
    contentTypes: z.array(z.string()),
    averageLength: z.number(),
    predominantSentiment: z.number().min(-1).max(1),
  }),
  quality: z.object({
    cohesion: z.number().min(0).max(1), // How similar items in cluster are
    separation: z.number().min(0).max(1), // How different from other clusters
    silhouetteScore: z.number().min(-1).max(1),
    inertia: z.number(),
    stability: z.number().min(0).max(1),
  }),
  size: z.number(),
  algorithm: z.enum(['kmeans', 'hierarchical', 'dbscan', 'gaussian_mixture', 'spectral']),
  parameters: z.record(z.any()),
  createdAt: z.date(),
  lastUpdated: z.date(),
  isActive: z.boolean(),
});

export const ClusteringConfigSchema = z.object({
  algorithm: z.enum(['kmeans', 'hierarchical', 'dbscan', 'gaussian_mixture', 'spectral']),
  parameters: z.object({
    numClusters: z.number().min(2).max(50).optional(),
    minClusterSize: z.number().min(5).max(100).default(10),
    maxClusterSize: z.number().min(50).max(1000).default(500),
    distanceMetric: z.enum(['euclidean', 'cosine', 'manhattan', 'jaccard']).default('cosine'),
    linkage: z.enum(['ward', 'complete', 'average', 'single']).optional(),
    eps: z.number().optional(), // For DBSCAN
    minSamples: z.number().optional(), // For DBSCAN
  }),
  features: z.object({
    useTextualFeatures: z.boolean().default(true),
    useTopicFeatures: z.boolean().default(true),
    useEngagementFeatures: z.boolean().default(true),
    useMetadataFeatures: z.boolean().default(true),
    useTemporalFeatures: z.boolean().default(false),
  }),
  realTimeUpdates: z.boolean().default(false),
  qualityThreshold: z.number().min(0).max(1).default(0.7),
});

export const ClusterAnalyticsSchema = z.object({
  clusterId: z.string(),
  timeframe: z.enum(['day', 'week', 'month', 'quarter', 'year']),
  metrics: z.object({
    contentGrowth: z.array(
      z.object({
        timestamp: z.date(),
        contentCount: z.number(),
        newContent: z.number(),
      })
    ),
    qualityMetrics: z.array(
      z.object({
        timestamp: z.date(),
        cohesion: z.number(),
        separation: z.number(),
        silhouetteScore: z.number(),
      })
    ),
    engagementMetrics: z.object({
      avgViewsPerContent: z.number(),
      avgEngagementRate: z.number(),
      topPerformingContent: z.array(z.string()),
    }),
    topicEvolution: z.array(
      z.object({
        timestamp: z.date(),
        dominantTopics: z.array(z.string()),
        topicWeights: z.array(z.number()),
      })
    ),
  }),
  insights: z.array(
    z.object({
      type: z.enum(['trend', 'anomaly', 'opportunity', 'warning']),
      message: z.string(),
      confidence: z.number().min(0).max(1),
      actionable: z.boolean(),
      recommendations: z.array(z.string()).optional(),
    })
  ),
});

// =====================================================
// US-106: RELATED CONTENT SUGGESTIONS TYPES
// =====================================================

export const RelatedContentSuggestionSchema = z.object({
  id: z.string(),
  sourceContentId: z.string(),
  targetContentId: z.string(),
  title: z.string(),
  description: z.string().optional(),
  thumbnailUrl: z.string().optional(),
  creatorId: z.string(),
  creatorName: z.string(),
  relationshipType: z.enum([
    'similar_topic',
    'same_creator',
    'sequential',
    'complementary',
    'alternative',
    'deep_dive',
  ]),
  relevanceScore: z.number().min(0).max(1),
  confidenceScore: z.number().min(0).max(1),
  explanation: z.string(),
  reasoning: z.object({
    topicSimilarity: z.number().min(0).max(1),
    contentSimilarity: z.number().min(0).max(1),
    userBehaviorMatch: z.number().min(0).max(1),
    creatorAffinity: z.number().min(0).max(1),
    engagementPrediction: z.number().min(0).max(1),
  }),
  algorithm: z.string(),
  rank: z.number(),
  metadata: z.object({
    contentType: z.string(),
    estimatedReadTime: z.number().optional(),
    difficulty: z.string().optional(),
    publishedAt: z.date(),
    engagementRate: z.number().optional(),
    viewCount: z.number().default(0),
    tags: z.array(z.string()),
  }),
  createdAt: z.date(),
  expiresAt: z.date(),
});

export const RelatedContentConfigSchema = z.object({
  maxSuggestions: z.number().min(1).max(50).default(10),
  algorithms: z.object({
    contentBased: z.object({
      enabled: z.boolean().default(true),
      weight: z.number().min(0).max(1).default(0.4),
      features: z.array(z.enum(['topic', 'tag', 'category', 'sentiment', 'style'])),
    }),
    collaborative: z.object({
      enabled: z.boolean().default(true),
      weight: z.number().min(0).max(1).default(0.3),
      neighborhoodSize: z.number().min(5).max(100).default(50),
    }),
    behavioral: z.object({
      enabled: z.boolean().default(true),
      weight: z.number().min(0).max(1).default(0.2),
      sessionWeight: z.number().min(0).max(1).default(0.7),
    }),
    graph: z.object({
      enabled: z.boolean().default(true),
      weight: z.number().min(0).max(1).default(0.1),
      maxHops: z.number().min(1).max(5).default(3),
    }),
  }),
  diversification: z.object({
    enabled: z.boolean().default(true),
    diversityWeight: z.number().min(0).max(1).default(0.2),
    maxSameCreator: z.number().min(1).max(10).default(3),
    maxSameCategory: z.number().min(1).max(10).default(5),
  }),
  filtering: z.object({
    minRelevanceScore: z.number().min(0).max(1).default(0.5),
    excludeSameContent: z.boolean().default(true),
    excludeAlreadyViewed: z.boolean().default(false),
    respectUserPreferences: z.boolean().default(true),
  }),
  realTimeUpdates: z.boolean().default(true),
  cacheConfig: z.object({
    enabled: z.boolean().default(true),
    ttl: z.number().default(3600), // 1 hour
    maxSize: z.number().default(1000),
  }),
});

export const CrossContentPromotionSchema = z.object({
  id: z.string(),
  sourceContentId: z.string(),
  promotedContentIds: z.array(z.string()),
  promotionType: z.enum(['upsell', 'cross_sell', 'sequence', 'bundle', 'related']),
  targeting: z.object({
    userSegments: z.array(z.string()).optional(),
    behaviorTriggers: z.array(z.string()).optional(),
    contentContext: z.string().optional(),
    timeWindows: z
      .array(
        z.object({
          start: z.string(),
          end: z.string(),
          timezone: z.string(),
        })
      )
      .optional(),
  }),
  placement: z.object({
    position: z.enum(['top', 'middle', 'bottom', 'sidebar', 'overlay', 'inline']),
    template: z.string(),
    maxDisplays: z.number().optional(),
    displayDuration: z.number().optional(),
  }),
  performance: z.object({
    impressions: z.number().default(0),
    clicks: z.number().default(0),
    conversions: z.number().default(0),
    clickThroughRate: z.number().min(0).max(1).default(0),
    conversionRate: z.number().min(0).max(1).default(0),
  }),
  isActive: z.boolean().default(true),
  createdAt: z.date(),
  lastModified: z.date(),
  expiresAt: z.date().optional(),
});

export const RelatedContentAnalyticsSchema = z.object({
  contentId: z.string(),
  timeframe: z.enum(['hour', 'day', 'week', 'month', 'quarter']),
  metrics: z.object({
    totalSuggestions: z.number(),
    uniqueSuggestions: z.number(),
    clickThroughRate: z.number().min(0).max(1),
    conversionRate: z.number().min(0).max(1),
    avgRelevanceScore: z.number().min(0).max(1),
    topPerformingSuggestions: z.array(
      z.object({
        contentId: z.string(),
        clicks: z.number(),
        impressions: z.number(),
        ctr: z.number(),
      })
    ),
    algorithmPerformance: z.array(
      z.object({
        algorithm: z.string(),
        suggestions: z.number(),
        clicks: z.number(),
        ctr: z.number(),
        avgRelevance: z.number(),
      })
    ),
  }),
  insights: z.array(
    z.object({
      type: z.enum(['high_performing', 'low_performing', 'trending', 'declining']),
      message: z.string(),
      impact: z.enum(['high', 'medium', 'low']),
      recommendations: z.array(z.string()),
    })
  ),
});

// =====================================================
// COMMON TYPES AND UTILITIES
// =====================================================

export const AIEnhancementRequestSchema = z.object({
  contentId: z.string(),
  contentText: z.string(),
  contentMetadata: z.object({
    title: z.string(),
    description: z.string().optional(),
    author: z.string(),
    category: z.string().optional(),
    tags: z.array(z.string()).optional(),
    publishedAt: z.date().optional(),
  }),
  enhancements: z.array(z.enum(['tagging', 'topic_extraction', 'clustering', 'related_content'])),
  options: z
    .object({
      taggingConfig: AutoTaggingConfigSchema.optional(),
      topicConfig: TopicModelConfigSchema.optional(),
      clusteringConfig: ClusteringConfigSchema.optional(),
      relatedContentConfig: RelatedContentConfigSchema.optional(),
    })
    .optional(),
});

export const AIEnhancementResponseSchema = z.object({
  contentId: z.string(),
  results: z.object({
    tagging: ContentTaggingResultSchema.optional(),
    topicExtraction: z.array(ExtractedTopicSchema).optional(),
    clustering: z.array(ContentClusterSchema).optional(),
    relatedContent: z.array(RelatedContentSuggestionSchema).optional(),
  }),
  processingTime: z.number(),
  errors: z
    .array(
      z.object({
        enhancement: z.string(),
        error: z.string(),
        code: z.string(),
      })
    )
    .optional(),
  metadata: z.object({
    modelVersions: z.record(z.string()),
    processingDate: z.date(),
    costEstimate: z.number().optional(),
    qualityScore: z.number().min(0).max(1).optional(),
  }),
});

// =====================================================
// TYPE EXPORTS
// =====================================================

export type TagConfidence = z.infer<typeof TagConfidenceSchema>;
export type AutoTaggingConfig = z.infer<typeof AutoTaggingConfigSchema>;
export type ContentTaggingResult = z.infer<typeof ContentTaggingResultSchema>;
export type TagValidationRule = z.infer<typeof TagValidationRuleSchema>;

export type ExtractedTopic = z.infer<typeof ExtractedTopicSchema>;
export type TopicHierarchy = z.infer<typeof TopicHierarchySchema>;
export type TopicModelConfig = z.infer<typeof TopicModelConfigSchema>;
export type TopicTrend = z.infer<typeof TopicTrendSchema>;

export type ContentCluster = z.infer<typeof ContentClusterSchema>;
export type ClusteringConfig = z.infer<typeof ClusteringConfigSchema>;
export type ClusterAnalytics = z.infer<typeof ClusterAnalyticsSchema>;

export type RelatedContentSuggestion = z.infer<typeof RelatedContentSuggestionSchema>;
export type RelatedContentConfig = z.infer<typeof RelatedContentConfigSchema>;
export type CrossContentPromotion = z.infer<typeof CrossContentPromotionSchema>;
export type RelatedContentAnalytics = z.infer<typeof RelatedContentAnalyticsSchema>;

export type AIEnhancementRequest = z.infer<typeof AIEnhancementRequestSchema>;
export type AIEnhancementResponse = z.infer<typeof AIEnhancementResponseSchema>;

// =====================================================
// ERROR CLASSES
// =====================================================

export class ContentTaggingError extends Error {
  constructor(
    message: string,
    public code: string,
    public contentId: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ContentTaggingError';
  }
}

export class TopicExtractionError extends Error {
  constructor(
    message: string,
    public code: string,
    public contentId: string,
    public algorithm: string,
    public details?: any
  ) {
    super(message);
    this.name = 'TopicExtractionError';
  }
}

export class ContentClusteringError extends Error {
  constructor(
    message: string,
    public code: string,
    public algorithm: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ContentClusteringError';
  }
}

export class RelatedContentError extends Error {
  constructor(
    message: string,
    public code: string,
    public contentId: string,
    public algorithm: string,
    public details?: any
  ) {
    super(message);
    this.name = 'RelatedContentError';
  }
}

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

export const defaultAutoTaggingConfig: AutoTaggingConfig = {
  enabledCategories: ['topic', 'sentiment', 'entity', 'keyword'],
  confidenceThreshold: 0.7,
  maxTagsPerCategory: 10,
  enableLearningFromCorrections: true,
  enableCollaborativeFiltering: true,
  enableHumanValidation: false,
};

export const defaultTopicModelConfig: TopicModelConfig = {
  algorithm: 'hybrid',
  parameters: {
    numTopics: 20,
    minTopicSize: 10,
    maxTopicSize: 500,
    coherenceThreshold: 0.6,
    diversityWeight: 0.3,
  },
  preprocessingSteps: ['tokenization', 'stop_words', 'lemmatization'],
  embeddingModel: 'sentence-transformers/all-MiniLM-L6-v2',
  isRealTime: false,
};

export const defaultClusteringConfig: ClusteringConfig = {
  algorithm: 'kmeans',
  parameters: {
    numClusters: 10,
    minClusterSize: 10,
    maxClusterSize: 500,
    distanceMetric: 'cosine',
  },
  features: {
    useTextualFeatures: true,
    useTopicFeatures: true,
    useEngagementFeatures: true,
    useMetadataFeatures: true,
    useTemporalFeatures: false,
  },
  realTimeUpdates: false,
  qualityThreshold: 0.7,
};

export const defaultRelatedContentConfig: RelatedContentConfig = {
  maxSuggestions: 10,
  algorithms: {
    contentBased: {
      enabled: true,
      weight: 0.4,
      features: ['topic', 'tag', 'category'],
    },
    collaborative: {
      enabled: true,
      weight: 0.3,
      neighborhoodSize: 50,
    },
    behavioral: {
      enabled: true,
      weight: 0.2,
      sessionWeight: 0.7,
    },
    graph: {
      enabled: true,
      weight: 0.1,
      maxHops: 3,
    },
  },
  diversification: {
    enabled: true,
    diversityWeight: 0.2,
    maxSameCreator: 3,
    maxSameCategory: 5,
  },
  filtering: {
    minRelevanceScore: 0.5,
    excludeSameContent: true,
    excludeAlreadyViewed: false,
    respectUserPreferences: true,
  },
  realTimeUpdates: true,
  cacheConfig: {
    enabled: true,
    ttl: 3600,
    maxSize: 1000,
  },
};

/**
 * Validate content tagging result
 */
export function validateTaggingResult(result: any): ContentTaggingResult {
  return ContentTaggingResultSchema.parse(result);
}

/**
 * Validate topic extraction results
 */
export function validateTopicExtraction(topics: any[]): ExtractedTopic[] {
  return z.array(ExtractedTopicSchema).parse(topics);
}

/**
 * Validate content clustering results
 */
export function validateClusteringResult(clusters: any[]): ContentCluster[] {
  return z.array(ContentClusterSchema).parse(clusters);
}

/**
 * Validate related content suggestions
 */
export function validateRelatedContent(suggestions: any[]): RelatedContentSuggestion[] {
  return z.array(RelatedContentSuggestionSchema).parse(suggestions);
}

/**
 * Calculate tag confidence score based on multiple factors
 */
export function calculateTagConfidence(
  aiConfidence: number,
  userFeedback: number,
  collaborativeScore: number,
  ruleScore: number
): number {
  return Math.min(
    1.0,
    aiConfidence * 0.4 + userFeedback * 0.3 + collaborativeScore * 0.2 + ruleScore * 0.1
  );
}

/**
 * Generate explanation for content relationship
 */
export function generateRelationshipExplanation(
  type: RelatedContentSuggestion['relationshipType'],
  reasoning: RelatedContentSuggestion['reasoning']
): string {
  switch (type) {
    case 'similar_topic':
      return `Similar topics (${(reasoning.topicSimilarity * 100).toFixed(0)}% match)`;
    case 'same_creator':
      return `From the same creator you follow`;
    case 'sequential':
      return `Next in the series or logical progression`;
    case 'complementary':
      return `Complements this content with additional perspective`;
    case 'alternative':
      return `Alternative approach to the same topic`;
    case 'deep_dive':
      return `More detailed exploration of this topic`;
    default:
      return `Related content (${(reasoning.contentSimilarity * 100).toFixed(0)}% similarity)`;
  }
}
