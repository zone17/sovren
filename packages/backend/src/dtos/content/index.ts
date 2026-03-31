/**
 * Content API Data Transfer Objects
 *
 * Defines request and response schemas for Content API endpoints
 * Used for type safety and validation in controllers
 */

// ============================================================================
// Publishing DTOs
// ============================================================================

export interface PublishContentRequestDTO {
  contentId: string;
  title: string;
  content: string;
  contentType: 'article' | 'video' | 'audio' | 'image' | 'nostr-event';
  tags?: string[];
  metadata?: Record<string, any>;
  publishToNostr?: boolean;
  relayUrls?: string[];
  monetization?: {
    priceInSats?: number;
    allowTipping?: boolean;
    subscriptionTier?: string;
  };
}

export interface PublishContentResponseDTO {
  contentId: string;
  status: 'published' | 'pending' | 'failed';
  nostrEventId?: string;
  relayPublishResults?: Array<{
    relayUrl: string;
    success: boolean;
    error?: string;
  }>;
  publishedAt: string;
  url: string;
}

// ============================================================================
// Moderation DTOs
// ============================================================================

export interface ModerateContentRequestDTO {
  contentId: string;
  action: 'approve' | 'reject' | 'flag' | 'review';
  reason?: string;
  moderatorId: string;
  notes?: string;
}

export interface ModerateContentResponseDTO {
  contentId: string;
  previousStatus: string;
  newStatus: string;
  moderationAction: string;
  moderatedAt: string;
  moderatedBy: string;
  autoModeration?: {
    aiScore: number;
    flags: string[];
    confidence: number;
  };
}

// ============================================================================
// Search DTOs
// ============================================================================

export interface SearchContentRequestDTO {
  query: string;
  filters?: {
    contentType?: string[];
    tags?: string[];
    authorId?: string;
    dateFrom?: string;
    dateTo?: string;
    minPrice?: number;
    maxPrice?: number;
  };
  sort?: 'relevance' | 'date' | 'popularity' | 'price';
  pagination?: {
    page: number;
    limit: number;
  };
}

export interface ContentSearchResultDTO {
  contentId: string;
  title: string;
  excerpt: string;
  contentType: string;
  authorId: string;
  authorName: string;
  publishedAt: string;
  tags: string[];
  priceInSats?: number;
  engagementScore: number;
  relevanceScore: number;
}

export interface SearchContentResponseDTO {
  results: ContentSearchResultDTO[];
  totalResults: number;
  currentPage: number;
  totalPages: number;
  searchTime: number;
  facets?: {
    contentTypes: Record<string, number>;
    tags: Record<string, number>;
    priceRanges: Record<string, number>;
  };
}

// ============================================================================
// Recommendations DTOs
// ============================================================================

export interface GetRecommendationsRequestDTO {
  userId: string;
  context?: {
    currentContentId?: string;
    recentViewedIds?: string[];
    interests?: string[];
  };
  limit?: number;
  diversity?: number; // 0-1 scale
}

export interface ContentRecommendationDTO {
  contentId: string;
  title: string;
  excerpt: string;
  contentType: string;
  authorId: string;
  authorName: string;
  score: number;
  reason: string;
  tags: string[];
  priceInSats?: number;
  thumbnailUrl?: string;
}

export interface GetRecommendationsResponseDTO {
  recommendations: ContentRecommendationDTO[];
  algorithm: string;
  generatedAt: string;
  personalizedFor: string;
}

// ============================================================================
// Analytics DTOs
// ============================================================================

export interface GetContentAnalyticsRequestDTO {
  contentId: string;
  timeRange?: {
    start: string;
    end: string;
  };
  metrics?: string[]; // Specific metrics to retrieve
}

export interface ContentAnalyticsResponseDTO {
  contentId: string;
  timeRange: {
    start: string;
    end: string;
  };
  overview: {
    totalViews: number;
    uniqueViewers: number;
    totalEngagements: number;
    averageEngagementRate: number;
    revenue: {
      totalSats: number;
      totalUSD: number;
    };
  };
  engagement: {
    likes: number;
    shares: number;
    comments: number;
    saves: number;
  };
  traffic: {
    sources: Record<string, number>;
    devices: Record<string, number>;
    geoLocations: Record<string, number>;
  };
  performance: {
    averageReadTime: number;
    completionRate: number;
    bounceRate: number;
  };
  trends: Array<{
    timestamp: string;
    views: number;
    engagement: number;
  }>;
}

// ============================================================================
// Versioning DTOs
// ============================================================================

export interface GetVersionHistoryRequestDTO {
  contentId: string;
  limit?: number;
  offset?: number;
}

export interface ContentVersionDTO {
  versionId: string;
  contentId: string;
  versionNumber: number;
  createdAt: string;
  createdBy: string;
  changes: {
    field: string;
    oldValue: any;
    newValue: any;
  }[];
  changesSummary: string;
  size: number;
}

export interface GetVersionHistoryResponseDTO {
  contentId: string;
  currentVersion: number;
  versions: ContentVersionDTO[];
  totalVersions: number;
}

export interface RevertContentVersionRequestDTO {
  contentId: string;
  targetVersionId: string;
  reason: string;
}

export interface RevertContentVersionResponseDTO {
  contentId: string;
  previousVersion: number;
  revertedToVersion: number;
  newVersion: number;
  revertedAt: string;
  revertedBy: string;
}

// ============================================================================
// Common Response Wrapper
// ============================================================================

export interface ContentApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata?: {
    requestId: string;
    timestamp: string;
    processingTime: number;
  };
}
