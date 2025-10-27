/**
 * 🌐 **SOCIAL MEDIA INTEGRATION TYPES**
 *
 * Elite Engineering Standards:
 * - Comprehensive type coverage for all social platforms
 * - OAuth flow type safety
 * - Analytics type definitions
 * - Cross-platform posting support
 * - Zod validation schemas
 */

import { z } from 'zod';

// =====================================================
// CORE SOCIAL MEDIA TYPES
// =====================================================

export enum SocialPlatform {
  TWITTER = 'twitter',
  FACEBOOK = 'facebook',
  INSTAGRAM = 'instagram',
  LINKEDIN = 'linkedin',
  YOUTUBE = 'youtube',
  TIKTOK = 'tiktok',
  REDDIT = 'reddit',
  DISCORD = 'discord',
  TELEGRAM = 'telegram',
  MASTODON = 'mastodon',
}

export enum PostStatus {
  DRAFT = 'draft',
  SCHEDULED = 'scheduled',
  PUBLISHED = 'published',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export enum ContentType {
  TEXT = 'text',
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
  LINK = 'link',
  POLL = 'poll',
  STORY = 'story',
  REEL = 'reel',
}

// =====================================================
// SOCIAL MEDIA SHARING (US-135)
// =====================================================

export const SocialShareConfigSchema = z.object({
  platform: z.nativeEnum(SocialPlatform),
  enabled: z.boolean().default(true),
  customMessage: z.string().optional(),
  tags: z.array(z.string()).default([]),
  imageUrl: z.string().url().optional(),
  videoUrl: z.string().url().optional(),
  linkUrl: z.string().url().optional(),
  scheduledAt: z.date().optional(),
  postOptions: z
    .object({
      includeHashtags: z.boolean().default(true),
      includeMention: z.boolean().default(false),
      mentionHandle: z.string().optional(),
      threadMode: z.boolean().default(false),
      autoRepost: z.boolean().default(false),
    })
    .optional(),
});

export type SocialShareConfig = z.infer<typeof SocialShareConfigSchema>;

export const ShareButtonConfigSchema = z.object({
  platform: z.nativeEnum(SocialPlatform),
  style: z.enum(['button', 'icon', 'floating', 'inline']).default('button'),
  size: z.enum(['small', 'medium', 'large']).default('medium'),
  showLabel: z.boolean().default(true),
  customText: z.string().optional(),
  position: z.enum(['top', 'bottom', 'left', 'right', 'floating']).default('bottom'),
  analytics: z.boolean().default(true),
  permissions: z
    .object({
      requireAuth: z.boolean().default(false),
      allowedRoles: z.array(z.string()).default([]),
    })
    .optional(),
});

export type ShareButtonConfig = z.infer<typeof ShareButtonConfigSchema>;

export const SocialShareResponseSchema = z.object({
  shareId: z.string(),
  platform: z.nativeEnum(SocialPlatform),
  success: z.boolean(),
  postId: z.string().optional(),
  postUrl: z.string().url().optional(),
  error: z.string().optional(),
  analytics: z
    .object({
      impressions: z.number().default(0),
      clicks: z.number().default(0),
      shares: z.number().default(0),
      comments: z.number().default(0),
      likes: z.number().default(0),
    })
    .optional(),
  createdAt: z.date().default(() => new Date()),
});

export type SocialShareResponse = z.infer<typeof SocialShareResponseSchema>;

// =====================================================
// CROSS-PLATFORM POSTING (US-136)
// =====================================================

export const CrossPlatformPostSchema = z.object({
  id: z.string(),
  userId: z.string(),
  contentId: z.string().optional(),
  title: z.string().max(280),
  content: z.string().max(10000),
  contentType: z.nativeEnum(ContentType),
  platforms: z.array(z.nativeEnum(SocialPlatform)),
  status: z.nativeEnum(PostStatus),
  scheduledAt: z.date().optional(),
  publishedAt: z.date().optional(),
  mediaAssets: z
    .array(
      z.object({
        type: z.enum(['image', 'video', 'audio']),
        url: z.string().url(),
        altText: z.string().optional(),
        thumbnail: z.string().url().optional(),
        duration: z.number().optional(),
        size: z.number().optional(),
      })
    )
    .default([]),
  platformCustomizations: z
    .record(
      z.nativeEnum(SocialPlatform),
      z.object({
        content: z.string().optional(),
        hashtags: z.array(z.string()).optional(),
        mentions: z.array(z.string()).optional(),
        location: z.string().optional(),
        audience: z.enum(['public', 'private', 'friends', 'followers']).optional(),
        comments: z.boolean().optional(),
        shares: z.boolean().optional(),
      })
    )
    .default({}),
  analytics: z
    .object({
      totalImpressions: z.number().default(0),
      totalEngagement: z.number().default(0),
      clickThroughRate: z.number().default(0),
      conversionRate: z.number().default(0),
    })
    .default({}),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
});

export type CrossPlatformPost = z.infer<typeof CrossPlatformPostSchema>;

export const PostingScheduleSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string(),
  platforms: z.array(z.nativeEnum(SocialPlatform)),
  schedule: z.object({
    timezone: z.string().default('UTC'),
    recurring: z.boolean().default(false),
    frequency: z.enum(['daily', 'weekly', 'monthly']).optional(),
    daysOfWeek: z.array(z.number().min(0).max(6)).optional(),
    timeSlots: z.array(z.string()).default([]),
    maxPostsPerDay: z.number().min(1).max(50).default(5),
  }),
  active: z.boolean().default(true),
  createdAt: z.date().default(() => new Date()),
});

export type PostingSchedule = z.infer<typeof PostingScheduleSchema>;

export const ContentAdaptationRulesSchema = z.object({
  platform: z.nativeEnum(SocialPlatform),
  rules: z.object({
    maxTextLength: z.number(),
    maxHashtags: z.number().default(30),
    supportedMediaTypes: z.array(z.string()),
    maxMediaCount: z.number().default(10),
    requiresAltText: z.boolean().default(false),
    supportsThreads: z.boolean().default(false),
    supportsPolls: z.boolean().default(false),
    supportsScheduling: z.boolean().default(true),
    autoHashtagGeneration: z.boolean().default(true),
    contentOptimization: z.boolean().default(true),
  }),
});

export type ContentAdaptationRules = z.infer<typeof ContentAdaptationRulesSchema>;

// =====================================================
// SOCIAL MEDIA ANALYTICS (US-137)
// =====================================================

export const SocialAnalyticsMetricsSchema = z.object({
  platform: z.nativeEnum(SocialPlatform),
  postId: z.string(),
  contentId: z.string().optional(),
  timeRange: z.object({
    start: z.date(),
    end: z.date(),
  }),
  metrics: z.object({
    impressions: z.number().default(0),
    reach: z.number().default(0),
    engagement: z.number().default(0),
    clicks: z.number().default(0),
    shares: z.number().default(0),
    comments: z.number().default(0),
    likes: z.number().default(0),
    saves: z.number().default(0),
    mentions: z.number().default(0),
    profileViews: z.number().default(0),
    followerGrowth: z.number().default(0),
    engagementRate: z.number().default(0),
    clickThroughRate: z.number().default(0),
    conversionRate: z.number().default(0),
    sentiment: z.enum(['positive', 'neutral', 'negative']).optional(),
    topKeywords: z.array(z.string()).default([]),
    demographicData: z
      .object({
        ageGroups: z.record(z.string(), z.number()).default({}),
        genders: z.record(z.string(), z.number()).default({}),
        locations: z.record(z.string(), z.number()).default({}),
        languages: z.record(z.string(), z.number()).default({}),
      })
      .optional(),
  }),
  lastUpdated: z.date().default(() => new Date()),
});

export type SocialAnalyticsMetrics = z.infer<typeof SocialAnalyticsMetricsSchema>;

export const CrossPlatformAnalyticsSchema = z.object({
  userId: z.string(),
  contentId: z.string().optional(),
  timeRange: z.object({
    start: z.date(),
    end: z.date(),
  }),
  platformMetrics: z.record(z.nativeEnum(SocialPlatform), SocialAnalyticsMetricsSchema),
  aggregatedMetrics: z.object({
    totalImpressions: z.number().default(0),
    totalEngagement: z.number().default(0),
    averageEngagementRate: z.number().default(0),
    totalFollowers: z.number().default(0),
    followerGrowthRate: z.number().default(0),
    bestPerformingPlatform: z.nativeEnum(SocialPlatform).optional(),
    worstPerformingPlatform: z.nativeEnum(SocialPlatform).optional(),
    recommendations: z.array(z.string()).default([]),
  }),
  trends: z.array(
    z.object({
      metric: z.string(),
      platform: z.nativeEnum(SocialPlatform).optional(),
      trend: z.enum(['increasing', 'decreasing', 'stable']),
      percentage: z.number(),
      significance: z.enum(['low', 'medium', 'high']),
    })
  ),
  generatedAt: z.date().default(() => new Date()),
});

export type CrossPlatformAnalytics = z.infer<typeof CrossPlatformAnalyticsSchema>;

export const AnalyticsReportSchema = z.object({
  id: z.string(),
  userId: z.string(),
  type: z.enum(['daily', 'weekly', 'monthly', 'custom']),
  title: z.string(),
  timeRange: z.object({
    start: z.date(),
    end: z.date(),
  }),
  platforms: z.array(z.nativeEnum(SocialPlatform)),
  sections: z.array(
    z.object({
      title: z.string(),
      type: z.enum(['overview', 'engagement', 'growth', 'content', 'audience']),
      data: z.record(z.string(), z.any()),
      visualizations: z.array(
        z.object({
          type: z.enum(['chart', 'graph', 'table', 'heatmap']),
          config: z.record(z.string(), z.any()),
        })
      ),
    })
  ),
  insights: z.array(
    z.object({
      type: z.enum(['opportunity', 'warning', 'trend', 'recommendation']),
      message: z.string(),
      priority: z.enum(['low', 'medium', 'high']),
      actionable: z.boolean().default(false),
      action: z.string().optional(),
    })
  ),
  createdAt: z.date().default(() => new Date()),
});

export type AnalyticsReport = z.infer<typeof AnalyticsReportSchema>;

// =====================================================
// SOCIAL LOGIN (US-138)
// =====================================================

export const SocialLoginProviderSchema = z.object({
  platform: z.nativeEnum(SocialPlatform),
  clientId: z.string(),
  clientSecret: z.string(),
  redirectUri: z.string().url(),
  scopes: z.array(z.string()),
  enabled: z.boolean().default(true),
  sandbox: z.boolean().default(false),
  apiVersion: z.string().optional(),
  customParams: z.record(z.string(), z.string()).default({}),
});

export type SocialLoginProvider = z.infer<typeof SocialLoginProviderSchema>;

export const OAuthFlowSchema = z.object({
  state: z.string(),
  codeVerifier: z.string(),
  platform: z.nativeEnum(SocialPlatform),
  redirectUri: z.string().url(),
  scopes: z.array(z.string()),
  userId: z.string().optional(),
  createdAt: z.date().default(() => new Date()),
  expiresAt: z.date(),
});

export type OAuthFlow = z.infer<typeof OAuthFlowSchema>;

export const SocialAccountSchema = z.object({
  id: z.string(),
  userId: z.string(),
  platform: z.nativeEnum(SocialPlatform),
  platformUserId: z.string(),
  username: z.string(),
  displayName: z.string(),
  email: z.string().email().optional(),
  profileImageUrl: z.string().url().optional(),
  profileUrl: z.string().url().optional(),
  accessToken: z.string(),
  refreshToken: z.string().optional(),
  tokenExpiresAt: z.date().optional(),
  scopes: z.array(z.string()),
  isVerified: z.boolean().default(false),
  isPrimary: z.boolean().default(false),
  metadata: z.record(z.string(), z.any()).default({}),
  lastSyncAt: z.date().optional(),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
});

export type SocialAccount = z.infer<typeof SocialAccountSchema>;

export const AccountLinkingRequestSchema = z.object({
  id: z.string(),
  userId: z.string(),
  platform: z.nativeEnum(SocialPlatform),
  authCode: z.string(),
  state: z.string(),
  status: z.enum(['pending', 'completed', 'failed', 'expired']),
  error: z.string().optional(),
  createdAt: z.date().default(() => new Date()),
  expiresAt: z.date(),
});

export type AccountLinkingRequest = z.infer<typeof AccountLinkingRequestSchema>;

export const SocialProfileSyncSchema = z.object({
  accountId: z.string(),
  platform: z.nativeEnum(SocialPlatform),
  syncedData: z.object({
    profile: z
      .object({
        username: z.string(),
        displayName: z.string(),
        bio: z.string().optional(),
        location: z.string().optional(),
        website: z.string().url().optional(),
        verified: z.boolean().default(false),
        followerCount: z.number().default(0),
        followingCount: z.number().default(0),
      })
      .optional(),
    posts: z.array(z.any()).optional(),
    followers: z.array(z.any()).optional(),
    engagement: z.record(z.string(), z.number()).optional(),
  }),
  lastSyncAt: z.date().default(() => new Date()),
  nextSyncAt: z.date(),
  syncFrequency: z.enum(['realtime', 'hourly', 'daily', 'weekly']).default('daily'),
  conflicts: z.array(
    z.object({
      field: z.string(),
      localValue: z.any(),
      remoteValue: z.any(),
      resolution: z.enum(['keep_local', 'keep_remote', 'merge', 'manual']),
    })
  ),
});

export type SocialProfileSync = z.infer<typeof SocialProfileSyncSchema>;

// =====================================================
// SHARED UTILITY TYPES
// =====================================================

export const SocialMediaErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  platform: z.nativeEnum(SocialPlatform).optional(),
  details: z.record(z.string(), z.any()).default({}),
  retryable: z.boolean().default(false),
  timestamp: z.date().default(() => new Date()),
});

export type SocialMediaError = z.infer<typeof SocialMediaErrorSchema>;

export const SocialMediaConfigSchema = z.object({
  sharing: z.object({
    enabled: z.boolean().default(true),
    defaultPlatforms: z.array(z.nativeEnum(SocialPlatform)).default([]),
    customMessages: z.record(z.nativeEnum(SocialPlatform), z.string()).default({}),
    analytics: z.boolean().default(true),
    permissions: z.object({
      requireAuth: z.boolean().default(false),
      allowedRoles: z.array(z.string()).default([]),
    }),
  }),
  posting: z.object({
    enabled: z.boolean().default(true),
    maxDailyPosts: z.number().default(10),
    contentAdaptation: z.boolean().default(true),
    autoScheduling: z.boolean().default(true),
    failureRetries: z.number().default(3),
  }),
  analytics: z.object({
    enabled: z.boolean().default(true),
    syncFrequency: z.enum(['realtime', 'hourly', 'daily']).default('hourly'),
    retentionDays: z.number().default(365),
    detailedMetrics: z.boolean().default(true),
  }),
  login: z.object({
    enabled: z.boolean().default(true),
    providers: z.array(z.nativeEnum(SocialPlatform)).default([]),
    accountLinking: z.boolean().default(true),
    profileSync: z.boolean().default(true),
    security: z.object({
      requireEmailVerification: z.boolean().default(true),
      sessionTimeout: z.number().default(86400),
      multipleAccounts: z.boolean().default(true),
    }),
  }),
});

export type SocialMediaConfig = z.infer<typeof SocialMediaConfigSchema>;

// =====================================================
// API REQUEST/RESPONSE TYPES
// =====================================================

export const CreateSocialPostRequestSchema = z.object({
  content: z.string().max(10000),
  platforms: z.array(z.nativeEnum(SocialPlatform)),
  scheduledAt: z.date().optional(),
  mediaUrls: z.array(z.string().url()).optional(),
  customizations: z.record(z.nativeEnum(SocialPlatform), z.any()).optional(),
});

export type CreateSocialPostRequest = z.infer<typeof CreateSocialPostRequestSchema>;

export const SocialShareRequestSchema = z.object({
  contentId: z.string(),
  platform: z.nativeEnum(SocialPlatform),
  customMessage: z.string().optional(),
  scheduledAt: z.date().optional(),
});

export type SocialShareRequest = z.infer<typeof SocialShareRequestSchema>;

export const GetAnalyticsRequestSchema = z.object({
  platforms: z.array(z.nativeEnum(SocialPlatform)).optional(),
  timeRange: z
    .object({
      start: z.date(),
      end: z.date(),
    })
    .optional(),
  metrics: z.array(z.string()).optional(),
  contentId: z.string().optional(),
});

export type GetAnalyticsRequest = z.infer<typeof GetAnalyticsRequestSchema>;

export const SocialLoginRequestSchema = z.object({
  platform: z.nativeEnum(SocialPlatform),
  authCode: z.string(),
  state: z.string(),
  redirectUri: z.string().url(),
});

export type SocialLoginRequest = z.infer<typeof SocialLoginRequestSchema>;

// =====================================================
// EXPORT ALL SCHEMAS
// =====================================================

export const socialMediaSchemas = {
  SocialShareConfig: SocialShareConfigSchema,
  ShareButtonConfig: ShareButtonConfigSchema,
  SocialShareResponse: SocialShareResponseSchema,
  CrossPlatformPost: CrossPlatformPostSchema,
  PostingSchedule: PostingScheduleSchema,
  ContentAdaptationRules: ContentAdaptationRulesSchema,
  SocialAnalyticsMetrics: SocialAnalyticsMetricsSchema,
  CrossPlatformAnalytics: CrossPlatformAnalyticsSchema,
  AnalyticsReport: AnalyticsReportSchema,
  SocialLoginProvider: SocialLoginProviderSchema,
  OAuthFlow: OAuthFlowSchema,
  SocialAccount: SocialAccountSchema,
  AccountLinkingRequest: AccountLinkingRequestSchema,
  SocialProfileSync: SocialProfileSyncSchema,
  SocialMediaError: SocialMediaErrorSchema,
  SocialMediaConfig: SocialMediaConfigSchema,
  CreateSocialPostRequest: CreateSocialPostRequestSchema,
  SocialShareRequest: SocialShareRequestSchema,
  GetAnalyticsRequest: GetAnalyticsRequestSchema,
  SocialLoginRequest: SocialLoginRequestSchema,
};
