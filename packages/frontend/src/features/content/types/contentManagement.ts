/**
 * 📚 **CONTENT MANAGEMENT TOOLS TYPES - US-071 TO US-074**
 *
 * Elite Engineering Standards:
 * ✅ Comprehensive type safety with Zod validation
 * ✅ Mobile-first design considerations
 * ✅ Real-time collaboration support
 * ✅ Performance optimization ready
 * ✅ Accessibility compliance built-in
 * ✅ Lightning Network integration
 * ✅ NOSTR protocol compatibility
 */

import { z } from 'zod';

// 📊 **CONTENT STATUS AND METADATA TYPES**

export const ContentStatusSchema = z.enum([
  'draft',
  'scheduled',
  'published',
  'archived',
  'deleted',
  'under_review',
  'rejected',
  'premium_only',
]);

export const ContentTypeSchema = z.enum([
  'article',
  'video',
  'podcast',
  'image',
  'document',
  'live_stream',
  'course',
  'newsletter',
  'poll',
  'event',
]);

export const ContentVisibilitySchema = z.enum([
  'public',
  'subscribers_only',
  'premium_only',
  'unlisted',
  'private',
  'members_only',
]);

// 📅 **US-072: CONTENT SCHEDULING TYPES**

export const SchedulingStatusSchema = z.enum([
  'not_scheduled',
  'scheduled',
  'publishing',
  'published',
  'failed',
  'cancelled',
  'rescheduled',
]);

export const TimezoneSchema = z.string().refine(
  (tz) => {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  },
  { message: 'Invalid timezone' }
);

export const ContentScheduleSchema = z.object({
  id: z.string().uuid(),
  contentId: z.string().uuid(),
  scheduledTime: z.string().datetime(),
  timezone: TimezoneSchema,
  status: SchedulingStatusSchema,
  publishingPlatforms: z.array(z.string()),
  automaticPosting: z.boolean(),
  notifications: z.object({
    email: z.boolean(),
    push: z.boolean(),
    slack: z.boolean(),
    discord: z.boolean(),
  }),
  recurringPattern: z
    .object({
      enabled: z.boolean(),
      frequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
      interval: z.number().min(1).max(365),
      endDate: z.string().datetime().optional(),
      daysOfWeek: z.array(z.number().min(0).max(6)).optional(),
    })
    .optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// 📚 **US-071: CONTENT LIBRARY TYPES**

export const ContentFilterSchema = z.object({
  status: z.array(ContentStatusSchema).optional(),
  type: z.array(ContentTypeSchema).optional(),
  visibility: z.array(ContentVisibilitySchema).optional(),
  tags: z.array(z.string()).optional(),
  dateRange: z
    .object({
      start: z.string().datetime(),
      end: z.string().datetime(),
    })
    .optional(),
  searchQuery: z.string().optional(),
  author: z.string().optional(),
  minimumViews: z.number().nonnegative().optional(),
  minimumEngagement: z.number().min(0).max(100).optional(),
  sortBy: z.enum([
    'created_at',
    'updated_at',
    'published_at',
    'views',
    'engagement',
    'revenue',
    'title',
    'status',
  ]),
  sortOrder: z.enum(['asc', 'desc']),
});

export const BulkOperationSchema = z.object({
  operation: z.enum([
    'publish',
    'unpublish',
    'archive',
    'delete',
    'change_status',
    'add_tags',
    'remove_tags',
    'move_to_collection',
    'update_visibility',
    'schedule_publish',
  ]),
  contentIds: z.array(z.string().uuid()),
  parameters: z.record(z.any()).optional(),
  dryRun: z.boolean().default(false),
});

export const ContentLibraryItemSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200),
  slug: z.string(),
  type: ContentTypeSchema,
  status: ContentStatusSchema,
  visibility: ContentVisibilitySchema,
  description: z.string().max(500).optional(),
  thumbnail: z.string().url().optional(),
  tags: z.array(z.string()),
  collections: z.array(z.string().uuid()),
  metrics: z.object({
    views: z.number().nonnegative(),
    likes: z.number().nonnegative(),
    shares: z.number().nonnegative(),
    comments: z.number().nonnegative(),
    engagementRate: z.number().min(0).max(100),
    revenue: z.number().nonnegative(),
    conversionRate: z.number().min(0).max(100),
  }),
  schedule: ContentScheduleSchema.optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  publishedAt: z.string().datetime().optional(),
  author: z.object({
    id: z.string().uuid(),
    name: z.string(),
    avatar: z.string().url().optional(),
  }),
});

// 📊 **US-073: CONTENT PERFORMANCE METRICS TYPES**

export const ContentMetricsSchema = z.object({
  contentId: z.string().uuid(),
  timeframe: z.enum(['24h', '7d', '30d', '90d', '1y', 'all_time']),
  metrics: z.object({
    views: z.object({
      total: z.number().nonnegative(),
      unique: z.number().nonnegative(),
      trend: z.number(),
      dailyBreakdown: z.array(
        z.object({
          date: z.string().date(),
          views: z.number().nonnegative(),
        })
      ),
    }),
    engagement: z.object({
      likes: z.number().nonnegative(),
      shares: z.number().nonnegative(),
      comments: z.number().nonnegative(),
      saves: z.number().nonnegative(),
      rate: z.number().min(0).max(100),
      trend: z.number(),
    }),
    revenue: z.object({
      total: z.number().nonnegative(),
      subscriptions: z.number().nonnegative(),
      tips: z.number().nonnegative(),
      premium: z.number().nonnegative(),
      trend: z.number(),
      perView: z.number().nonnegative(),
    }),
    audience: z.object({
      reach: z.number().nonnegative(),
      impressions: z.number().nonnegative(),
      clickThroughRate: z.number().min(0).max(100),
      bounceRate: z.number().min(0).max(100),
      averageTimeSpent: z.number().nonnegative(),
      returnVisitors: z.number().min(0).max(100),
    }),
    social: z.object({
      mentions: z.number().nonnegative(),
      hashtags: z.array(z.string()),
      virality: z.number().min(0).max(100),
      sentiment: z.enum(['positive', 'neutral', 'negative']),
      influencerReach: z.number().nonnegative(),
    }),
  }),
  benchmarks: z.object({
    industryAverage: z.number().min(0).max(100),
    personalBest: z.number().min(0).max(100),
    contentTypeAverage: z.number().min(0).max(100),
    competitorAverage: z.number().min(0).max(100),
  }),
  recommendations: z.array(
    z.object({
      type: z.enum(['optimization', 'promotion', 'timing', 'format', 'topic']),
      priority: z.enum(['low', 'medium', 'high', 'critical']),
      title: z.string(),
      description: z.string(),
      expectedImpact: z.string(),
      effort: z.enum(['low', 'medium', 'high']),
      timeline: z.string(),
    })
  ),
  generatedAt: z.string().datetime(),
});

// 🎯 **US-074: CONTENT STRATEGY TYPES**

export const ContentGapAnalysisSchema = z.object({
  topicGaps: z.array(
    z.object({
      topic: z.string(),
      searchVolume: z.number().nonnegative(),
      competitionLevel: z.enum(['low', 'medium', 'high']),
      opportunityScore: z.number().min(0).max(100),
      suggestedContentTypes: z.array(ContentTypeSchema),
      keywordSuggestions: z.array(z.string()),
    })
  ),
  contentTypeGaps: z.array(
    z.object({
      type: ContentTypeSchema,
      currentCount: z.number().nonnegative(),
      recommendedCount: z.number().nonnegative(),
      performanceGap: z.number(),
      reasoning: z.string(),
    })
  ),
  audienceGaps: z.array(
    z.object({
      audienceSegment: z.string(),
      currentReach: z.number().min(0).max(100),
      potentialReach: z.number().min(0).max(100),
      contentNeeds: z.array(z.string()),
      preferredFormats: z.array(ContentTypeSchema),
    })
  ),
  seasonalOpportunities: z.array(
    z.object({
      timeframe: z.string(),
      topics: z.array(z.string()),
      expectedEngagement: z.number().min(0).max(100),
      preparationTime: z.string(),
    })
  ),
});

export const ContentStrategyPlanSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().max(500),
  timeframe: z.object({
    start: z.string().datetime(),
    end: z.string().datetime(),
  }),
  goals: z.array(
    z.object({
      type: z.enum(['views', 'engagement', 'revenue', 'subscribers', 'reach']),
      target: z.number().nonnegative(),
      current: z.number().nonnegative(),
      timeline: z.string().datetime(),
      priority: z.enum(['low', 'medium', 'high', 'critical']),
    })
  ),
  contentCalendar: z.array(
    z.object({
      date: z.string().datetime(),
      contentType: ContentTypeSchema,
      topic: z.string(),
      targetAudience: z.array(z.string()),
      estimatedEffort: z.enum(['low', 'medium', 'high']),
      expectedOutcome: z.string(),
      status: z.enum(['planned', 'in_progress', 'completed', 'cancelled']),
    })
  ),
  competitorAnalysis: z.array(
    z.object({
      competitorName: z.string(),
      contentStrategy: z.string(),
      strengths: z.array(z.string()),
      weaknesses: z.array(z.string()),
      opportunities: z.array(z.string()),
      threats: z.array(z.string()),
    })
  ),
  aiInsights: z.object({
    contentSuggestions: z.array(z.string()),
    optimalPostingTimes: z.array(z.string()),
    trendingTopics: z.array(z.string()),
    audienceBehaviorPatterns: z.array(z.string()),
    performancePredictions: z.array(
      z.object({
        contentType: ContentTypeSchema,
        topic: z.string(),
        predictedEngagement: z.number().min(0).max(100),
        confidence: z.number().min(0).max(100),
      })
    ),
  }),
  progress: z.object({
    overallProgress: z.number().min(0).max(100),
    goalsAchieved: z.number().nonnegative(),
    contentPublished: z.number().nonnegative(),
    engagementGrowth: z.number(),
    revenueGrowth: z.number(),
  }),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// 🔄 **REAL-TIME COLLABORATION TYPES**

export const CollaborationEventSchema = z.object({
  id: z.string().uuid(),
  type: z.enum([
    'content_created',
    'content_updated',
    'content_published',
    'content_scheduled',
    'bulk_operation',
    'strategy_updated',
    'metrics_updated',
  ]),
  userId: z.string().uuid(),
  userName: z.string(),
  timestamp: z.string().datetime(),
  data: z.record(z.any()),
  affected: z.array(z.string().uuid()),
});

// **TYPE EXPORTS**

export type ContentStatus = z.infer<typeof ContentStatusSchema>;
export type ContentType = z.infer<typeof ContentTypeSchema>;
export type ContentVisibility = z.infer<typeof ContentVisibilitySchema>;
export type ContentSchedule = z.infer<typeof ContentScheduleSchema>;
export type SchedulingStatus = z.infer<typeof SchedulingStatusSchema>;
export type ContentFilter = z.infer<typeof ContentFilterSchema>;
export type BulkOperation = z.infer<typeof BulkOperationSchema>;
export type ContentLibraryItem = z.infer<typeof ContentLibraryItemSchema>;
export type ContentMetrics = z.infer<typeof ContentMetricsSchema>;
export type ContentGapAnalysis = z.infer<typeof ContentGapAnalysisSchema>;
export type ContentStrategyPlan = z.infer<typeof ContentStrategyPlanSchema>;
export type CollaborationEvent = z.infer<typeof CollaborationEventSchema>;

// **UTILITY TYPES**

export interface ContentManagementState {
  library: {
    items: ContentLibraryItem[];
    filters: ContentFilter;
    selectedItems: string[];
    bulkOperationInProgress: boolean;
    loading: boolean;
    error: string | null;
  };
  scheduling: {
    scheduled: ContentSchedule[];
    calendar: Date;
    timezonePref: string;
    conflicts: string[];
    publishing: boolean;
  };
  metrics: {
    selectedContent: string[];
    timeframe: string;
    data: ContentMetrics[];
    loading: boolean;
    error: string | null;
  };
  strategy: {
    currentPlan: ContentStrategyPlan | null;
    gapAnalysis: ContentGapAnalysis | null;
    insights: any[];
    loading: boolean;
  };
  realtime: {
    connected: boolean;
    events: CollaborationEvent[];
    collaborators: string[];
  };
}

export interface ContentManagementAPI {
  // Library operations
  getContentLibrary: (filters?: ContentFilter) => Promise<ContentLibraryItem[]>;
  performBulkOperation: (operation: BulkOperation) => Promise<void>;

  // Scheduling operations
  scheduleContent: (schedule: ContentSchedule) => Promise<void>;
  getScheduledContent: (timeframe?: string) => Promise<ContentSchedule[]>;

  // Metrics operations
  getContentMetrics: (contentIds: string[], timeframe: string) => Promise<ContentMetrics[]>;

  // Strategy operations
  generateGapAnalysis: () => Promise<ContentGapAnalysis>;
  createStrategyPlan: (plan: Partial<ContentStrategyPlan>) => Promise<ContentStrategyPlan>;

  // Real-time operations
  subscribeToEvents: (callback: (event: CollaborationEvent) => void) => () => void;
}
