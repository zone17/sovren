/**
 * Content Analytics Service Types
 * Epic 005 - US-E5-016
 * Real-time and historical analytics types for content engagement tracking
 */

// ============================================================================
// Core Engagement Types
// ============================================================================

export enum MetricType {
  VIEW = 'view',
  LIKE = 'like',
  SHARE = 'share',
  COMMENT = 'comment',
  SAVE = 'save',
  CLICK = 'click',
  COMPLETION = 'completion',
}

export enum AggregationDimension {
  CONTENT = 'content',
  USER = 'user',
  HOUR = 'hour',
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
}

export interface EngagementMetrics {
  contentId: string;
  userId: string;
  eventType: MetricType;
  timestamp: Date;
  metadata?: {
    duration?: number;
    userAgent?: string;
    referrer?: string;
    sessionId?: string;
    position?: number;
    [key: string]: any;
  };
}

export interface AnalyticsEvent {
  id?: string;
  contentId: string;
  userId?: string;
  eventType: MetricType;
  timestamp: Date;
  metadata?: Record<string, any>;
}

// ============================================================================
// Query and Filter Types
// ============================================================================

export interface AnalyticsQuery {
  contentIds?: string[];
  userId?: string;
  startDate: Date;
  endDate: Date;
  metrics?: MetricType[];
  dimensions?: AggregationDimension[];
  interval?: 'minute' | 'hour' | 'day' | 'week' | 'month';
  includeTimeSeries?: boolean;
  filters?: Record<string, any>;
}

export interface TimeRange {
  start: Date;
  end: Date;
}

export interface AggregateQuery {
  contentIds?: string[];
  dimensions: AggregationDimension[];
  metrics: MetricType[];
  timeRange: TimeRange;
  groupBy?: string[];
  orderBy?: string;
  limit?: number;
}

export interface ExportQuery {
  contentIds?: string[];
  startDate: Date;
  endDate: Date;
  format: 'json' | 'csv' | 'xlsx';
  metrics?: MetricType[];
  includeRawEvents?: boolean;
}

// ============================================================================
// Result Types
// ============================================================================

export interface AnalyticsResult {
  query: AnalyticsQuery;
  metrics: Record<string, any>;
  timeSeries?: TimeSeriesData[];
  performance?: ContentPerformance;
  totalEvents: number;
  uniqueUsers: number;
  generatedAt: Date;
}

export interface TimeSeriesData {
  timestamp: Date;
  metrics: Record<string, number>;
}

export interface ContentPerformance {
  engagementRate: number;
  viralityScore: number;
  averageViewDuration: number;
  completionRate: number;
  interactionRate: number;
  shareRate: number;
}

export interface AggregateResults {
  dimensions: Record<string, any>;
  metrics: Record<string, number>;
  breakdown: Array<{
    key: string;
    value: number;
    percentage: number;
  }>;
  total: number;
  generatedAt: Date;
}

export interface ExportResult {
  format: string;
  data: Buffer | string;
  filename: string;
  contentType: string;
  rowCount: number;
  generatedAt: Date;
}

// ============================================================================
// Dashboard Types
// ============================================================================

export interface AnalyticsDashboard {
  summary: DashboardSummary;
  daily: AnalyticsResult;
  weekly: AnalyticsResult;
  realtime: Record<string, any>;
  topContent: ContentPerformance[];
  trends: TrendData;
  generatedAt: Date;
}

export interface DashboardSummary {
  totalViews: number;
  totalLikes: number;
  totalShares: number;
  totalComments: number;
  uniqueViewers: number;
  engagementRate: number;
  averageViewDuration: number;
}

export interface TrendData {
  viewsTrend: number; // Growth rate percentage
  engagementTrend: number;
  popularityTrend?: number;
  [key: string]: number | undefined;
}

export interface ContentMetrics {
  contentId: string;
  views: number;
  uniqueViews: number;
  likes: number;
  shares: number;
  comments: number;
  saves: number;
  clicks: number;
  avgViewDuration: number;
  completionRate: number;
  engagementRate: number;
  period: TimeRange;
}

// ============================================================================
// Service Interface
// ============================================================================

export interface IContentAnalyticsService {
  /**
   * Track an engagement event in real-time
   */
  trackEngagement(
    contentId: string,
    userId: string,
    eventType: MetricType,
    metadata?: Record<string, any>
  ): Promise<void>;

  /**
   * Get analytics for content with flexible querying
   */
  getAnalytics(query: AnalyticsQuery): Promise<AnalyticsResult>;

  /**
   * Get real-time dashboard metrics
   */
  getDashboardMetrics(contentIds?: string[]): Promise<AnalyticsDashboard>;

  /**
   * Get aggregated metrics by dimensions
   */
  getAggregates?(query: AggregateQuery): Promise<AggregateResults>;

  /**
   * Export analytics data in various formats
   */
  exportData?(query: ExportQuery): Promise<ExportResult>;

  /**
   * Cleanup resources on shutdown
   */
  shutdown(): Promise<void>;
}

// ============================================================================
// Time Series Storage Interface
// ============================================================================

export interface ITimeSeriesDB {
  /**
   * Write a single metric point
   */
  write(metric: TimeSeriesMetric): Promise<void>;

  /**
   * Write multiple metric points in batch
   */
  writeBatch(metrics: TimeSeriesMetric[]): Promise<void>;

  /**
   * Query metrics with time range and filters
   */
  query(query: TimeSeriesQuery): Promise<TimeSeriesData[]>;

  /**
   * Aggregate metrics over time periods
   */
  aggregate(query: AggregationQuery): Promise<AggregateResults>;

  /**
   * Delete old metrics (data retention)
   */
  deleteOlderThan(date: Date): Promise<number>;
}

export interface TimeSeriesMetric {
  measurement: string;
  tags: Record<string, string>;
  fields: Record<string, number>;
  timestamp: Date;
}

export interface TimeSeriesQuery {
  measurement: string;
  start: Date;
  end: Date;
  tags?: Record<string, string>;
  fields?: string[];
  groupBy?: string[];
  interval?: string;
}

export interface AggregationQuery {
  measurement: string;
  start: Date;
  end: Date;
  aggregations: Array<{
    field: string;
    function: 'sum' | 'avg' | 'min' | 'max' | 'count';
  }>;
  groupBy?: string[];
  interval?: string;
}

// ============================================================================
// Event Bus Types (for real-time updates)
// ============================================================================

export interface AnalyticsEventPayload {
  event: 'engagement:tracked' | 'metrics:flushed' | 'analytics:exported';
  data: any;
  timestamp: Date;
}
