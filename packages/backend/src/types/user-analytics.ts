/**
 * User Analytics Type Definitions
 * User Story: US-E5-023
 * Comprehensive types for user growth and engagement analytics
 * Part of Epic 005 - Backend Service Layer Refactoring
 */

/**
 * Time range for analytics queries
 */
export interface AnalyticsTimeRange {
  startDate: Date;
  endDate: Date;
  timezone?: string;
}

/**
 * User acquisition metrics
 */
export interface UserAcquisitionMetrics {
  period: AnalyticsTimeRange;
  newUsers: number;
  totalUsers: number;
  growthRate: number; // Percentage
  sources: SignupSource[];
  conversionRate: number; // Percentage from visitor to signup
  averageTimeToSignup: number; // Milliseconds
  topReferrers: ReferrerMetric[];
}

/**
 * Signup source breakdown
 */
export interface SignupSource {
  source: string; // 'organic', 'referral', 'social', 'paid', 'email'
  medium?: string;
  campaign?: string;
  count: number;
  percentage: number;
  conversionRate: number;
}

/**
 * Referrer traffic metrics
 */
export interface ReferrerMetric {
  referrer: string;
  visits: number;
  signups: number;
  conversionRate: number;
}

/**
 * Engagement metrics (DAU/MAU/WAU)
 */
export interface EngagementMetrics {
  period: AnalyticsTimeRange;
  dailyActiveUsers: number; // DAU
  weeklyActiveUsers: number; // WAU
  monthlyActiveUsers: number; // MAU
  dauMauRatio: number; // Stickiness metric
  wauMauRatio: number;
  averageSessionDuration: number; // Seconds
  averageActionsPerUser: number;
  engagementRate: number; // Percentage of active vs total users
  timeSeriesData: EngagementTimeSeriesPoint[];
}

/**
 * Time-series engagement data point
 */
export interface EngagementTimeSeriesPoint {
  timestamp: Date;
  activeUsers: number;
  sessions: number;
  averageDuration: number;
  bounceRate: number;
}

/**
 * User retention metrics
 */
export interface RetentionMetrics {
  cohortDate: Date;
  cohortSize: number;
  day1Retention: number; // Percentage
  day7Retention: number;
  day30Retention: number;
  day90Retention: number;
  retentionCurve: RetentionCurvePoint[];
}

/**
 * Retention curve data point
 */
export interface RetentionCurvePoint {
  day: number;
  activeUsers: number;
  retentionRate: number; // Percentage
}

/**
 * Cohort analysis data
 */
export interface CohortAnalysis {
  cohortId: string;
  cohortDate: Date;
  cohortSize: number;
  retentionData: CohortRetentionData[];
  lifetimeValue: number;
  churnRate: number;
  averageLifespan: number; // Days
}

/**
 * Cohort retention breakdown by period
 */
export interface CohortRetentionData {
  period: number; // Days from cohort start
  activeUsers: number;
  retentionRate: number;
  churnedUsers: number;
  revenue?: number;
}

/**
 * User segmentation criteria
 */
export interface UserSegmentCriteria {
  activityLevel?: 'high' | 'medium' | 'low' | 'inactive';
  contentType?: string[]; // Content preferences
  location?: string[]; // Country, region, city
  signupSource?: string;
  lifetimeValue?: { min?: number; max?: number };
  tenure?: { min?: number; max?: number }; // Days since signup
  engagementScore?: { min?: number; max?: number };
}

/**
 * User segment analysis result
 */
export interface UserSegment {
  segmentId: string;
  name: string;
  criteria: UserSegmentCriteria;
  userCount: number;
  percentage: number;
  averageEngagement: number;
  averageLTV: number;
  churnRate: number;
  topActions: ActionMetric[];
}

/**
 * Action/event metric
 */
export interface ActionMetric {
  action: string;
  count: number;
  uniqueUsers: number;
  frequency: number; // Average per user
}

/**
 * User journey funnel analysis
 */
export interface UserJourneyFunnel {
  funnelId: string;
  name: string;
  steps: FunnelStep[];
  totalEntries: number;
  completionRate: number; // Percentage
  averageTimeToComplete: number; // Milliseconds
  dropOffPoints: DropOffPoint[];
}

/**
 * Funnel step data
 */
export interface FunnelStep {
  stepNumber: number;
  stepName: string;
  action: string;
  users: number;
  dropOffRate: number; // Percentage
  conversionToNext: number; // Percentage
  averageTimeOnStep: number; // Milliseconds
}

/**
 * Drop-off analysis
 */
export interface DropOffPoint {
  step: string;
  nextStep: string;
  dropOffRate: number;
  userCount: number;
  commonReasons?: string[];
}

/**
 * Lifetime value (LTV) calculation
 */
export interface LifetimeValueMetrics {
  segment?: string;
  averageLTV: number;
  medianLTV: number;
  ltvDistribution: LTVDistribution[];
  paybackPeriod: number; // Days
  customerAcquisitionCost: number; // CAC
  ltvToCacRatio: number;
}

/**
 * LTV distribution bracket
 */
export interface LTVDistribution {
  range: { min: number; max: number };
  userCount: number;
  percentage: number;
  revenue: number;
}

/**
 * Churn prediction and analysis
 */
export interface ChurnAnalysis {
  period: AnalyticsTimeRange;
  churnRate: number; // Percentage
  churnedUsers: number;
  totalUsers: number;
  predictedChurn: ChurnPrediction[];
  riskSegments: ChurnRiskSegment[];
  retentionOpportunities: RetentionOpportunity[];
}

/**
 * User churn prediction
 */
export interface ChurnPrediction {
  userId: string;
  riskScore: number; // 0-100
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  factors: ChurnRiskFactor[];
  lastActivity: Date;
  recommendedActions: string[];
}

/**
 * Churn risk factor
 */
export interface ChurnRiskFactor {
  factor: string;
  weight: number; // 0-1
  value: number;
  impact: 'positive' | 'negative';
}

/**
 * Churn risk segment analysis
 */
export interface ChurnRiskSegment {
  segment: string;
  userCount: number;
  riskScore: number;
  churnRate: number;
  commonFactors: string[];
}

/**
 * Retention opportunity identification
 */
export interface RetentionOpportunity {
  opportunityType: string;
  affectedUsers: number;
  potentialImpact: number; // Percentage improvement
  recommendedAction: string;
  estimatedCost?: number;
}

/**
 * User growth trend analysis
 */
export interface UserGrowthTrends {
  period: AnalyticsTimeRange;
  growthRate: number; // Percentage
  growthType: 'linear' | 'exponential' | 'plateau' | 'declining';
  projection: GrowthProjection;
  seasonality: SeasonalityPattern[];
  trends: TrendPoint[];
}

/**
 * Growth projection
 */
export interface GrowthProjection {
  method: 'linear' | 'exponential' | 'moving_average';
  projectedUsers: number;
  projectionDate: Date;
  confidenceInterval: { lower: number; upper: number };
  accuracy?: number; // Historical accuracy percentage
}

/**
 * Seasonality pattern
 */
export interface SeasonalityPattern {
  pattern: 'daily' | 'weekly' | 'monthly' | 'yearly';
  peakPeriods: string[];
  averageVariance: number; // Percentage
}

/**
 * Trend data point
 */
export interface TrendPoint {
  timestamp: Date;
  value: number;
  movingAverage?: number;
  trend: 'up' | 'down' | 'stable';
}

/**
 * User health score
 */
export interface UserHealthScore {
  userId: string;
  overallScore: number; // 0-100
  engagementScore: number; // 0-100
  riskScore: number; // 0-100 (lower is better)
  valueScore: number; // 0-100
  components: HealthScoreComponent[];
  lastUpdated: Date;
  healthTrend: 'improving' | 'stable' | 'declining';
}

/**
 * Health score component breakdown
 */
export interface HealthScoreComponent {
  component: string;
  score: number;
  weight: number;
  metrics: Record<string, number>;
}

/**
 * Real-time analytics dashboard data
 */
export interface RealtimeDashboardData {
  timestamp: Date;
  activeUsers: number;
  activeSessions: number;
  eventsPerSecond: number;
  recentSignups: number;
  recentActivity: RecentActivitySummary[];
  alerts: AnalyticsAlert[];
}

/**
 * Recent activity summary
 */
export interface RecentActivitySummary {
  activityType: string;
  count: number;
  trend: 'up' | 'down' | 'stable';
  percentChange: number;
}

/**
 * Analytics alert/anomaly
 */
export interface AnalyticsAlert {
  alertId: string;
  severity: 'info' | 'warning' | 'critical';
  metric: string;
  message: string;
  timestamp: Date;
  threshold?: number;
  currentValue?: number;
}

/**
 * Analytics export options
 */
export interface AnalyticsExportOptions {
  format: 'csv' | 'json' | 'xlsx';
  metrics: string[]; // Which metrics to include
  timeRange: AnalyticsTimeRange;
  groupBy?: 'day' | 'week' | 'month';
  includeRawData?: boolean;
  compress?: boolean;
}

/**
 * Analytics export result
 */
export interface AnalyticsExportResult {
  exportId: string;
  format: string;
  size: number; // Bytes
  url?: string;
  expiresAt: Date;
  recordCount: number;
}

/**
 * Analytics query filters
 */
export interface AnalyticsQueryFilters {
  timeRange: AnalyticsTimeRange;
  userSegment?: UserSegmentCriteria;
  metrics?: string[];
  groupBy?: 'hour' | 'day' | 'week' | 'month';
  limit?: number;
  offset?: number;
}

/**
 * Analytics aggregation configuration
 */
export interface AnalyticsAggregationConfig {
  interval: 'hourly' | 'daily' | 'weekly' | 'monthly';
  metrics: string[];
  retentionPeriod: number; // Days
  compressionThreshold: number; // Days before compression
}

/**
 * User activity event for analytics processing
 */
export interface UserActivityEvent {
  userId: string;
  eventType: string;
  eventData: Record<string, any>;
  timestamp: Date;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}

/**
 * Analytics processing job
 */
export interface AnalyticsJob {
  jobId: string;
  jobType: 'aggregation' | 'cohort' | 'prediction' | 'export';
  status: 'pending' | 'running' | 'completed' | 'failed';
  priority: number;
  scheduledAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  progress?: number; // 0-100
  result?: any;
  error?: string;
}
