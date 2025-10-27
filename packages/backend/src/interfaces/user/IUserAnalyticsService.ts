/**
 * User Analytics Service Interface
 * User Story: US-E5-023
 * Defines contract for comprehensive user growth and engagement analytics
 * Part of Epic 005 - Backend Service Layer Refactoring
 */

import {
  UserAcquisitionMetrics,
  EngagementMetrics,
  RetentionMetrics,
  CohortAnalysis,
  UserSegment,
  UserSegmentCriteria,
  UserJourneyFunnel,
  LifetimeValueMetrics,
  ChurnAnalysis,
  ChurnPrediction,
  UserGrowthTrends,
  UserHealthScore,
  RealtimeDashboardData,
  AnalyticsExportOptions,
  AnalyticsExportResult,
  AnalyticsTimeRange,
  AnalyticsQueryFilters,
  UserActivityEvent
} from '../../types/user-analytics';

/**
 * User Analytics Service Interface
 *
 * Provides comprehensive analytics capabilities for user growth and engagement:
 * - User acquisition tracking and source attribution
 * - Engagement metrics (DAU/MAU/WAU) and activity patterns
 * - Cohort analysis and retention tracking
 * - User segmentation and journey analytics
 * - Lifetime value calculations
 * - Churn prediction and risk analysis
 * - User health scoring
 * - Real-time analytics dashboard data
 * - Analytics data export
 */
export interface IUserAnalyticsService {
  /**
   * Get user acquisition metrics for a time period
   * Tracks new user signups, growth rate, and conversion sources
   *
   * @param timeRange - Time period for metrics
   * @returns User acquisition metrics including sources and conversion rates
   */
  getUserAcquisitionMetrics(timeRange: AnalyticsTimeRange): Promise<UserAcquisitionMetrics>;

  /**
   * Get engagement metrics (DAU/MAU/WAU)
   * Measures active user counts, session data, and stickiness
   *
   * @param timeRange - Time period for metrics
   * @returns Engagement metrics with time-series data
   */
  getEngagementMetrics(timeRange: AnalyticsTimeRange): Promise<EngagementMetrics>;

  /**
   * Get retention metrics for a cohort
   * Calculates Day 1, 7, 30 retention rates and retention curve
   *
   * @param cohortDate - Starting date of cohort
   * @returns Retention metrics and curve data
   */
  getRetentionMetrics(cohortDate: Date): Promise<RetentionMetrics>;

  /**
   * Perform cohort analysis
   * Analyzes user behavior and retention by signup cohort
   *
   * @param startDate - Cohort start date
   * @param endDate - Cohort end date
   * @returns Cohort analysis with retention and LTV data
   */
  getCohortAnalysis(startDate: Date, endDate: Date): Promise<CohortAnalysis[]>;

  /**
   * Segment users based on criteria
   * Groups users by activity, content preferences, location, etc.
   *
   * @param criteria - Segmentation criteria
   * @returns User segments with analytics
   */
  segmentUsers(criteria: UserSegmentCriteria): Promise<UserSegment[]>;

  /**
   * Get user segment by ID
   * Retrieves detailed analytics for a specific segment
   *
   * @param segmentId - Segment identifier
   * @returns User segment with current metrics
   */
  getUserSegment(segmentId: string): Promise<UserSegment>;

  /**
   * Analyze user journey funnel
   * Tracks conversion through defined steps and identifies drop-off points
   *
   * @param funnelId - Funnel identifier
   * @param timeRange - Time period for analysis
   * @returns Funnel analysis with step-by-step breakdown
   */
  analyzeUserJourney(funnelId: string, timeRange: AnalyticsTimeRange): Promise<UserJourneyFunnel>;

  /**
   * Calculate lifetime value metrics
   * Computes LTV, payback period, and LTV/CAC ratio
   *
   * @param segment - Optional segment filter
   * @returns LTV metrics and distribution
   */
  calculateLifetimeValue(segment?: string): Promise<LifetimeValueMetrics>;

  /**
   * Analyze churn and predict at-risk users
   * Identifies churned users and predicts future churn risk
   *
   * @param timeRange - Time period for analysis
   * @returns Churn analysis with predictions and risk segments
   */
  analyzeChurn(timeRange: AnalyticsTimeRange): Promise<ChurnAnalysis>;

  /**
   * Predict churn for specific user
   * Calculates churn risk score and identifies contributing factors
   *
   * @param userId - User identifier
   * @returns Churn prediction with risk factors
   */
  predictUserChurn(userId: string): Promise<ChurnPrediction>;

  /**
   * Get user growth trends
   * Analyzes growth patterns, seasonality, and projects future growth
   *
   * @param timeRange - Time period for analysis
   * @returns Growth trends with projections
   */
  getUserGrowthTrends(timeRange: AnalyticsTimeRange): Promise<UserGrowthTrends>;

  /**
   * Calculate user health score
   * Comprehensive scoring based on engagement, risk, and value
   *
   * @param userId - User identifier
   * @returns User health score with component breakdown
   */
  getUserHealthScore(userId: string): Promise<UserHealthScore>;

  /**
   * Get real-time dashboard data
   * Current active users, sessions, and recent activity
   *
   * @returns Real-time analytics data
   */
  getRealtimeDashboard(): Promise<RealtimeDashboardData>;

  /**
   * Export analytics data
   * Generates export file in requested format (CSV/JSON/XLSX)
   *
   * @param options - Export configuration
   * @returns Export result with download URL
   */
  exportAnalytics(options: AnalyticsExportOptions): Promise<AnalyticsExportResult>;

  /**
   * Track user activity event
   * Records user activity for analytics processing
   * Event-driven data collection
   *
   * @param event - User activity event
   */
  trackActivity(event: UserActivityEvent): Promise<void>;

  /**
   * Process analytics aggregations
   * Background job for computing hourly/daily aggregates
   * Should be called by scheduled job
   *
   * @param interval - Aggregation interval
   */
  processAggregations(interval: 'hourly' | 'daily'): Promise<void>;

  /**
   * Get analytics by custom query
   * Flexible querying with filters and grouping
   *
   * @param filters - Query filters and options
   * @returns Query results
   */
  queryAnalytics(filters: AnalyticsQueryFilters): Promise<any>;

  /**
   * Refresh cached analytics
   * Invalidates and recomputes cached metrics
   *
   * @param metricType - Type of metric to refresh (optional, all if not specified)
   */
  refreshCache(metricType?: string): Promise<void>;
}
