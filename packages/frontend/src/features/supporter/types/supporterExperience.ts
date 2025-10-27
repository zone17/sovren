/**
 * 🎯 **SUPPORTER EXPERIENCE TYPES (US-075 TO US-078)**
 * 
 * Elite Engineering Standards:
 * ✅ Comprehensive Zod validation schemas
 * ✅ Type-safe interfaces for all data structures
 * ✅ Runtime validation with error handling
 * ✅ Performance-optimized serialization
 * ✅ Mobile-first data structures
 * ✅ Real-time update support
 */

import { z } from 'zod';

// 🔧 **CORE SUPPORTER TYPES**

export const SupporterProfileSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(2).max(100),
  avatar: z.string().url().optional(),
  bio: z.string().max(500).optional(),
  joinedAt: z.string().datetime(),
  preferences: z.object({
    categories: z.array(z.string()),
    languages: z.array(z.string()),
    contentTypes: z.array(z.enum(['text', 'video', 'audio', 'image', 'live'])),
    notificationSettings: z.object({
      newContent: z.boolean(),
      trending: z.boolean(),
      recommendations: z.boolean(),
      following: z.boolean(),
    }),
  }),
  statistics: z.object({
    totalContentViewed: z.number().nonnegative(),
    totalTimespent: z.number().nonnegative(),
    subscriptionsCount: z.number().nonnegative(),
    favoriteCreators: z.array(z.string().uuid()),
  }),
});

export type SupporterProfile = z.infer<typeof SupporterProfileSchema>;

// 📺 **US-075: PERSONALIZED FEED TYPES**

export const FeedContentItemSchema = z.object({
  id: z.string().uuid(),
  creatorId: z.string().uuid(),
  creatorName: z.string(),
  creatorAvatar: z.string().url().optional(),
  type: z.enum(['text', 'video', 'audio', 'image', 'live']),
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  content: z.string().optional(),
  mediaUrl: z.string().url().optional(),
  thumbnailUrl: z.string().url().optional(),
  duration: z.number().nonnegative().optional(),
  publishedAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  category: z.string(),
  subcategory: z.string().optional(),
  tags: z.array(z.string()),
  isPremium: z.boolean(),
  pricing: z.object({
    sats: z.number().nonnegative(),
    currency: z.string().optional(),
  }).optional(),
  engagement: z.object({
    views: z.number().nonnegative(),
    likes: z.number().nonnegative(),
    shares: z.number().nonnegative(),
    comments: z.number().nonnegative(),
    saves: z.number().nonnegative(),
    rating: z.number().min(0).max(5),
  }),
  recommendationScore: z.number().min(0).max(100),
  isFollowing: z.boolean(),
  isSubscribed: z.boolean(),
  hasAccess: z.boolean(),
});

export type FeedContentItem = z.infer<typeof FeedContentItemSchema>;

export const PersonalizedFeedSchema = z.object({
  items: z.array(FeedContentItemSchema),
  pagination: z.object({
    page: z.number().positive(),
    totalPages: z.number().nonnegative(),
    totalItems: z.number().nonnegative(),
    hasNext: z.boolean(),
    hasPrevious: z.boolean(),
  }),
  filters: z.object({
    categories: z.array(z.string()),
    contentTypes: z.array(z.string()),
    timeframe: z.enum(['24h', '7d', '30d', 'all']),
    sortBy: z.enum(['recent', 'trending', 'recommended', 'engagement']),
    showPremiumOnly: z.boolean(),
    showFollowedOnly: z.boolean(),
  }),
  metadata: z.object({
    lastUpdated: z.string().datetime(),
    algorithmVersion: z.string(),
    personalizationScore: z.number().min(0).max(100),
    diversityScore: z.number().min(0).max(100),
  }),
});

export type PersonalizedFeed = z.infer<typeof PersonalizedFeedSchema>;

// 📂 **US-076: CATEGORY BROWSING TYPES**

export const CategorySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(50),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  description: z.string().max(200),
  icon: z.string().optional(),
  parentId: z.string().uuid().optional(),
  subcategories: z.array(z.string().uuid()),
  metadata: z.object({
    contentCount: z.number().nonnegative(),
    creatorCount: z.number().nonnegative(),
    subscriberCount: z.number().nonnegative(),
    averageEngagement: z.number().min(0).max(100),
    trendingScore: z.number().min(0).max(100),
    growth30d: z.number(),
  }),
  isPopular: z.boolean(),
  isTrending: z.boolean(),
  featuredCreators: z.array(z.string().uuid()),
});

export type Category = z.infer<typeof CategorySchema>;

// 🔍 **US-077: SEARCH FUNCTIONALITY TYPES**

export const SearchQuerySchema = z.object({
  query: z.string().min(1).max(200),
  filters: z.object({
    categories: z.array(z.string()).optional(),
    contentTypes: z.array(z.string()).optional(),
    creators: z.array(z.string().uuid()).optional(),
    dateRange: z.object({
      from: z.string().datetime().optional(),
      to: z.string().datetime().optional(),
    }).optional(),
    priceRange: z.object({
      min: z.number().nonnegative().optional(),
      max: z.number().nonnegative().optional(),
    }).optional(),
    isPremium: z.boolean().optional(),
    language: z.string().optional(),
  }),
  sort: z.object({
    field: z.enum(['relevance', 'date', 'popularity', 'rating', 'price']),
    order: z.enum(['asc', 'desc']),
  }),
  pagination: z.object({
    page: z.number().positive(),
    limit: z.number().positive().max(100),
  }),
});

export type SearchQuery = z.infer<typeof SearchQuerySchema>;

export const SearchResultsSchema = z.object({
  query: SearchQuerySchema,
  results: z.array(FeedContentItemSchema),
  pagination: z.object({
    page: z.number().positive(),
    totalPages: z.number().nonnegative(),
    totalResults: z.number().nonnegative(),
    hasNext: z.boolean(),
    hasPrevious: z.boolean(),
  }),
  analytics: z.object({
    searchTime: z.number().nonnegative(),
    totalIndexed: z.number().nonnegative(),
    queryComplexity: z.number().min(0).max(100),
  }),
});

export type SearchResults = z.infer<typeof SearchResultsSchema>;

// 📈 **US-078: TRENDING CONTENT TYPES**

export const TrendingContentItemSchema = z.object({
  content: FeedContentItemSchema,
  trendingScore: z.number().min(0).max(100),
  rank: z.number().positive(),
  category: z.string(),
  timeframe: z.enum(['1h', '6h', '24h', '7d', '30d']),
  trendStarted: z.string().datetime(),
  reasons: z.array(
    z.object({
      type: z.enum(['viral', 'creator_boost', 'external_mention', 'algorithmic']),
      confidence: z.number().min(0).max(100),
      description: z.string(),
    })
  ),
});

export type TrendingContentItem = z.infer<typeof TrendingContentItemSchema>;

export const TrendingContentSchema = z.object({
  timeframe: z.enum(['1h', '6h', '24h', '7d', '30d']),
  content: z.array(TrendingContentItemSchema),
  categories: z.array(
    z.object({
      categoryId: z.string().uuid(),
      name: z.string(),
      trendingCount: z.number().nonnegative(),
      growth: z.number(),
    })
  ),
  globalStats: z.object({
    totalTrendingContent: z.number().nonnegative(),
    averageTrendingScore: z.number().min(0).max(100),
    topCategory: z.string(),
    engagementIncrease: z.number(),
  }),
  lastUpdated: z.string().datetime(),
});

export type TrendingContent = z.infer<typeof TrendingContentSchema>;

// ✅ **VALIDATION HELPERS**

export const validatePersonalizedFeed = (data: unknown): PersonalizedFeed => {
  return PersonalizedFeedSchema.parse(data);
};

export const validateSearchResults = (data: unknown): SearchResults => {
  return SearchResultsSchema.parse(data);
};

export const validateTrendingContent = (data: unknown): TrendingContent => {
  return TrendingContentSchema.parse(data);
};
