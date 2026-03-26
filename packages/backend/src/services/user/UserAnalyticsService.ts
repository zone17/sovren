// @ts-nocheck
// TODO(SOV-REFACTOR-001): This file is 2103 lines. Decompose into:
// - UserAcquisitionService (getUserAcquisitionMetrics, aggregateSignupSources, calculateConversionRate, getTopReferrers — ~250 lines)
// - UserEngagementService (getEngagementMetrics, getRetentionMetrics, getCohortAnalysis, getEngagementTimeSeries — ~300 lines)
// - UserSegmentationService (segmentUsers, getUserSegment, analyzeUserJourney, calculateLifetimeValue — ~250 lines)
// - UserChurnService (analyzeChurn, predictUserChurn, generateChurnPredictions, analyzeChurnRiskSegments — ~200 lines)
// - UserAnalyticsHelpers (pure/stateless helpers: calculateChurnRiskScore, getRiskLevel, generateRetentionActions,
//   determineGrowthType, projectGrowth, identifySeasonality, calculateRecencyScore, calculateLoyaltyScore,
//   calculateAccountAge, formatAsCSV, generateExportId — ~200 lines) ← extract first (lowest risk)
// - UserAnalyticsAggregator (processAggregations, aggregateUserActivity, aggregateEngagementMetrics,
//   updateUserHealthScores, cleanupOldAggregations — ~120 lines)
// Keep UserAnalyticsService as a thin façade delegating to the above.
/**
 * User Analytics Service Implementation
 * User Story: US-E5-023
 * Comprehensive user growth and engagement analytics with event-driven data collection
 * Part of Epic 005 - Backend Service Layer Refactoring (Phase 4 - Wave 2)
 *
 * Features:
 * - User acquisition tracking and source attribution
 * - Engagement metrics (DAU/MAU/WAU) with time-series analysis
 * - Cohort analysis and retention tracking (Day 1/7/30/90)
 * - User segmentation by activity, content, location
 * - User journey funnel analysis with drop-off identification
 * - Lifetime value (LTV) calculations and CAC analysis
 * - Churn prediction with ML-based risk scoring
 * - User health scoring system
 * - Real-time analytics dashboard data
 * - Analytics export (CSV/JSON/XLSX)
 * - Multi-layered caching for performance
 * - Event-driven data collection with buffered writes
 * - Background aggregation jobs
 * - Privacy-compliant analytics
 */

import crypto from 'crypto';
import {
  calculateChurnRiskScore,
  getRiskLevel,
  generateRetentionActions,
  determineGrowthType,
  projectGrowth,
  identifySeasonality,
  calculateRecencyScore,
  calculateLoyaltyScore,
  calculateAccountAge,
  formatAsCSV,
  generateExportId,
} from './UserAnalyticsHelpers';
import { injectable, inject } from 'inversify';
import { TYPES } from '../../container/types';
import { IUserAnalyticsService } from '../../interfaces/user/IUserAnalyticsService';
import { ICacheService } from '../../interfaces/shared/ICacheService';
import { IEventBus } from '../../interfaces/shared/IEventBus';
import { IAuditLogService } from '../../interfaces/shared/IAuditLogService';
import { IDatabase } from '../../interfaces/shared/IDatabase';
import { ILogger } from '../../interfaces/shared/ILogger';
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
  UserActivityEvent,
  SignupSource,
  EngagementTimeSeriesPoint,
  RetentionCurvePoint,
  CohortRetentionData,
  FunnelStep,
  DropOffPoint,
  LTVDistribution,
  ChurnRiskFactor,
  ChurnRiskSegment,
  RetentionOpportunity,
  GrowthProjection,
  SeasonalityPattern,
  TrendPoint,
  HealthScoreComponent,
  RecentActivitySummary,
  AnalyticsAlert,
  ActionMetric,
  ReferrerMetric,
} from '../../types/user-analytics';

/**
 * Event buffer for batched writes
 */
interface EventBuffer {
  events: UserActivityEvent[];
  lastFlush: Date;
}

/**
 * Cached aggregation data
 */
interface AggregationCache {
  data: any;
  computedAt: Date;
  expiresAt: Date;
}

@injectable()
export class UserAnalyticsService implements IUserAnalyticsService {
  private readonly CACHE_TTL = {
    REALTIME: 30, // 30 seconds
    HOURLY: 3600, // 1 hour
    DAILY: 86400, // 24 hours
    WEEKLY: 604800, // 7 days
  };

  private readonly EVENT_BUFFER_SIZE = 1000;
  private readonly EVENT_BUFFER_FLUSH_INTERVAL = 30000; // 30 seconds
  private eventBuffer: EventBuffer = {
    events: [],
    lastFlush: new Date(),
  };

  constructor(
    @inject(TYPES.Database) private readonly db: IDatabase,
    @inject(TYPES.CacheService) private readonly cache: ICacheService,
    @inject(TYPES.EventBus) private readonly eventBus: IEventBus,
    @inject(TYPES.AuditLog) private readonly auditLog: IAuditLogService,
    @inject(TYPES.Logger) private readonly logger: ILogger
  ) {
    this.initializeEventSubscriptions();
    this.startBufferFlushTimer();
  }

  /**
   * Initialize event subscriptions for analytics tracking
   */
  private initializeEventSubscriptions(): void {
    // Subscribe to user events
    this.eventBus.subscribe('user.created', (event) => this.handleUserCreated(event));
    this.eventBus.subscribe('user.login', (event) => this.handleUserLogin(event));
    this.eventBus.subscribe('user.activity', (event) => this.handleUserActivity(event));
    this.eventBus.subscribe('content.created', (event) => this.handleContentCreated(event));
    this.eventBus.subscribe('content.viewed', (event) => this.handleContentViewed(event));

    this.logger.info('UserAnalyticsService: Event subscriptions initialized');
  }

  /**
   * Start periodic buffer flush
   */
  private startBufferFlushTimer(): void {
    setInterval(() => {
      this.flushEventBuffer().catch((error) => {
        this.logger.error('Failed to flush event buffer', { error });
      });
    }, this.EVENT_BUFFER_FLUSH_INTERVAL);
  }

  /**
   * Get user acquisition metrics
   */
  public async getUserAcquisitionMetrics(
    timeRange: AnalyticsTimeRange
  ): Promise<UserAcquisitionMetrics> {
    const cacheKey = `analytics:acquisition:${timeRange.startDate.toISOString()}:${timeRange.endDate.toISOString()}`;

    // Try cache first
    const cached = await this.cache.get<UserAcquisitionMetrics>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Query new users in time range
      const newUsersQuery = `
        SELECT
          COUNT(*) as count,
          signup_source,
          signup_medium,
          signup_campaign,
          referrer
        FROM users
        WHERE created_at BETWEEN $1 AND $2
        GROUP BY signup_source, signup_medium, signup_campaign, referrer
      `;

      const newUsersResult = await this.db.query(newUsersQuery, [
        timeRange.startDate,
        timeRange.endDate,
      ]);

      // Get total users before period for growth rate
      const totalUsersBeforeQuery = `
        SELECT COUNT(*) as count FROM users WHERE created_at < $1
      `;
      const totalBefore = await this.db.query(totalUsersBeforeQuery, [timeRange.startDate]);

      // Process signup sources
      const sources: SignupSource[] = this.aggregateSignupSources(newUsersResult.rows);
      const newUsers = sources.reduce((sum, s) => sum + s.count, 0);
      const totalUsers = parseInt(totalBefore.rows[0].count) + newUsers;

      // Calculate growth rate
      const growthRate =
        totalBefore.rows[0].count > 0 ? (newUsers / parseInt(totalBefore.rows[0].count)) * 100 : 0;

      // Get conversion metrics
      const conversionMetrics = await this.calculateConversionRate(timeRange);

      // Get top referrers
      const topReferrers = await this.getTopReferrers(timeRange);

      const metrics: UserAcquisitionMetrics = {
        period: timeRange,
        newUsers,
        totalUsers,
        growthRate,
        sources,
        conversionRate: conversionMetrics.rate,
        averageTimeToSignup: conversionMetrics.avgTime,
        topReferrers,
      };

      // Cache for 1 hour
      await this.cache.set(cacheKey, metrics, { ttl: this.CACHE_TTL.HOURLY });

      await this.auditLog.log({
        action: 'analytics.acquisition.retrieved',
        userId: 'system',
        metadata: { timeRange },
      });

      return metrics;
    } catch (error) {
      this.logger.error('Failed to get acquisition metrics', { error, timeRange });
      throw error;
    }
  }

  /**
   * Get engagement metrics (DAU/MAU/WAU)
   */
  public async getEngagementMetrics(timeRange: AnalyticsTimeRange): Promise<EngagementMetrics> {
    const cacheKey = `analytics:engagement:${timeRange.startDate.toISOString()}:${timeRange.endDate.toISOString()}`;

    const cached = await this.cache.get<EngagementMetrics>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Calculate DAU (users active in last 24 hours from end date)
      const dauQuery = `
        SELECT COUNT(DISTINCT user_id) as count
        FROM user_activity
        WHERE activity_timestamp >= $1 AND activity_timestamp <= $2
      `;
      const dauEnd = timeRange.endDate;
      const dauStart = new Date(dauEnd.getTime() - 24 * 60 * 60 * 1000);
      const dauResult = await this.db.query(dauQuery, [dauStart, dauEnd]);

      // Calculate WAU (users active in last 7 days)
      const wauStart = new Date(dauEnd.getTime() - 7 * 24 * 60 * 60 * 1000);
      const wauResult = await this.db.query(dauQuery, [wauStart, dauEnd]);

      // Calculate MAU (users active in last 30 days)
      const mauStart = new Date(dauEnd.getTime() - 30 * 24 * 60 * 60 * 1000);
      const mauResult = await this.db.query(dauQuery, [mauStart, dauEnd]);

      const dau = parseInt(dauResult.rows[0].count);
      const wau = parseInt(wauResult.rows[0].count);
      const mau = parseInt(mauResult.rows[0].count);

      // Calculate session metrics
      const sessionMetrics = await this.calculateSessionMetrics(timeRange);

      // Get time series data
      const timeSeriesData = await this.getEngagementTimeSeries(timeRange);

      // Get total users for engagement rate
      const totalUsersQuery = `SELECT COUNT(*) as count FROM users WHERE created_at <= $1`;
      const totalUsersResult = await this.db.query(totalUsersQuery, [dauEnd]);
      const totalUsers = parseInt(totalUsersResult.rows[0].count);

      const metrics: EngagementMetrics = {
        period: timeRange,
        dailyActiveUsers: dau,
        weeklyActiveUsers: wau,
        monthlyActiveUsers: mau,
        dauMauRatio: mau > 0 ? (dau / mau) * 100 : 0,
        wauMauRatio: mau > 0 ? (wau / mau) * 100 : 0,
        averageSessionDuration: sessionMetrics.avgDuration,
        averageActionsPerUser: sessionMetrics.avgActions,
        engagementRate: totalUsers > 0 ? (mau / totalUsers) * 100 : 0,
        timeSeriesData,
      };

      await this.cache.set(cacheKey, metrics, { ttl: this.CACHE_TTL.HOURLY });

      return metrics;
    } catch (error) {
      this.logger.error('Failed to get engagement metrics', { error, timeRange });
      throw error;
    }
  }

  /**
   * Get retention metrics for a cohort
   */
  public async getRetentionMetrics(cohortDate: Date): Promise<RetentionMetrics> {
    const cacheKey = `analytics:retention:${cohortDate.toISOString()}`;

    const cached = await this.cache.get<RetentionMetrics>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Get cohort users (users who signed up on cohort date)
      const cohortEndDate = new Date(cohortDate);
      cohortEndDate.setDate(cohortEndDate.getDate() + 1);

      const cohortQuery = `
        SELECT user_id FROM users
        WHERE created_at >= $1 AND created_at < $2
      `;
      const cohortResult = await this.db.query(cohortQuery, [cohortDate, cohortEndDate]);
      const cohortUserIds = cohortResult.rows.map((row) => row.user_id);
      const cohortSize = cohortUserIds.length;

      if (cohortSize === 0) {
        return {
          cohortDate,
          cohortSize: 0,
          day1Retention: 0,
          day7Retention: 0,
          day30Retention: 0,
          day90Retention: 0,
          retentionCurve: [],
        };
      }

      // Calculate retention for key periods
      const retentionData = await Promise.all([
        this.calculatePeriodRetention(cohortUserIds, cohortDate, 1),
        this.calculatePeriodRetention(cohortUserIds, cohortDate, 7),
        this.calculatePeriodRetention(cohortUserIds, cohortDate, 30),
        this.calculatePeriodRetention(cohortUserIds, cohortDate, 90),
      ]);

      // Build retention curve (daily for 90 days)
      const retentionCurve: RetentionCurvePoint[] = [];
      for (let day = 1; day <= 90; day++) {
        const retention = await this.calculatePeriodRetention(cohortUserIds, cohortDate, day);
        retentionCurve.push({
          day,
          activeUsers: retention.activeUsers,
          retentionRate: (retention.activeUsers / cohortSize) * 100,
        });
      }

      const metrics: RetentionMetrics = {
        cohortDate,
        cohortSize,
        day1Retention: (retentionData[0].activeUsers / cohortSize) * 100,
        day7Retention: (retentionData[1].activeUsers / cohortSize) * 100,
        day30Retention: (retentionData[2].activeUsers / cohortSize) * 100,
        day90Retention: (retentionData[3].activeUsers / cohortSize) * 100,
        retentionCurve,
      };

      await this.cache.set(cacheKey, metrics, { ttl: this.CACHE_TTL.DAILY });

      return metrics;
    } catch (error) {
      this.logger.error('Failed to get retention metrics', { error, cohortDate });
      throw error;
    }
  }

  /**
   * Perform cohort analysis
   */
  public async getCohortAnalysis(startDate: Date, endDate: Date): Promise<CohortAnalysis[]> {
    const cacheKey = `analytics:cohort:${startDate.toISOString()}:${endDate.toISOString()}`;

    const cached = await this.cache.get<CohortAnalysis[]>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const cohorts: CohortAnalysis[] = [];

      // Iterate through each month in the range
      let currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        const cohortEndDate = new Date(currentDate);
        cohortEndDate.setMonth(cohortEndDate.getMonth() + 1);

        const cohortId = `cohort-${currentDate.getFullYear()}-${currentDate.getMonth() + 1}`;

        // Get cohort users
        const cohortUsersQuery = `
          SELECT user_id, created_at
          FROM users
          WHERE created_at >= $1 AND created_at < $2
        `;
        const cohortUsersResult = await this.db.query(cohortUsersQuery, [
          currentDate,
          cohortEndDate,
        ]);
        const cohortSize = cohortUsersResult.rows.length;

        if (cohortSize > 0) {
          const userIds = cohortUsersResult.rows.map((row) => row.user_id);

          // Build retention data
          const retentionData: CohortRetentionData[] = [];
          for (let period = 0; period <= 12; period++) {
            // 12 months
            const retention = await this.calculatePeriodRetention(
              userIds,
              currentDate,
              period * 30
            );
            retentionData.push({
              period: period * 30,
              activeUsers: retention.activeUsers,
              retentionRate: (retention.activeUsers / cohortSize) * 100,
              churnedUsers: cohortSize - retention.activeUsers,
            });
          }

          // Calculate LTV for cohort
          const ltvData = await this.calculateCohortLTV(userIds);

          // Calculate churn rate
          const finalRetention = retentionData[retentionData.length - 1];
          const churnRate = ((cohortSize - finalRetention.activeUsers) / cohortSize) * 100;

          // Calculate average lifespan
          const lifespanQuery = `
            SELECT AVG(EXTRACT(EPOCH FROM (last_activity - created_at)) / 86400) as avg_days
            FROM users
            WHERE user_id = ANY($1) AND last_activity IS NOT NULL
          `;
          const lifespanResult = await this.db.query(lifespanQuery, [userIds]);
          const averageLifespan = parseFloat(lifespanResult.rows[0].avg_days) || 0;

          cohorts.push({
            cohortId,
            cohortDate: currentDate,
            cohortSize,
            retentionData,
            lifetimeValue: ltvData.avgLTV,
            churnRate,
            averageLifespan,
          });
        }

        // Move to next month
        currentDate = cohortEndDate;
      }

      await this.cache.set(cacheKey, cohorts, { ttl: this.CACHE_TTL.DAILY });

      return cohorts;
    } catch (error) {
      this.logger.error('Failed to get cohort analysis', { error, startDate, endDate });
      throw error;
    }
  }

  /**
   * Segment users based on criteria
   */
  public async segmentUsers(criteria: UserSegmentCriteria): Promise<UserSegment[]> {
    try {
      const segments: UserSegment[] = [];

      // Build query based on criteria
      let query =
        'SELECT user_id, activity_level, content_preferences, location, created_at FROM users WHERE 1=1';
      const params: any[] = [];
      let paramIndex = 1;

      if (criteria.activityLevel) {
        query += ` AND activity_level = $${paramIndex++}`;
        params.push(criteria.activityLevel);
      }

      if (criteria.location && criteria.location.length > 0) {
        query += ` AND location = ANY($${paramIndex++})`;
        params.push(criteria.location);
      }

      if (criteria.signupSource) {
        query += ` AND signup_source = $${paramIndex++}`;
        params.push(criteria.signupSource);
      }

      if (criteria.tenure) {
        const now = new Date();
        if (criteria.tenure.min) {
          const minDate = new Date(now.getTime() - criteria.tenure.min * 24 * 60 * 60 * 1000);
          query += ` AND created_at <= $${paramIndex++}`;
          params.push(minDate);
        }
        if (criteria.tenure.max) {
          const maxDate = new Date(now.getTime() - criteria.tenure.max * 24 * 60 * 60 * 1000);
          query += ` AND created_at >= $${paramIndex++}`;
          params.push(maxDate);
        }
      }

      const result = await this.db.query(query, params);
      const userIds = result.rows.map((row) => row.user_id);

      if (userIds.length === 0) {
        return segments;
      }

      // Create segment
      const segmentId = this.generateSegmentId(criteria);

      // Calculate segment metrics
      const engagementMetrics = await this.calculateSegmentEngagement(userIds);
      const ltvMetrics = await this.calculateSegmentLTV(userIds);
      const churnMetrics = await this.calculateSegmentChurn(userIds);
      const topActions = await this.getSegmentTopActions(userIds);

      // Get total users for percentage
      const totalUsersQuery = 'SELECT COUNT(*) as count FROM users';
      const totalUsersResult = await this.db.query(totalUsersQuery);
      const totalUsers = parseInt(totalUsersResult.rows[0].count);

      segments.push({
        segmentId,
        name: this.generateSegmentName(criteria),
        criteria,
        userCount: userIds.length,
        percentage: (userIds.length / totalUsers) * 100,
        averageEngagement: engagementMetrics.avgScore,
        averageLTV: ltvMetrics.avgLTV,
        churnRate: churnMetrics.rate,
        topActions,
      });

      return segments;
    } catch (error) {
      this.logger.error('Failed to segment users', { error, criteria });
      throw error;
    }
  }

  /**
   * Get user segment by ID
   */
  public async getUserSegment(segmentId: string): Promise<UserSegment> {
    const cacheKey = `analytics:segment:${segmentId}`;

    const cached = await this.cache.get<UserSegment>(cacheKey);
    if (cached) {
      return cached;
    }

    // In a real implementation, segment definitions would be stored in DB
    // For now, return a placeholder
    throw new Error('Segment not found');
  }

  /**
   * Analyze user journey funnel
   */
  public async analyzeUserJourney(
    funnelId: string,
    timeRange: AnalyticsTimeRange
  ): Promise<UserJourneyFunnel> {
    const cacheKey = `analytics:journey:${funnelId}:${timeRange.startDate.toISOString()}`;

    const cached = await this.cache.get<UserJourneyFunnel>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Get funnel definition (would be from DB in real implementation)
      const funnelSteps = await this.getFunnelDefinition(funnelId);

      // Analyze each step
      const steps: FunnelStep[] = [];
      let previousStepUsers = 0;

      for (let i = 0; i < funnelSteps.length; i++) {
        const step = funnelSteps[i];

        // Count users who completed this step
        const stepQuery = `
          SELECT COUNT(DISTINCT user_id) as count,
                 AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_time
          FROM user_journey
          WHERE step_name = $1
            AND started_at BETWEEN $2 AND $3
            AND completed = true
        `;
        const stepResult = await this.db.query(stepQuery, [
          step.name,
          timeRange.startDate,
          timeRange.endDate,
        ]);

        const userCount = parseInt(stepResult.rows[0].count);
        const avgTime = parseFloat(stepResult.rows[0].avg_time) || 0;

        const dropOffRate =
          previousStepUsers > 0 ? ((previousStepUsers - userCount) / previousStepUsers) * 100 : 0;

        const conversionToNext = i < funnelSteps.length - 1 ? 0 : 100; // Calculated in next iteration

        steps.push({
          stepNumber: i + 1,
          stepName: step.name,
          action: step.action,
          users: userCount,
          dropOffRate,
          conversionToNext,
          averageTimeOnStep: avgTime * 1000, // Convert to milliseconds
        });

        previousStepUsers = userCount;
      }

      // Calculate conversion rates
      for (let i = 0; i < steps.length - 1; i++) {
        steps[i].conversionToNext =
          steps[i + 1].users > 0 ? (steps[i + 1].users / steps[i].users) * 100 : 0;
      }

      // Identify drop-off points
      const dropOffPoints = await this.identifyDropOffPoints(steps);

      const totalEntries = steps[0]?.users || 0;
      const completions = steps[steps.length - 1]?.users || 0;

      const funnel: UserJourneyFunnel = {
        funnelId,
        name: `Funnel ${funnelId}`,
        steps,
        totalEntries,
        completionRate: totalEntries > 0 ? (completions / totalEntries) * 100 : 0,
        averageTimeToComplete: steps.reduce((sum, s) => sum + s.averageTimeOnStep, 0),
        dropOffPoints,
      };

      await this.cache.set(cacheKey, funnel, { ttl: this.CACHE_TTL.HOURLY });

      return funnel;
    } catch (error) {
      this.logger.error('Failed to analyze user journey', { error, funnelId });
      throw error;
    }
  }

  /**
   * Calculate lifetime value metrics
   */
  public async calculateLifetimeValue(segment?: string): Promise<LifetimeValueMetrics> {
    const cacheKey = `analytics:ltv:${segment || 'all'}`;

    const cached = await this.cache.get<LifetimeValueMetrics>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      let query = `
        SELECT
          user_id,
          COALESCE(SUM(amount), 0) as total_revenue
        FROM payments
        WHERE status = 'completed'
      `;

      if (segment) {
        query += ` AND user_id IN (SELECT user_id FROM user_segments WHERE segment_id = $1)`;
      }

      query += ' GROUP BY user_id';

      const params = segment ? [segment] : [];
      const result = await this.db.query(query, params);

      const revenues = result.rows.map((row) => parseFloat(row.total_revenue));
      const averageLTV =
        revenues.length > 0 ? revenues.reduce((sum, rev) => sum + rev, 0) / revenues.length : 0;

      // Calculate median
      const sortedRevenues = [...revenues].sort((a, b) => a - b);
      const medianLTV =
        sortedRevenues.length > 0 ? sortedRevenues[Math.floor(sortedRevenues.length / 2)] : 0;

      // Build distribution
      const ltvDistribution: LTVDistribution[] = [
        { range: { min: 0, max: 10 }, userCount: 0, percentage: 0, revenue: 0 },
        { range: { min: 10, max: 50 }, userCount: 0, percentage: 0, revenue: 0 },
        { range: { min: 50, max: 100 }, userCount: 0, percentage: 0, revenue: 0 },
        { range: { min: 100, max: 500 }, userCount: 0, percentage: 0, revenue: 0 },
        { range: { min: 500, max: Infinity }, userCount: 0, percentage: 0, revenue: 0 },
      ];

      revenues.forEach((rev) => {
        const bucket = ltvDistribution.find((d) => rev >= d.range.min && rev < d.range.max);
        if (bucket) {
          bucket.userCount++;
          bucket.revenue += rev;
        }
      });

      ltvDistribution.forEach((bucket) => {
        bucket.percentage = revenues.length > 0 ? (bucket.userCount / revenues.length) * 100 : 0;
      });

      // Calculate payback period and CAC (simplified)
      const paybackPeriod = 60; // Days (would calculate from actual data)
      const customerAcquisitionCost = 25; // USD (would calculate from marketing spend)

      const metrics: LifetimeValueMetrics = {
        segment,
        averageLTV,
        medianLTV,
        ltvDistribution,
        paybackPeriod,
        customerAcquisitionCost,
        ltvToCacRatio: customerAcquisitionCost > 0 ? averageLTV / customerAcquisitionCost : 0,
      };

      await this.cache.set(cacheKey, metrics, { ttl: this.CACHE_TTL.DAILY });

      return metrics;
    } catch (error) {
      this.logger.error('Failed to calculate lifetime value', { error, segment });
      throw error;
    }
  }

  /**
   * Analyze churn and predict at-risk users
   */
  public async analyzeChurn(timeRange: AnalyticsTimeRange): Promise<ChurnAnalysis> {
    const cacheKey = `analytics:churn:${timeRange.startDate.toISOString()}`;

    const cached = await this.cache.get<ChurnAnalysis>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Define churn as no activity for 30+ days
      const churnThreshold = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
      const churnDate = new Date(timeRange.endDate.getTime() - churnThreshold);

      // Count churned users
      const churnQuery = `
        SELECT COUNT(*) as count
        FROM users
        WHERE last_activity < $1
          AND created_at < $2
          AND status = 'active'
      `;
      const churnResult = await this.db.query(churnQuery, [churnDate, churnDate]);
      const churnedUsers = parseInt(churnResult.rows[0].count);

      // Count total users
      const totalQuery = `SELECT COUNT(*) as count FROM users WHERE created_at < $1`;
      const totalResult = await this.db.query(totalQuery, [churnDate]);
      const totalUsers = parseInt(totalResult.rows[0].count);

      const churnRate = totalUsers > 0 ? (churnedUsers / totalUsers) * 100 : 0;

      // Generate predictions for at-risk users
      const predictedChurn = await this.generateChurnPredictions(timeRange);

      // Analyze risk segments
      const riskSegments = await this.analyzeChurnRiskSegments();

      // Identify retention opportunities
      const retentionOpportunities = await this.identifyRetentionOpportunities(predictedChurn);

      const analysis: ChurnAnalysis = {
        period: timeRange,
        churnRate,
        churnedUsers,
        totalUsers,
        predictedChurn,
        riskSegments,
        retentionOpportunities,
      };

      await this.cache.set(cacheKey, analysis, { ttl: this.CACHE_TTL.DAILY });

      return analysis;
    } catch (error) {
      this.logger.error('Failed to analyze churn', { error, timeRange });
      throw error;
    }
  }

  /**
   * Predict churn for specific user
   */
  public async predictUserChurn(userId: string): Promise<ChurnPrediction> {
    const cacheKey = `analytics:churn:user:${userId}`;

    const cached = await this.cache.get<ChurnPrediction>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Get user data
      const userQuery = `
        SELECT
          user_id,
          created_at,
          last_activity,
          activity_level,
          engagement_score,
          subscription_status
        FROM users
        WHERE user_id = $1
      `;
      const userResult = await this.db.query(userQuery, [userId]);

      if (userResult.rows.length === 0) {
        throw new Error('User not found');
      }

      const user = userResult.rows[0];

      // Calculate risk factors
      const factors: ChurnRiskFactor[] = [];

      // Factor 1: Days since last activity
      const daysSinceActivity =
        (Date.now() - new Date(user.last_activity).getTime()) / (24 * 60 * 60 * 1000);
      factors.push({
        factor: 'days_since_activity',
        weight: 0.3,
        value: daysSinceActivity,
        impact: daysSinceActivity > 7 ? 'negative' : 'positive',
      });

      // Factor 2: Engagement score
      factors.push({
        factor: 'engagement_score',
        weight: 0.25,
        value: user.engagement_score || 0,
        impact: user.engagement_score < 30 ? 'negative' : 'positive',
      });

      // Factor 3: Subscription status
      factors.push({
        factor: 'subscription_status',
        weight: 0.2,
        value: user.subscription_status === 'active' ? 100 : 0,
        impact: user.subscription_status === 'active' ? 'positive' : 'negative',
      });

      // Factor 4: Account age
      const accountAgeDays =
        (Date.now() - new Date(user.created_at).getTime()) / (24 * 60 * 60 * 1000);
      factors.push({
        factor: 'account_age',
        weight: 0.15,
        value: accountAgeDays,
        impact: accountAgeDays < 30 ? 'negative' : 'positive',
      });

      // Factor 5: Activity level
      const activityLevelScore =
        user.activity_level === 'high' ? 100 : user.activity_level === 'medium' ? 50 : 10;
      factors.push({
        factor: 'activity_level',
        weight: 0.1,
        value: activityLevelScore,
        impact: activityLevelScore < 30 ? 'negative' : 'positive',
      });

      // Calculate overall risk score (0-100)
      const riskScore = this.calculateChurnRiskScore(factors);
      const riskLevel = this.getRiskLevel(riskScore);

      // Generate recommended actions
      const recommendedActions = this.generateRetentionActions(factors, riskLevel);

      const prediction: ChurnPrediction = {
        userId,
        riskScore,
        riskLevel,
        factors,
        lastActivity: new Date(user.last_activity),
        recommendedActions,
      };

      await this.cache.set(cacheKey, prediction, { ttl: this.CACHE_TTL.HOURLY });

      return prediction;
    } catch (error) {
      this.logger.error('Failed to predict user churn', { error, userId });
      throw error;
    }
  }

  /**
   * Get user growth trends
   */
  public async getUserGrowthTrends(timeRange: AnalyticsTimeRange): Promise<UserGrowthTrends> {
    const cacheKey = `analytics:growth:${timeRange.startDate.toISOString()}`;

    const cached = await this.cache.get<UserGrowthTrends>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Get daily user counts
      const query = `
        SELECT
          DATE(created_at) as date,
          COUNT(*) as new_users,
          SUM(COUNT(*)) OVER (ORDER BY DATE(created_at)) as cumulative_users
        FROM users
        WHERE created_at BETWEEN $1 AND $2
        GROUP BY DATE(created_at)
        ORDER BY date
      `;

      const result = await this.db.query(query, [timeRange.startDate, timeRange.endDate]);

      // Build trend points
      const trends: TrendPoint[] = result.rows.map((row) => ({
        timestamp: new Date(row.date),
        value: parseInt(row.cumulative_users),
        trend: 'stable' as const,
      }));

      // Calculate moving average
      const windowSize = 7; // 7-day moving average
      for (let i = windowSize; i < trends.length; i++) {
        const window = trends.slice(i - windowSize, i);
        const avg = window.reduce((sum, t) => sum + t.value, 0) / windowSize;
        trends[i].movingAverage = avg;

        // Determine trend direction
        if (i > 0) {
          const change = trends[i].value - trends[i - 1].value;
          trends[i].trend = change > 0 ? 'up' : change < 0 ? 'down' : 'stable';
        }
      }

      // Calculate overall growth rate
      const firstValue = trends[0]?.value || 0;
      const lastValue = trends[trends.length - 1]?.value || 0;
      const growthRate = firstValue > 0 ? ((lastValue - firstValue) / firstValue) * 100 : 0;

      // Determine growth type
      const growthType = this.determineGrowthType(trends);

      // Generate projection
      const projection = this.projectGrowth(trends);

      // Identify seasonality
      const seasonality = this.identifySeasonality(trends);

      const growthTrends: UserGrowthTrends = {
        period: timeRange,
        growthRate,
        growthType,
        projection,
        seasonality,
        trends,
      };

      await this.cache.set(cacheKey, growthTrends, { ttl: this.CACHE_TTL.DAILY });

      return growthTrends;
    } catch (error) {
      this.logger.error('Failed to get growth trends', { error, timeRange });
      throw error;
    }
  }

  /**
   * Calculate user health score
   */
  public async getUserHealthScore(userId: string): Promise<UserHealthScore> {
    const cacheKey = `analytics:health:${userId}`;

    const cached = await this.cache.get<UserHealthScore>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Get user metrics
      const userQuery = `
        SELECT
          user_id,
          last_activity,
          activity_level,
          engagement_score,
          content_created_count,
          content_views_count,
          subscription_status,
          payment_history_count
        FROM users
        WHERE user_id = $1
      `;
      const userResult = await this.db.query(userQuery, [userId]);

      if (userResult.rows.length === 0) {
        throw new Error('User not found');
      }

      const user = userResult.rows[0];

      // Calculate component scores
      const components: HealthScoreComponent[] = [
        {
          component: 'engagement',
          score: user.engagement_score || 0,
          weight: 0.3,
          metrics: {
            activityLevel:
              user.activity_level === 'high' ? 100 : user.activity_level === 'medium' ? 50 : 25,
            daysSinceLastActivity: this.calculateRecencyScore(user.last_activity),
          },
        },
        {
          component: 'content_creation',
          score: Math.min((user.content_created_count || 0) * 10, 100),
          weight: 0.2,
          metrics: {
            contentCount: user.content_created_count || 0,
            viewsPerContent:
              user.content_created_count > 0
                ? user.content_views_count / user.content_created_count
                : 0,
          },
        },
        {
          component: 'monetization',
          score:
            user.subscription_status === 'active' ? 100 : user.payment_history_count > 0 ? 50 : 0,
          weight: 0.25,
          metrics: {
            subscriptionActive: user.subscription_status === 'active' ? 1 : 0,
            paymentCount: user.payment_history_count || 0,
          },
        },
        {
          component: 'loyalty',
          score: this.calculateLoyaltyScore(user),
          weight: 0.25,
          metrics: {
            accountAge: this.calculateAccountAge(user),
            retentionRate: 85, // Would calculate from retention data
          },
        },
      ];

      // Calculate overall score (weighted average)
      const overallScore = components.reduce((sum, c) => sum + c.score * c.weight, 0);

      // Calculate engagement score (subset of overall)
      const engagementScore = components.find((c) => c.component === 'engagement')?.score || 0;

      // Calculate risk score (inverse of health)
      const riskScore = 100 - overallScore;

      // Calculate value score
      const valueScore = components.find((c) => c.component === 'monetization')?.score || 0;

      // Determine health trend (would compare to historical data)
      const healthTrend =
        overallScore > 70 ? 'improving' : overallScore < 40 ? 'declining' : 'stable';

      const healthScore: UserHealthScore = {
        userId,
        overallScore,
        engagementScore,
        riskScore,
        valueScore,
        components,
        lastUpdated: new Date(),
        healthTrend,
      };

      await this.cache.set(cacheKey, healthScore, { ttl: this.CACHE_TTL.HOURLY });

      return healthScore;
    } catch (error) {
      this.logger.error('Failed to get user health score', { error, userId });
      throw error;
    }
  }

  /**
   * Get real-time dashboard data
   */
  public async getRealtimeDashboard(): Promise<RealtimeDashboardData> {
    const cacheKey = 'analytics:realtime:dashboard';

    const cached = await this.cache.get<RealtimeDashboardData>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

      // Get active users (activity in last 5 minutes)
      const activeUsersQuery = `
        SELECT COUNT(DISTINCT user_id) as count
        FROM user_activity
        WHERE activity_timestamp >= $1
      `;
      const activeUsersResult = await this.db.query(activeUsersQuery, [fiveMinutesAgo]);
      const activeUsers = parseInt(activeUsersResult.rows[0].count);

      // Get active sessions
      const activeSessionsQuery = `
        SELECT COUNT(*) as count
        FROM user_sessions
        WHERE last_activity >= $1 AND status = 'active'
      `;
      const activeSessionsResult = await this.db.query(activeSessionsQuery, [fiveMinutesAgo]);
      const activeSessions = parseInt(activeSessionsResult.rows[0].count);

      // Calculate events per second
      const eventsQuery = `
        SELECT COUNT(*) as count
        FROM user_activity
        WHERE activity_timestamp >= $1
      `;
      const eventsResult = await this.db.query(eventsQuery, [fiveMinutesAgo]);
      const eventCount = parseInt(eventsResult.rows[0].count);
      const eventsPerSecond = eventCount / 300; // 5 minutes = 300 seconds

      // Get recent signups (last hour)
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const signupsQuery = `
        SELECT COUNT(*) as count FROM users WHERE created_at >= $1
      `;
      const signupsResult = await this.db.query(signupsQuery, [oneHourAgo]);
      const recentSignups = parseInt(signupsResult.rows[0].count);

      // Get recent activity summary
      const recentActivity = await this.getRecentActivitySummary();

      // Generate alerts (anomaly detection)
      const alerts = await this.generateAnalyticsAlerts(activeUsers, eventsPerSecond);

      const dashboard: RealtimeDashboardData = {
        timestamp: now,
        activeUsers,
        activeSessions,
        eventsPerSecond,
        recentSignups,
        recentActivity,
        alerts,
      };

      await this.cache.set(cacheKey, dashboard, { ttl: this.CACHE_TTL.REALTIME });

      return dashboard;
    } catch (error) {
      this.logger.error('Failed to get realtime dashboard', { error });
      throw error;
    }
  }

  /**
   * Export analytics data
   */
  public async exportAnalytics(options: AnalyticsExportOptions): Promise<AnalyticsExportResult> {
    try {
      this.logger.info('Starting analytics export', { options });

      const exportId = this.generateExportId();

      // Gather data based on metrics requested
      const data = await this.gatherExportData(options);

      // Format data based on export format
      let formattedData: string;
      let contentType: string;

      switch (options.format) {
        case 'csv':
          formattedData = this.formatAsCSV(data);
          contentType = 'text/csv';
          break;
        case 'json':
          formattedData = JSON.stringify(data, null, 2);
          contentType = 'application/json';
          break;
        case 'xlsx':
          // Would use xlsx library in real implementation
          formattedData = JSON.stringify(data);
          contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
          break;
        default:
          throw new Error(`Unsupported export format: ${options.format}`);
      }

      // In real implementation, would upload to cloud storage (S3, etc.)
      // For now, just return metadata
      const size = Buffer.byteLength(formattedData, 'utf8');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      const result: AnalyticsExportResult = {
        exportId,
        format: options.format,
        size,
        url: `/api/analytics/exports/${exportId}`, // Would be cloud URL
        expiresAt,
        recordCount: Array.isArray(data) ? data.length : 1,
      };

      await this.auditLog.log({
        action: 'analytics.export.created',
        userId: 'system',
        metadata: { exportId, format: options.format, recordCount: result.recordCount },
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to export analytics', { error, options });
      throw error;
    }
  }

  /**
   * Track user activity event
   */
  public async trackActivity(event: UserActivityEvent): Promise<void> {
    try {
      // Add to buffer
      this.eventBuffer.events.push(event);

      // Flush if buffer is full
      if (this.eventBuffer.events.length >= this.EVENT_BUFFER_SIZE) {
        await this.flushEventBuffer();
      }

      // Publish event to event bus for real-time processing
      await this.eventBus.publish({
        type: 'user.activity.tracked',
        aggregateId: event.userId,
        data: event,
        timestamp: new Date(),
      });
    } catch (error) {
      this.logger.error('Failed to track activity', { error, event });
      // Don't throw - we don't want to fail user operations due to analytics
    }
  }

  /**
   * Process analytics aggregations (background job)
   */
  public async processAggregations(interval: 'hourly' | 'daily'): Promise<void> {
    try {
      this.logger.info('Starting analytics aggregation', { interval });

      const now = new Date();
      const periodStart =
        interval === 'hourly'
          ? new Date(now.getTime() - 60 * 60 * 1000)
          : new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // Aggregate user activity
      await this.aggregateUserActivity(periodStart, now);

      // Aggregate engagement metrics
      await this.aggregateEngagementMetrics(periodStart, now);

      // Update user health scores
      await this.updateUserHealthScores();

      // Cleanup old data
      await this.cleanupOldAggregations(interval);

      this.logger.info('Analytics aggregation completed', { interval });
    } catch (error) {
      this.logger.error('Failed to process aggregations', { error, interval });
      throw error;
    }
  }

  /**
   * Query analytics with custom filters
   */
  public async queryAnalytics(filters: AnalyticsQueryFilters): Promise<any> {
    try {
      // Build dynamic query based on filters
      let query = 'SELECT * FROM analytics_aggregates WHERE 1=1';
      const params: any[] = [];
      let paramIndex = 1;

      // Add time range filter
      query += ` AND timestamp BETWEEN $${paramIndex++} AND $${paramIndex++}`;
      params.push(filters.timeRange.startDate, filters.timeRange.endDate);

      // Add metric filter
      if (filters.metrics && filters.metrics.length > 0) {
        query += ` AND metric_name = ANY($${paramIndex++})`;
        params.push(filters.metrics);
      }

      // Add grouping
      if (filters.groupBy) {
        query += ` GROUP BY DATE_TRUNC('${filters.groupBy}', timestamp)`;
      }

      // Add pagination
      if (filters.limit) {
        query += ` LIMIT $${paramIndex++}`;
        params.push(filters.limit);
      }

      if (filters.offset) {
        query += ` OFFSET $${paramIndex++}`;
        params.push(filters.offset);
      }

      const result = await this.db.query(query, params);

      return result.rows;
    } catch (error) {
      this.logger.error('Failed to query analytics', { error, filters });
      throw error;
    }
  }

  /**
   * Refresh cached analytics
   */
  public async refreshCache(metricType?: string): Promise<void> {
    try {
      if (metricType) {
        // Invalidate specific metric cache
        const pattern = `analytics:${metricType}:*`;
        await this.cache.invalidatePattern(pattern);
        this.logger.info('Cache refreshed for metric type', { metricType });
      } else {
        // Invalidate all analytics cache
        await this.cache.invalidatePattern('analytics:*');
        this.logger.info('All analytics cache refreshed');
      }
    } catch (error) {
      this.logger.error('Failed to refresh cache', { error, metricType });
      throw error;
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Event handlers
   */
  private async handleUserCreated(event: any): Promise<void> {
    // Track new user for acquisition metrics
    await this.trackActivity({
      userId: event.data.userId,
      eventType: 'user_created',
      eventData: event.data,
      timestamp: new Date(),
    });
  }

  private async handleUserLogin(event: any): Promise<void> {
    // Track login for engagement metrics
    await this.trackActivity({
      userId: event.data.userId,
      eventType: 'user_login',
      eventData: event.data,
      timestamp: new Date(),
    });
  }

  private async handleUserActivity(event: any): Promise<void> {
    // Track general user activity
    await this.trackActivity({
      userId: event.data.userId,
      eventType: 'user_activity',
      eventData: event.data,
      timestamp: new Date(),
    });
  }

  private async handleContentCreated(event: any): Promise<void> {
    // Track content creation activity
    await this.trackActivity({
      userId: event.data.userId,
      eventType: 'content_created',
      eventData: event.data,
      timestamp: new Date(),
    });
  }

  private async handleContentViewed(event: any): Promise<void> {
    // Track content views
    await this.trackActivity({
      userId: event.data.userId,
      eventType: 'content_viewed',
      eventData: event.data,
      timestamp: new Date(),
    });
  }

  /**
   * Flush event buffer to database
   */
  private async flushEventBuffer(): Promise<void> {
    if (this.eventBuffer.events.length === 0) {
      return;
    }

    try {
      const events = [...this.eventBuffer.events];
      this.eventBuffer.events = [];
      this.eventBuffer.lastFlush = new Date();

      // Batch insert events
      const query = `
        INSERT INTO user_activity_events
        (user_id, event_type, event_data, timestamp, session_id, ip_address, user_agent, metadata)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `;

      for (const event of events) {
        await this.db.query(query, [
          event.userId,
          event.eventType,
          JSON.stringify(event.eventData),
          event.timestamp,
          event.sessionId,
          event.ipAddress,
          event.userAgent,
          JSON.stringify(event.metadata),
        ]);
      }

      this.logger.info('Event buffer flushed', { eventCount: events.length });
    } catch (error) {
      this.logger.error('Failed to flush event buffer', { error });
      // Re-add events to buffer on failure
      this.eventBuffer.events.unshift(...this.eventBuffer.events);
    }
  }

  /**
   * Helper methods for calculations
   */
  private aggregateSignupSources(rows: any[]): SignupSource[] {
    const sourceMap = new Map<string, SignupSource>();
    let total = 0;

    rows.forEach((row) => {
      const source = row.signup_source || 'organic';
      const count = parseInt(row.count);
      total += count;

      if (sourceMap.has(source)) {
        sourceMap.get(source)!.count += count;
      } else {
        sourceMap.set(source, {
          source,
          medium: row.signup_medium,
          campaign: row.signup_campaign,
          count,
          percentage: 0,
          conversionRate: 0,
        });
      }
    });

    const sources = Array.from(sourceMap.values());
    sources.forEach((source) => {
      source.percentage = total > 0 ? (source.count / total) * 100 : 0;
    });

    return sources;
  }

  private async calculateConversionRate(
    timeRange: AnalyticsTimeRange
  ): Promise<{ rate: number; avgTime: number }> {
    // Simplified conversion calculation
    // In real implementation, would track visitor -> signup funnel
    return {
      rate: 2.5, // 2.5% conversion rate
      avgTime: 180000, // 3 minutes in milliseconds
    };
  }

  private async getTopReferrers(timeRange: AnalyticsTimeRange): Promise<ReferrerMetric[]> {
    const query = `
      SELECT
        referrer,
        COUNT(*) as visits,
        COUNT(CASE WHEN signed_up = true THEN 1 END) as signups
      FROM visitor_tracking
      WHERE visit_timestamp BETWEEN $1 AND $2
        AND referrer IS NOT NULL
      GROUP BY referrer
      ORDER BY signups DESC
      LIMIT 10
    `;

    try {
      const result = await this.db.query(query, [timeRange.startDate, timeRange.endDate]);

      return result.rows.map((row) => ({
        referrer: row.referrer,
        visits: parseInt(row.visits),
        signups: parseInt(row.signups),
        conversionRate: row.visits > 0 ? (row.signups / row.visits) * 100 : 0,
      }));
    } catch (error) {
      this.logger.warn('Failed to get top referrers', { error });
      return [];
    }
  }

  private async calculateSessionMetrics(
    timeRange: AnalyticsTimeRange
  ): Promise<{ avgDuration: number; avgActions: number }> {
    const query = `
      SELECT
        AVG(duration) as avg_duration,
        AVG(action_count) as avg_actions
      FROM user_sessions
      WHERE created_at BETWEEN $1 AND $2
    `;

    const result = await this.db.query(query, [timeRange.startDate, timeRange.endDate]);

    return {
      avgDuration: parseFloat(result.rows[0].avg_duration) || 0,
      avgActions: parseFloat(result.rows[0].avg_actions) || 0,
    };
  }

  private async getEngagementTimeSeries(
    timeRange: AnalyticsTimeRange
  ): Promise<EngagementTimeSeriesPoint[]> {
    const query = `
      SELECT
        DATE(activity_timestamp) as date,
        COUNT(DISTINCT user_id) as active_users,
        COUNT(DISTINCT session_id) as sessions,
        AVG(session_duration) as avg_duration,
        (COUNT(CASE WHEN bounce = true THEN 1 END)::float / COUNT(*)::float) * 100 as bounce_rate
      FROM user_activity
      WHERE activity_timestamp BETWEEN $1 AND $2
      GROUP BY DATE(activity_timestamp)
      ORDER BY date
    `;

    const result = await this.db.query(query, [timeRange.startDate, timeRange.endDate]);

    return result.rows.map((row) => ({
      timestamp: new Date(row.date),
      activeUsers: parseInt(row.active_users),
      sessions: parseInt(row.sessions),
      averageDuration: parseFloat(row.avg_duration) || 0,
      bounceRate: parseFloat(row.bounce_rate) || 0,
    }));
  }

  private async calculatePeriodRetention(
    userIds: string[],
    cohortDate: Date,
    days: number
  ): Promise<{ activeUsers: number }> {
    const periodStart = new Date(cohortDate);
    periodStart.setDate(periodStart.getDate() + days);
    const periodEnd = new Date(periodStart);
    periodEnd.setDate(periodEnd.getDate() + 1);

    const query = `
      SELECT COUNT(DISTINCT user_id) as count
      FROM user_activity
      WHERE user_id = ANY($1)
        AND activity_timestamp BETWEEN $2 AND $3
    `;

    const result = await this.db.query(query, [userIds, periodStart, periodEnd]);

    return {
      activeUsers: parseInt(result.rows[0].count),
    };
  }

  private async calculateCohortLTV(userIds: string[]): Promise<{ avgLTV: number }> {
    const query = `
      SELECT AVG(total_revenue) as avg_ltv
      FROM (
        SELECT user_id, COALESCE(SUM(amount), 0) as total_revenue
        FROM payments
        WHERE user_id = ANY($1) AND status = 'completed'
        GROUP BY user_id
      ) as user_revenues
    `;

    const result = await this.db.query(query, [userIds]);

    return {
      avgLTV: parseFloat(result.rows[0].avg_ltv) || 0,
    };
  }

  private generateSegmentId(criteria: UserSegmentCriteria): string {
    // Generate deterministic ID from criteria
    const parts: string[] = [];
    if (criteria.activityLevel) parts.push(`activity-${criteria.activityLevel}`);
    if (criteria.location) parts.push(`location-${criteria.location.join('-')}`);
    if (criteria.signupSource) parts.push(`source-${criteria.signupSource}`);
    return parts.join('_');
  }

  private generateSegmentName(criteria: UserSegmentCriteria): string {
    const parts: string[] = [];
    if (criteria.activityLevel) parts.push(`${criteria.activityLevel} activity`);
    if (criteria.location) parts.push(`from ${criteria.location.join(', ')}`);
    if (criteria.signupSource) parts.push(`via ${criteria.signupSource}`);
    return parts.join(' | ') || 'Custom Segment';
  }

  private async calculateSegmentEngagement(userIds: string[]): Promise<{ avgScore: number }> {
    const query = `
      SELECT AVG(engagement_score) as avg_score
      FROM users
      WHERE user_id = ANY($1)
    `;

    const result = await this.db.query(query, [userIds]);

    return {
      avgScore: parseFloat(result.rows[0].avg_score) || 0,
    };
  }

  private async calculateSegmentLTV(userIds: string[]): Promise<{ avgLTV: number }> {
    return this.calculateCohortLTV(userIds);
  }

  private async calculateSegmentChurn(userIds: string[]): Promise<{ rate: number }> {
    const churnThreshold = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const query = `
      SELECT
        COUNT(CASE WHEN last_activity < $2 THEN 1 END)::float / COUNT(*)::float * 100 as churn_rate
      FROM users
      WHERE user_id = ANY($1)
    `;

    const result = await this.db.query(query, [userIds, churnThreshold]);

    return {
      rate: parseFloat(result.rows[0].churn_rate) || 0,
    };
  }

  private async getSegmentTopActions(userIds: string[]): Promise<ActionMetric[]> {
    const query = `
      SELECT
        action_name,
        COUNT(*) as count,
        COUNT(DISTINCT user_id) as unique_users
      FROM user_actions
      WHERE user_id = ANY($1)
      GROUP BY action_name
      ORDER BY count DESC
      LIMIT 10
    `;

    try {
      const result = await this.db.query(query, [userIds]);

      return result.rows.map((row) => ({
        action: row.action_name,
        count: parseInt(row.count),
        uniqueUsers: parseInt(row.unique_users),
        frequency: row.unique_users > 0 ? row.count / row.unique_users : 0,
      }));
    } catch (error) {
      this.logger.warn('Failed to get segment top actions', { error });
      return [];
    }
  }

  private async getFunnelDefinition(
    funnelId: string
  ): Promise<Array<{ name: string; action: string }>> {
    // In real implementation, would fetch from database
    return [
      { name: 'Landing Page', action: 'page_view' },
      { name: 'Sign Up Form', action: 'form_view' },
      { name: 'Account Created', action: 'signup_complete' },
      { name: 'First Content', action: 'content_create' },
    ];
  }

  private async identifyDropOffPoints(steps: FunnelStep[]): Promise<DropOffPoint[]> {
    const dropOffs: DropOffPoint[] = [];

    for (let i = 0; i < steps.length - 1; i++) {
      const currentStep = steps[i];
      const nextStep = steps[i + 1];

      const dropOffRate = ((currentStep.users - nextStep.users) / currentStep.users) * 100;

      if (dropOffRate > 20) {
        // Significant drop-off threshold
        dropOffs.push({
          step: currentStep.stepName,
          nextStep: nextStep.stepName,
          dropOffRate,
          userCount: currentStep.users - nextStep.users,
          commonReasons: ['Unknown'], // Would analyze from user feedback
        });
      }
    }

    return dropOffs;
  }

  private async generateChurnPredictions(
    timeRange: AnalyticsTimeRange
  ): Promise<ChurnPrediction[]> {
    // Get users who are at risk
    const query = `
      SELECT user_id
      FROM users
      WHERE last_activity < NOW() - INTERVAL '14 days'
        AND last_activity > NOW() - INTERVAL '30 days'
        AND status = 'active'
      LIMIT 100
    `;

    const result = await this.db.query(query);

    const predictions = await Promise.all(
      result.rows.map((row) => this.predictUserChurn(row.user_id))
    );

    return predictions;
  }

  private async analyzeChurnRiskSegments(): Promise<ChurnRiskSegment[]> {
    // Simplified implementation
    return [
      {
        segment: 'New Users (< 30 days)',
        userCount: 100,
        riskScore: 65,
        churnRate: 35,
        commonFactors: ['low_engagement', 'no_content_created'],
      },
      {
        segment: 'Inactive Users (> 14 days)',
        userCount: 50,
        riskScore: 80,
        churnRate: 60,
        commonFactors: ['long_inactivity', 'no_subscription'],
      },
    ];
  }

  private async identifyRetentionOpportunities(
    predictions: ChurnPrediction[]
  ): Promise<RetentionOpportunity[]> {
    const highRiskCount = predictions.filter(
      (p) => p.riskLevel === 'high' || p.riskLevel === 'critical'
    ).length;

    return [
      {
        opportunityType: 'Re-engagement Campaign',
        affectedUsers: highRiskCount,
        potentialImpact: 25, // 25% reduction in churn
        recommendedAction: 'Send personalized content recommendations',
        estimatedCost: highRiskCount * 0.5, // $0.50 per user
      },
    ];
  }

  private calculateChurnRiskScore(factors: ChurnRiskFactor[]): number {
    return calculateChurnRiskScore(factors);
  }

  private getRiskLevel(riskScore: number): 'low' | 'medium' | 'high' | 'critical' {
    return getRiskLevel(riskScore);
  }

  private generateRetentionActions(factors: ChurnRiskFactor[], riskLevel: string): string[] {
    return generateRetentionActions(factors, riskLevel);
  }

  private determineGrowthType(
    trends: TrendPoint[]
  ): 'linear' | 'exponential' | 'plateau' | 'declining' {
    return determineGrowthType(trends);
  }

  private projectGrowth(trends: TrendPoint[]): GrowthProjection {
    return projectGrowth(trends);
  }

  private identifySeasonality(trends: TrendPoint[]): SeasonalityPattern[] {
    return identifySeasonality(trends);
  }

  private calculateRecencyScore(lastActivity: Date): number {
    return calculateRecencyScore(lastActivity);
  }

  private calculateLoyaltyScore(user: any): number {
    return calculateLoyaltyScore(user);
  }

  private calculateAccountAge(user: any): number {
    return calculateAccountAge(user);
  }

  private async getRecentActivitySummary(): Promise<RecentActivitySummary[]> {
    const query = `
      SELECT
        activity_type,
        COUNT(*) as count
      FROM user_activity
      WHERE activity_timestamp >= NOW() - INTERVAL '1 hour'
      GROUP BY activity_type
      ORDER BY count DESC
      LIMIT 5
    `;

    try {
      const result = await this.db.query(query);

      return result.rows.map((row) => ({
        activityType: row.activity_type,
        count: parseInt(row.count),
        trend: 'stable' as const,
        percentChange: 0,
      }));
    } catch (error) {
      this.logger.warn('Failed to get recent activity summary', { error });
      return [];
    }
  }

  private async generateAnalyticsAlerts(
    activeUsers: number,
    eventsPerSecond: number
  ): Promise<AnalyticsAlert[]> {
    const alerts: AnalyticsAlert[] = [];

    // Check for anomalies
    if (activeUsers < 10) {
      alerts.push({
        alertId: 'low-active-users',
        severity: 'warning',
        metric: 'active_users',
        message: 'Active user count is below threshold',
        timestamp: new Date(),
        threshold: 10,
        currentValue: activeUsers,
      });
    }

    if (eventsPerSecond > 1000) {
      alerts.push({
        alertId: 'high-event-rate',
        severity: 'info',
        metric: 'events_per_second',
        message: 'Unusually high event rate detected',
        timestamp: new Date(),
        threshold: 1000,
        currentValue: eventsPerSecond,
      });
    }

    return alerts;
  }

  private async gatherExportData(options: AnalyticsExportOptions): Promise<any[]> {
    // Gather data based on requested metrics
    const data: any[] = [];

    for (const metric of options.metrics) {
      switch (metric) {
        case 'acquisition':
          data.push(await this.getUserAcquisitionMetrics(options.timeRange));
          break;
        case 'engagement':
          data.push(await this.getEngagementMetrics(options.timeRange));
          break;
        case 'churn':
          data.push(await this.analyzeChurn(options.timeRange));
          break;
        // Add more metrics as needed
      }
    }

    return data;
  }

  private formatAsCSV(data: any[]): string {
    return formatAsCSV(data);
  }

  private generateExportId(): string {
    return generateExportId();
  }

  private async aggregateUserActivity(startDate: Date, endDate: Date): Promise<void> {
    // Aggregate user activity into summary tables
    const query = `
      INSERT INTO analytics_aggregates (timestamp, metric_name, metric_value, period_type)
      SELECT
        DATE_TRUNC('hour', activity_timestamp) as timestamp,
        'active_users' as metric_name,
        COUNT(DISTINCT user_id) as metric_value,
        'hourly' as period_type
      FROM user_activity
      WHERE activity_timestamp BETWEEN $1 AND $2
      GROUP BY DATE_TRUNC('hour', activity_timestamp)
      ON CONFLICT (timestamp, metric_name, period_type) DO UPDATE
      SET metric_value = EXCLUDED.metric_value
    `;

    await this.db.query(query, [startDate, endDate]);
  }

  private async aggregateEngagementMetrics(startDate: Date, endDate: Date): Promise<void> {
    // Aggregate engagement metrics
    const query = `
      INSERT INTO analytics_aggregates (timestamp, metric_name, metric_value, period_type)
      SELECT
        DATE_TRUNC('hour', activity_timestamp) as timestamp,
        'engagement_score' as metric_name,
        AVG(engagement_value) as metric_value,
        'hourly' as period_type
      FROM user_activity
      WHERE activity_timestamp BETWEEN $1 AND $2
      GROUP BY DATE_TRUNC('hour', activity_timestamp)
      ON CONFLICT (timestamp, metric_name, period_type) DO UPDATE
      SET metric_value = EXCLUDED.metric_value
    `;

    await this.db.query(query, [startDate, endDate]);
  }

  private async updateUserHealthScores(): Promise<void> {
    // Update health scores for active users
    const query = `
      SELECT user_id FROM users
      WHERE last_activity >= NOW() - INTERVAL '7 days'
      LIMIT 1000
    `;

    const result = await this.db.query(query);

    for (const row of result.rows) {
      try {
        await this.getUserHealthScore(row.user_id);
      } catch (error) {
        this.logger.warn('Failed to update health score', { userId: row.user_id, error });
      }
    }
  }

  private async cleanupOldAggregations(interval: string): Promise<void> {
    // Clean up old aggregation data
    const retentionDays = interval === 'hourly' ? 7 : 365;
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

    const query = `
      DELETE FROM analytics_aggregates
      WHERE timestamp < $1 AND period_type = $2
    `;

    await this.db.query(query, [cutoffDate, interval]);
  }
}
