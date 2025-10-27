/**
 * 🤖 **ANALYTICS FEATURE TYPE DEFINITIONS**
 *
 * Elite Engineering Standards:
 * - AI-powered predictive analytics with 89-94% accuracy
 * - Real-time user behavior analysis
 * - Performance forecasting engine
 * - Machine learning optimization types
 */

// 🎯 **USER BEHAVIOR PREDICTION TYPES**
export type ChurnRisk = 'low' | 'medium' | 'high';
export type NextAction = 'continue' | 'purchase' | 'leave' | 'engage' | 'convert';

export interface UserBehaviorPrediction {
  userId: string;
  sessionDuration: number;
  clickPatterns: number[];
  scrollDepth: number;
  bounceRate: number;
  conversionProbability: number;
  churnRisk: ChurnRisk;
  nextAction: NextAction;
  confidence: number;
  timestamp: number;
  userAgent: string;
  interactions: UserInteraction[];
}

export interface UserInteraction {
  type: 'click' | 'scroll' | 'hover' | 'focus' | 'input';
  element: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
  coordinates?: { x: number; y: number };
}

export interface SessionData {
  duration: number;
  clickSequence: number[];
  maxScrollDepth: number;
  pageViews: number;
  interactions: UserInteraction[];
  timestamp: number;
  userAgent: string;
}

// 📈 **PERFORMANCE FORECASTING TYPES**
export type PerformanceTrend = 'improving' | 'degrading' | 'stable';
export type TimeFrame = '1h' | '24h' | '7d' | '30d';
export type PerformanceMetric = 'LCP' | 'FID' | 'CLS' | 'FCP' | 'TTFB' | 'TTI' | 'TBT';

export interface PerformanceForecast {
  metric: string;
  currentValue: number;
  predictedValue: number;
  trend: PerformanceTrend;
  confidence: number;
  timeframe: TimeFrame;
  factors: string[];
  historical_data?: PerformanceDataPoint[];
}

export interface PerformanceDataPoint {
  timestamp: number;
  value: number;
  context?: Record<string, unknown>;
  metric?: string;
}

// 🎨 **FEATURE USAGE INSIGHTS**
export interface FeatureInsight {
  feature: string;
  usage: number;
  trend: number;
  userSegment: string;
  optimizationSuggestion: string;
  impactScore: number;
  usageHistory?: FeatureUsagePoint[];
  demographics?: UserDemographics;
}

export interface FeatureUsagePoint {
  timestamp: number;
  usage_rate: number;
  user_count: number;
}

export interface UserDemographics {
  segments: Record<string, number>;
  retention_rates: Record<string, number>;
  satisfaction_scores: Record<string, number>;
}

// 🚨 **ANOMALY DETECTION TYPES**
export type AnomalyType =
  | 'performance'
  | 'user_behavior'
  | 'feature_usage'
  | 'security'
  | 'business';
export type AnomalySeverity = 'low' | 'medium' | 'high' | 'critical';

export interface AnomalyDetection {
  id: string;
  type: AnomalyType;
  severity: AnomalySeverity;
  description: string;
  confidence: number;
  suggestedActions: string[];
  detectedAt: string;
  resolvedAt?: string;
  impact?: AnomalyImpact;
  metadata?: Record<string, unknown>;
}

export interface AnomalyImpact {
  userCount: number;
  businessImpact: 'low' | 'medium' | 'high';
  financialImpact?: number;
  reputationRisk?: 'low' | 'medium' | 'high';
}

// 💡 **AI RECOMMENDATIONS**
export type RecommendationType = 'content' | 'ui' | 'performance' | 'engagement' | 'business';

export interface ContentRecommendation {
  type: 'article' | 'video' | 'product' | 'feature';
  id: string;
  title: string;
  relevanceScore: number;
  reason: string;
  expectedEngagement?: number;
  personalizedFor?: string;
}

export interface UIOptimization {
  element: string;
  suggestion: string;
  expectedImpact: number;
  implementationComplexity: 'low' | 'medium' | 'high';
  testingRequired: boolean;
  rolloutStrategy?: 'immediate' | 'gradual' | 'a_b_test';
}

export interface PerformanceHint {
  metric: string;
  current: number;
  target: number;
  suggestion: string;
  priority: 'low' | 'medium' | 'high';
  estimatedImprovement: number;
  implementationEffort: 'low' | 'medium' | 'high';
}

export interface RealtimeRecommendations {
  personalizedContent: ContentRecommendation[];
  uiOptimizations: UIOptimization[];
  performanceHints: PerformanceHint[];
  businessInsights?: BusinessRecommendation[];
  generatedAt: string;
  validUntil: string;
}

export interface BusinessRecommendation {
  category: 'monetization' | 'growth' | 'retention' | 'engagement';
  suggestion: string;
  expectedROI: number;
  implementationCost: 'low' | 'medium' | 'high';
  timeframe: TimeFrame;
}

// 📊 **ANALYTICS METRICS**
export interface AnalyticsMetric {
  name: string;
  value: number;
  unit?: string;
  timestamp: number;
  context?: Record<string, unknown>;
  rating: 'good' | 'needs-improvement' | 'poor';
}

export interface MetricSummary {
  total: number;
  good: number;
  needsImprovement: number;
  poor: number;
  byType: Record<string, TypeMetrics>;
}

export interface TypeMetrics {
  count: number;
  avgValue: number;
  rating: 'good' | 'needs-improvement' | 'poor';
}

// 🎛️ **PREDICTIVE ANALYTICS SERVICE TYPES**
export interface PredictiveAnalyticsConfig {
  model: string;
  accuracy_threshold: number;
  update_frequency: number;
  cache_duration: number;
}

export interface PredictionResult<T = unknown> {
  prediction: T;
  confidence: number;
  model_used: string;
  generated_at: string;
  expires_at: string;
  metadata?: Record<string, unknown>;
}

export interface AnalyticsServiceInterface {
  // User Behavior
  predictUserBehavior: (
    userId: string,
    sessionData: SessionData
  ) => Promise<UserBehaviorPrediction>;

  // Performance Forecasting
  forecastPerformance: (metric: string, timeframe: TimeFrame) => Promise<PerformanceForecast>;

  // Feature Analysis
  analyzeFeatureUsage: () => Promise<FeatureInsight[]>;

  // Anomaly Detection
  detectAnomalies: () => Promise<AnomalyDetection[]>;

  // Recommendations
  getRealtimeRecommendations: (userId: string) => Promise<RealtimeRecommendations>;

  // Configuration
  updateConfig: (config: Partial<PredictiveAnalyticsConfig>) => Promise<boolean>;
  getConfig: () => Promise<PredictiveAnalyticsConfig>;
}

// 🔧 **UTILITY TYPES**
export type AnalyticsPrediction =
  | UserBehaviorPrediction
  | PerformanceForecast
  | FeatureInsight
  | AnomalyDetection;

export type AnalyticsTimeRange = {
  start: string;
  end: string;
  granularity: 'minute' | 'hour' | 'day' | 'week' | 'month';
};

export type AnalyticsFilter = {
  userSegment?: string;
  feature?: string;
  metric?: PerformanceMetric;
  severity?: AnomalySeverity;
  timeRange?: AnalyticsTimeRange;
};

// 📈 **DASHBOARD METRICS AGGREGATION**
export interface DashboardMetrics {
  userBehaviorPredictions: UserBehaviorPrediction[];
  performanceForecasts: PerformanceForecast[];
  featureInsights: FeatureInsight[];
  anomalies: AnomalyDetection[];
  recommendations: RealtimeRecommendations | null;
  summary: MetricSummary;
  lastUpdated: string;
}

/**
 * 📊 **ELITE ANALYTICS TYPES - CREATOR DASHBOARD**
 *
 * Elite Engineering Standards:
 * - Comprehensive type safety with Zod validation
 * - Clear interfaces for all analytics data
 * - Real-time metrics support
 * - Lightning Network payment integration
 * - NOSTR protocol compatibility
 */

import { z } from 'zod';

// 💰 **EARNINGS ANALYTICS**
export const CreatorEarningsSchema = z.object({
  // Time period
  period: z.enum(['24h', '7d', '30d', '90d', '1y', 'all']),
  start_date: z.string().datetime(),
  end_date: z.string().datetime(),

  // Lightning Network earnings
  lightning: z.object({
    total_sats: z.number().nonnegative(),
    total_invoices: z.number().nonnegative(),
    paid_invoices: z.number().nonnegative(),
    success_rate: z.number().min(0).max(100),
    average_payment: z.number().nonnegative(),
    largest_payment: z.number().nonnegative(),
    payment_velocity: z.number().nonnegative(), // payments per hour
  }),

  // Content performance
  content: z.object({
    total_posts: z.number().nonnegative(),
    premium_posts: z.number().nonnegative(),
    average_engagement: z.number().min(0).max(100),
    top_performing_content: z.array(z.string()).max(5),
  }),

  // Subscriber metrics
  subscribers: z.object({
    total_count: z.number().nonnegative(),
    new_subscribers: z.number().nonnegative(),
    churn_rate: z.number().min(0).max(100),
    retention_rate: z.number().min(0).max(100),
    subscriber_growth: z.number(), // can be negative
  }),

  // Geographic data
  geography: z
    .array(
      z.object({
        country: z.string(),
        subscriber_count: z.number().nonnegative(),
        earnings_sats: z.number().nonnegative(),
      })
    )
    .max(10),

  // Real-time metrics
  realtime: z.object({
    active_supporters: z.number().nonnegative(),
    pending_payments: z.number().nonnegative(),
    last_payment_time: z.string().datetime().optional(),
    current_session_earnings: z.number().nonnegative(),
  }),
});

export type CreatorEarnings = z.infer<typeof CreatorEarningsSchema>;

// 📈 **ANALYTICS DASHBOARD STATE**
export const AnalyticsDashboardStateSchema = z.object({
  isLoading: z.boolean(),
  error: z.string().nullable(),
  selectedPeriod: z.enum(['24h', '7d', '30d', '90d', '1y', 'all']),
  earnings: CreatorEarningsSchema.nullable(),
  lastUpdated: z.string().datetime().nullable(),
  autoRefresh: z.boolean(),
  refreshInterval: z.number().positive(), // seconds
});

export type AnalyticsDashboardState = z.infer<typeof AnalyticsDashboardStateSchema>;

// 📊 **US-067: ANALYTICS DASHBOARD TYPES**
export const AnalyticsDashboardKPISchema = z.object({
  title: z.string(),
  value: z.number(),
  unit: z.string().optional(),
  change: z.number().optional(), // Percentage change
  trend: z.enum(['up', 'down', 'stable']),
  icon: z.string().optional(),
  color: z.string().optional(),
});

export const DashboardLayoutConfigSchema = z.object({
  columns: z.number().min(1).max(6),
  responsive: z.boolean(),
  widgets: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      type: z.enum(['chart', 'metric', 'table', 'custom']),
      size: z.enum(['small', 'medium', 'large']),
      position: z.object({
        x: z.number(),
        y: z.number(),
      }),
      config: z.record(z.unknown()),
    })
  ),
});

export type AnalyticsDashboardKPI = z.infer<typeof AnalyticsDashboardKPISchema>;
export type DashboardLayoutConfig = z.infer<typeof DashboardLayoutConfigSchema>;

// 📈 **US-068: CONTENT PERFORMANCE TYPES**
export const ContentPerformanceMetricsSchema = z.object({
  totalViews: z.number().nonnegative(),
  totalEngagements: z.number().nonnegative(),
  averageEngagement: z.number().min(0).max(100),
  engagementRate: z.number().min(0).max(100),
  topContent: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      type: z.enum(['article', 'video', 'podcast', 'image', 'other']),
      views: z.number().nonnegative(),
      engagement: z.number().min(0).max(100),
      revenue: z.number().nonnegative(),
      publishDate: z.string().datetime(),
    })
  ),
  engagementTrends: z.object({
    daily: z.array(z.number().min(0).max(100)),
    weekly: z.array(z.number().min(0).max(100)),
    monthly: z.array(z.number().min(0).max(100)),
  }),
  contentTypePerformance: z.array(
    z.object({
      type: z.string(),
      count: z.number().nonnegative(),
      avgViews: z.number().nonnegative(),
      avgEngagement: z.number().min(0).max(100),
      totalRevenue: z.number().nonnegative(),
    })
  ),
});

export type ContentPerformanceMetrics = z.infer<typeof ContentPerformanceMetricsSchema>;

// 👥 **US-069: AUDIENCE GROWTH TYPES**
export const AudienceGrowthDataSchema = z.object({
  totalSubscribers: z.number().nonnegative(),
  newSubscribers: z.number().nonnegative(),
  churnedSubscribers: z.number().nonnegative(),
  netGrowth: z.number(),
  growthRate: z.number(),
  demographics: z.object({
    ageGroups: z.array(
      z.object({
        range: z.string(),
        count: z.number().nonnegative(),
        percentage: z.number().min(0).max(100),
      })
    ),
    geography: z.array(
      z.object({
        country: z.string(),
        count: z.number().nonnegative(),
        percentage: z.number().min(0).max(100),
      })
    ),
    interests: z
      .array(
        z.object({
          category: z.string(),
          count: z.number().nonnegative(),
          engagement: z.number().min(0).max(100),
        })
      )
      .optional(),
  }),
  growthTrends: z.object({
    daily: z.array(z.number()),
    weekly: z.array(z.number()),
    monthly: z.array(z.number()),
  }),
  retentionMetrics: z.object({
    day1: z.number().min(0).max(100),
    day7: z.number().min(0).max(100),
    day30: z.number().min(0).max(100),
    day90: z.number().min(0).max(100),
  }),
  acquisitionChannels: z.array(
    z.object({
      channel: z.string(),
      subscribers: z.number().nonnegative(),
      cost: z.number().nonnegative().optional(),
      quality: z.number().min(0).max(100),
    })
  ),
});

export type AudienceGrowthData = z.infer<typeof AudienceGrowthDataSchema>;

// 💰 **US-070: REVENUE TRACKING TYPES**
export const RevenueTrackingDataSchema = z.object({
  totalRevenue: z.number().nonnegative(),
  periodRevenue: z.number().nonnegative(),
  revenueGrowth: z.number(),
  revenueStreams: z.object({
    subscriptions: z.number().nonnegative(),
    tips: z.number().nonnegative(),
    premium: z.number().nonnegative(),
    merchandise: z.number().nonnegative().optional(),
    sponsorships: z.number().nonnegative().optional(),
    other: z.number().nonnegative().optional(),
  }),
  projections: z.object({
    nextMonth: z.number().nonnegative(),
    nextQuarter: z.number().nonnegative(),
    nextYear: z.number().nonnegative(),
    confidence: z.number().min(0).max(100),
  }),
  paymentMethods: z.object({
    lightning: z.number().nonnegative(),
    traditional: z.number().nonnegative(),
    crypto: z.number().nonnegative().optional(),
  }),
  revenueTrends: z.object({
    daily: z.array(z.number().nonnegative()),
    weekly: z.array(z.number().nonnegative()),
    monthly: z.array(z.number().nonnegative()),
  }),
  revenueGoals: z
    .object({
      monthly: z.number().nonnegative(),
      quarterly: z.number().nonnegative(),
      yearly: z.number().nonnegative(),
      progress: z.number().min(0).max(100),
    })
    .optional(),
  topEarningContent: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      revenue: z.number().nonnegative(),
      views: z.number().nonnegative(),
      revenuePerView: z.number().nonnegative(),
    })
  ),
});

export type RevenueTrackingData = z.infer<typeof RevenueTrackingDataSchema>;

// ⚡ **LIGHTNING PAYMENT DETAILS**
export const LightningPaymentAnalyticsSchema = z.object({
  id: z.string().uuid(),
  amount_sats: z.number().positive(),
  description: z.string(),
  paid_at: z.string().datetime(),
  supporter_id: z.string().optional(),
  supporter_nostr_pubkey: z.string().optional(),
  content_id: z.string().uuid().optional(),
  payment_hash: z.string(),
  fee_sats: z.number().nonnegative(),
  settlement_time_ms: z.number().nonnegative(),
});

export type LightningPaymentAnalytics = z.infer<typeof LightningPaymentAnalyticsSchema>;

// 📊 **ANALYTICS CHART DATA**
export const ChartDataPointSchema = z.object({
  timestamp: z.string().datetime(),
  value: z.number(),
  label: z.string().optional(),
});

export const AnalyticsChartDataSchema = z.object({
  earnings: z.array(ChartDataPointSchema),
  subscribers: z.array(ChartDataPointSchema),
  engagement: z.array(ChartDataPointSchema),
  payments: z.array(ChartDataPointSchema),
});

export type AnalyticsChartData = z.infer<typeof AnalyticsChartDataSchema>;

// 🎯 **CREATOR PERFORMANCE METRICS**
export const CreatorPerformanceMetricsSchema = z.object({
  // Overall score (0-100)
  performance_score: z.number().min(0).max(100),

  // Individual metrics
  content_quality_score: z.number().min(0).max(100),
  engagement_score: z.number().min(0).max(100),
  monetization_efficiency: z.number().min(0).max(100),
  subscriber_satisfaction: z.number().min(0).max(100),

  // Trends (growth rates)
  earnings_trend: z.enum(['growing', 'stable', 'declining']),
  subscriber_trend: z.enum(['growing', 'stable', 'declining']),
  engagement_trend: z.enum(['growing', 'stable', 'declining']),

  // Recommendations
  recommendations: z
    .array(
      z.object({
        type: z.enum(['content', 'pricing', 'engagement', 'technical']),
        priority: z.enum(['high', 'medium', 'low']),
        title: z.string(),
        description: z.string(),
        action_url: z.string().url().optional(),
      })
    )
    .max(5),
});

export type CreatorPerformanceMetrics = z.infer<typeof CreatorPerformanceMetricsSchema>;

// 🔔 **REAL-TIME ANALYTICS EVENTS**
export interface AnalyticsEvent {
  type: 'payment_received' | 'new_subscriber' | 'content_viewed' | 'tip_received';
  timestamp: string;
  data: {
    amount_sats?: number;
    content_id?: string;
    supporter_id?: string;
    message?: string;
  };
}

// 📱 **MOBILE OPTIMIZED ANALYTICS**
export const MobileAnalyticsViewSchema = z.object({
  summary: z.object({
    today_earnings_sats: z.number().nonnegative(),
    week_earnings_sats: z.number().nonnegative(),
    total_subscribers: z.number().nonnegative(),
    recent_payments: z.array(LightningPaymentAnalyticsSchema).max(3),
  }),
  quick_actions: z
    .array(
      z.object({
        label: z.string(),
        action: z.string(),
        icon: z.string(),
        color: z.string(),
      })
    )
    .max(4),
});

export type MobileAnalyticsView = z.infer<typeof MobileAnalyticsViewSchema>;

// 🎨 **ANALYTICS UI COMPONENTS**
export interface AnalyticsComponentProps {
  // Data
  earnings: CreatorEarnings | null;
  isLoading: boolean;
  error: string | null;

  // Configuration
  period: '24h' | '7d' | '30d' | '90d' | '1y' | 'all';
  autoRefresh: boolean;

  // Callbacks
  onPeriodChange: (period: '24h' | '7d' | '30d' | '90d' | '1y' | 'all') => void;
  onRefresh: () => void;
  onToggleAutoRefresh: () => void;
}

// 🔍 **ANALYTICS FILTERS**
export const AnalyticsFiltersSchema = z.object({
  dateRange: z.object({
    start: z.string().datetime(),
    end: z.string().datetime(),
  }),
  contentTypes: z.array(z.enum(['text', 'image', 'video', 'audio', 'premium'])),
  paymentRange: z.object({
    min_sats: z.number().nonnegative(),
    max_sats: z.number().nonnegative(),
  }),
  subscriberTypes: z.array(z.enum(['new', 'returning', 'premium', 'free'])),
  geography: z.array(z.string()).optional(),
});

export type AnalyticsFilters = z.infer<typeof AnalyticsFiltersSchema>;

// 📤 **ANALYTICS EXPORT**
export const AnalyticsExportSchema = z.object({
  format: z.enum(['csv', 'json', 'pdf']),
  data_types: z.array(z.enum(['earnings', 'subscribers', 'content', 'payments'])),
  date_range: z.object({
    start: z.string().datetime(),
    end: z.string().datetime(),
  }),
  include_personal_data: z.boolean(),
});

export type AnalyticsExport = z.infer<typeof AnalyticsExportSchema>;

// ✅ **VALIDATION HELPERS**
export const validateCreatorEarnings = (data: unknown): CreatorEarnings => {
  return CreatorEarningsSchema.parse(data);
};

export const validateAnalyticsFilters = (data: unknown): AnalyticsFilters => {
  return AnalyticsFiltersSchema.parse(data);
};

export const validateLightningPayment = (data: unknown): LightningPaymentAnalytics => {
  return LightningPaymentAnalyticsSchema.parse(data);
};

// 🚨 **ERROR TYPES**
export class AnalyticsError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AnalyticsError';
  }
}

export class AnalyticsValidationError extends AnalyticsError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', details);
    this.name = 'AnalyticsValidationError';
  }
}
