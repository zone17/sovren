/**
 * 🤖 **AI-ENHANCED FEATURES TYPES (Backend)**
 *
 * Essential types and error classes for AI enhanced features backend services
 * Focused on core functionality without frontend-specific dependencies
 *
 * @author Sovren Platform Team
 * @version 1.0.0
 */

// =====================================================
// BASIC INTERFACES
// =====================================================

export interface TagConfidence {
  tag: string;
  confidence: number;
  category: 'topic' | 'sentiment' | 'entity' | 'keyword' | 'genre' | 'difficulty';
  source: 'ai_extraction' | 'user_input' | 'collaborative_filtering' | 'rule_based';
  reasoning?: string;
}

export interface AutoTaggingConfig {
  enabledCategories: Array<'topic' | 'sentiment' | 'entity' | 'keyword' | 'genre' | 'difficulty'>;
  confidenceThreshold: number;
  maxTagsPerCategory: number;
  enableLearningFromCorrections: boolean;
  enableCollaborativeFiltering: boolean;
  enableHumanValidation: boolean;
}

export interface ContentTaggingResult {
  contentId: string;
  suggestedTags: TagConfidence[];
  validatedTags: TagConfidence[];
  rejectedTags: TagConfidence[];
  processingTime: number;
  algorithm: string;
  modelVersion: string;
  lastUpdated: Date;
}

export interface ExtractedTopic {
  id: string;
  name: string;
  displayName: string;
  description: string;
  confidence: number;
  relevance: number;
  keyPhrases: string[];
  parentTopicId?: string;
  embeddingVector?: number[];
  isActive: boolean;
  createdAt: Date;
}

export interface TopicModelConfig {
  algorithm: 'lda' | 'bert' | 'hybrid';
  parameters: {
    numTopics: number;
    minTopicSize: number;
    maxTopicSize: number;
    coherenceThreshold: number;
    diversityWeight: number;
  };
  preprocessingSteps: string[];
  embeddingModel: string;
  isRealTime: boolean;
}

export interface ContentCluster {
  id: string;
  name: string;
  description: string;
  contentIds: string[];
  centroid: number[];
  characteristics: {
    dominantTopics: string[];
    avgEngagement: number;
    avgDifficulty: number;
    commonTags: string[];
    primaryCreators: string[];
    contentTypes: string[];
    averageLength: number;
    predominantSentiment: number;
  };
  quality: {
    cohesion: number;
    separation: number;
    silhouetteScore: number;
    inertia: number;
    stability: number;
  };
  size: number;
  algorithm: 'kmeans' | 'hierarchical' | 'dbscan' | 'gaussian_mixture' | 'spectral';
  parameters: Record<string, any>;
  createdAt: Date;
  lastUpdated: Date;
  isActive: boolean;
}

export interface ClusteringConfig {
  algorithm: 'kmeans' | 'hierarchical' | 'dbscan' | 'gaussian_mixture' | 'spectral';
  parameters: {
    numClusters?: number;
    minClusterSize: number;
    maxClusterSize: number;
    distanceMetric: 'euclidean' | 'cosine' | 'manhattan' | 'jaccard';
    linkage?: 'ward' | 'complete' | 'average' | 'single';
    eps?: number;
    minSamples?: number;
  };
  features: {
    useTextualFeatures: boolean;
    useTopicFeatures: boolean;
    useEngagementFeatures: boolean;
    useMetadataFeatures: boolean;
    useTemporalFeatures: boolean;
  };
  realTimeUpdates: boolean;
  qualityThreshold: number;
}

export interface RelatedContentSuggestion {
  id: string;
  sourceContentId: string;
  targetContentId: string;
  relationshipType:
    | 'similar_topic'
    | 'same_creator'
    | 'sequential'
    | 'complementary'
    | 'alternative'
    | 'deep_dive';
  relevanceScore: number;
  confidenceScore: number;
  explanation: string;
  reasoning: {
    topicSimilarity: number;
    contentSimilarity: number;
    userBehaviorMatch: number;
    creatorAffinity: number;
    engagementPrediction: number;
  };
  algorithm: string;
  rank: number;
  createdAt: Date;
  expiresAt?: Date;
}

export interface RelatedContentConfig {
  maxSuggestions: number;
  algorithms: {
    contentBased: {
      enabled: boolean;
      weight: number;
      features: Array<'topic' | 'tag' | 'category' | 'sentiment' | 'style'>;
    };
    collaborative: {
      enabled: boolean;
      weight: number;
      neighborhoodSize: number;
    };
    behavioral: {
      enabled: boolean;
      weight: number;
      sessionWeight: number;
    };
    graph: {
      enabled: boolean;
      weight: number;
      maxHops: number;
    };
  };
  diversification: {
    enabled: boolean;
    diversityWeight: number;
    maxSameCreator: number;
    maxSameCategory: number;
  };
  filtering: {
    minRelevanceScore: number;
    excludeSameContent: boolean;
    excludeAlreadyViewed: boolean;
    respectUserPreferences: boolean;
  };
  realTimeUpdates: boolean;
  cacheConfig: {
    enabled: boolean;
    ttl: number;
    maxSize: number;
  };
}

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
// DEFAULT CONFIGURATIONS
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
