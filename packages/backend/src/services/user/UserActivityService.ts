/**
 * UserActivityService Implementation
 * Comprehensive user activity tracking with analytics, security, and privacy controls
 *
 * Features:
 * - High-throughput buffered activity logging
 * - Real-time activity streams via Event Bus
 * - Session management with automatic tracking
 * - Advanced analytics and insights
 * - Suspicious activity detection
 * - GDPR-compliant data export and retention
 * - Activity aggregations for performance
 *
 * @epic Epic-005
 * @story US-E5-021
 */

import { injectable, inject } from 'inversify';
import { TYPES } from '../../container/types';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../../utils/logger';
import { ServiceError, NotFoundError, ValidationError } from '../../utils/errors';
import { IUserActivityService } from '../../interfaces/user/IUserActivityService';
import type { IEventBus } from '../../interfaces/shared/IEventBus';
import { DomainEventType } from '../../interfaces/shared/IEventBus';

import {
  ActivityEvent,
  ActivityType,
  ActivityFeedOptions,
  ActivityFeed,
  UserSession,
  ActivityStats,
  ActivityAggregation,
  ActivityStreamEvent,
  SuspiciousActivityResult,
  ActivityExportRequest,
  ActivityExportResult,
  ActivityRetentionPolicy,
  ActivityInsights,
  ActivityMetadata,
  ActivityBuffer,
} from '../../types/user-activity';

// Mock interfaces for dependencies (these should exist in your codebase)
interface IDatabase {
  query(sql: string, params?: any[]): Promise<{ rows: any[] }>;
}

interface ICacheService {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: any, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<void>;
  increment(key: string, amount?: number): Promise<number>;
}

interface IAuditLogService {
  log(entry: any): Promise<void>;
}

/**
 * UserActivityService - Production-ready activity tracking
 */
@injectable()
export class UserActivityService implements IUserActivityService {
  private readonly logger: Logger;
  private activityBuffer: ActivityBuffer;
  private flushInterval: NodeJS.Timeout | null = null;
  private isDisposed = false;

  // Configuration
  private readonly BUFFER_SIZE = 1000;
  private readonly FLUSH_INTERVAL_MS = 5000; // 5 seconds
  private readonly SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
  private readonly CACHE_TTL = 3600; // 1 hour

  // Rate limiting defaults
  private readonly DEFAULT_RATE_LIMITS: Record<string, { limit: number; windowMinutes: number }> = {
    [ActivityType.LOGIN]: { limit: 10, windowMinutes: 15 },
    [ActivityType.FAILED_LOGIN]: { limit: 5, windowMinutes: 15 },
    [ActivityType.API_REQUEST]: { limit: 1000, windowMinutes: 1 },
    [ActivityType.CONTENT_CREATED]: { limit: 50, windowMinutes: 60 },
  };

  constructor(
    @inject(TYPES.Database) private readonly db: IDatabase,
    @inject(TYPES.CacheService) private readonly cache: ICacheService,
    @inject(TYPES.EventBus) private readonly eventBus: IEventBus,
    @inject(TYPES.AuditLog) private readonly auditLog: IAuditLogService
  ) {
    this.logger = new Logger(UserActivityService.name);
    this.activityBuffer = {
      activities: [],
      maxSize: this.BUFFER_SIZE,
      flushIntervalMs: this.FLUSH_INTERVAL_MS,
      lastFlushedAt: new Date(),
    };

    this.initializeService();
  }

  /**
   * Initialize service - start flush interval and subscribe to events
   */
  private initializeService(): void {
    // Start periodic buffer flush
    this.flushInterval = setInterval(() => {
      this.flush().catch((error) => {
        this.logger.error('Failed to flush activity buffer', error);
      });
    }, this.FLUSH_INTERVAL_MS);

    // Subscribe to domain events for automatic activity logging
    this.subscribeToEvents();

    this.logger.info('UserActivityService initialized');
  }

  /**
   * Subscribe to domain events to automatically log activities
   */
  private subscribeToEvents(): void {
    // User events
    this.eventBus.subscribe(DomainEventType.USER_LOGGED_IN, async (event) => {
      await this.logActivity(
        event.aggregateId,
        ActivityType.LOGIN,
        {
          ipAddress: event.metadata.ipAddress,
          userAgent: event.metadata.userAgent,
        },
        event.payload.sessionId
      );
    });

    this.eventBus.subscribe(DomainEventType.USER_LOGGED_OUT, async (event) => {
      await this.logActivity(
        event.aggregateId,
        ActivityType.LOGOUT,
        {},
        event.payload.sessionId
      );
    });

    // Content events
    this.eventBus.subscribe(DomainEventType.CONTENT_CREATED, async (event) => {
      await this.logActivity(
        event.metadata.userId || 'unknown',
        ActivityType.CONTENT_CREATED,
        { resourceId: event.aggregateId, resourceType: 'content' }
      );
    });

    this.eventBus.subscribe(DomainEventType.CONTENT_PUBLISHED, async (event) => {
      await this.logActivity(
        event.metadata.userId || 'unknown',
        ActivityType.CONTENT_PUBLISHED,
        { resourceId: event.aggregateId, resourceType: 'content' }
      );
    });

    this.eventBus.subscribe(DomainEventType.CONTENT_VIEWED, async (event) => {
      await this.logActivity(
        event.metadata.userId || 'unknown',
        ActivityType.CONTENT_VIEWED,
        {
          resourceId: event.aggregateId,
          resourceType: 'content',
          duration: event.payload.duration,
        }
      );
    });

    // Payment events
    this.eventBus.subscribe(DomainEventType.PAYMENT_RECEIVED, async (event) => {
      await this.logActivity(
        event.metadata.userId || 'unknown',
        ActivityType.PAYMENT_RECEIVED,
        {
          resourceId: event.aggregateId,
          amount: event.payload.amount,
          currency: event.payload.currency,
        }
      );
    });

    // Subscription events
    this.eventBus.subscribe(DomainEventType.SUBSCRIPTION_CREATED, async (event) => {
      await this.logActivity(
        event.metadata.userId || 'unknown',
        ActivityType.SUBSCRIPTION_CREATED,
        { resourceId: event.aggregateId, resourceType: 'subscription' }
      );
    });
  }

  // ============================================================================
  // Activity Logging
  // ============================================================================

  public async logActivity(
    userId: string,
    type: ActivityType,
    metadata: ActivityMetadata,
    sessionId?: string
  ): Promise<ActivityEvent> {
    try {
      this.ensureNotDisposed();

      const activity: ActivityEvent = {
        id: uuidv4(),
        userId,
        sessionId,
        type,
        metadata: {
          ...metadata,
          device: this.parseDevice(metadata.userAgent),
        },
        timestamp: new Date(),
        isAnonymous: false,
      };

      // Add to buffer
      this.activityBuffer.activities.push(activity);

      // Flush if buffer is full
      if (this.activityBuffer.activities.length >= this.BUFFER_SIZE) {
        await this.flush();
      }

      // Update session if provided
      if (sessionId) {
        await this.updateSessionActivity(sessionId).catch((error) => {
          this.logger.warn('Failed to update session activity', { sessionId, error: error.message });
        });
      }

      // Emit real-time event
      await this.eventBus.publish({
        id: uuidv4(),
        type: DomainEventType.USER_LOGGED_IN, // Generic activity event
        aggregateId: userId,
        aggregateType: 'user_activity',
        payload: {
          activityId: activity.id,
          activityType: type,
        },
        metadata: {
          userId,
          timestamp: new Date(),
          version: '1.0.0',
          source: 'UserActivityService',
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
        },
      });

      // Increment cache counter for quick stats
      await this.incrementActivityCounter(userId, type);

      this.logger.debug('Activity logged', { userId, type, activityId: activity.id });
      return activity;
    } catch (error) {
      this.logger.error('Failed to log activity', error);
      throw new ServiceError('Failed to log activity', { cause: error });
    }
  }

  public async logActivityBatch(
    activities: Omit<ActivityEvent, 'id' | 'timestamp'>[]
  ): Promise<ActivityEvent[]> {
    try {
      this.ensureNotDisposed();

      const enhancedActivities: ActivityEvent[] = activities.map((activity) => ({
        ...activity,
        id: uuidv4(),
        timestamp: new Date(),
        metadata: {
          ...activity.metadata,
          device: this.parseDevice(activity.metadata.userAgent),
        },
      }));

      // Add all to buffer
      this.activityBuffer.activities.push(...enhancedActivities);

      // Flush if needed
      if (this.activityBuffer.activities.length >= this.BUFFER_SIZE) {
        await this.flush();
      }

      this.logger.info('Activity batch logged', { count: activities.length });
      return enhancedActivities;
    } catch (error) {
      this.logger.error('Failed to log activity batch', error);
      throw new ServiceError('Failed to log activity batch', { cause: error });
    }
  }

  // ============================================================================
  // Activity Feed
  // ============================================================================

  public async getActivityFeed(options: ActivityFeedOptions): Promise<ActivityFeed> {
    try {
      this.ensureNotDisposed();

      const {
        userId,
        types,
        startDate,
        endDate,
        limit = 50,
        offset = 0,
        includeAnonymized = false,
      } = options;

      // Build query
      let query = 'SELECT * FROM user_activities WHERE 1=1';
      const params: any[] = [];
      let paramIndex = 1;

      if (userId) {
        query += ` AND user_id = $${paramIndex++}`;
        params.push(userId);
      }

      if (types && types.length > 0) {
        query += ` AND type = ANY($${paramIndex++})`;
        params.push(types);
      }

      if (startDate) {
        query += ` AND timestamp >= $${paramIndex++}`;
        params.push(startDate);
      }

      if (endDate) {
        query += ` AND timestamp <= $${paramIndex++}`;
        params.push(endDate);
      }

      if (!includeAnonymized) {
        query += ' AND is_anonymous = false';
      }

      // Get total count
      const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total');
      const countResult = await this.db.query(countQuery, params);
      const total = parseInt(countResult.rows[0]?.total || '0', 10);

      // Get paginated results
      query += ` ORDER BY timestamp DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
      params.push(limit, offset);

      const result = await this.db.query(query, params);

      const activities: ActivityEvent[] = result.rows.map(this.mapRowToActivity);

      return {
        activities,
        total,
        hasMore: offset + activities.length < total,
        nextOffset: offset + activities.length < total ? offset + limit : undefined,
      };
    } catch (error) {
      this.logger.error('Failed to get activity feed', error);
      throw new ServiceError('Failed to get activity feed', { cause: error });
    }
  }

  public async *getActivityStream(
    userId?: string,
    types?: ActivityType[]
  ): AsyncIterableIterator<ActivityStreamEvent> {
    // This would typically integrate with a message queue or WebSocket
    // For now, we'll poll the database (in production, use Redis Streams or similar)

    let lastTimestamp = new Date();

    while (!this.isDisposed) {
      const feed = await this.getActivityFeed({
        userId,
        types,
        startDate: lastTimestamp,
        limit: 100,
      });

      for (const activity of feed.activities) {
        yield this.activityToStreamEvent(activity);
        lastTimestamp = activity.timestamp;
      }

      // Wait before polling again
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  // ============================================================================
  // Session Management
  // ============================================================================

  public async createSession(userId: string, metadata: ActivityMetadata): Promise<UserSession> {
    try {
      this.ensureNotDisposed();

      const session: UserSession = {
        id: uuidv4(),
        userId,
        startedAt: new Date(),
        lastActivityAt: new Date(),
        expiresAt: new Date(Date.now() + this.SESSION_TIMEOUT_MS),
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        device: this.parseDevice(metadata.userAgent),
        isActive: true,
        activityCount: 0,
      };

      // Store in cache for quick access
      await this.cache.set(`session:${session.id}`, session, this.SESSION_TIMEOUT_MS / 1000);

      // Store in database for persistence
      await this.db.query(
        `INSERT INTO user_sessions (id, user_id, started_at, last_activity_at, expires_at,
          ip_address, user_agent, device_type, device_os, device_browser, is_active, activity_count)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          session.id,
          session.userId,
          session.startedAt,
          session.lastActivityAt,
          session.expiresAt,
          session.ipAddress,
          session.userAgent,
          session.device?.type,
          session.device?.os,
          session.device?.browser,
          session.isActive,
          session.activityCount,
        ]
      );

      // Log session creation
      await this.logActivity(userId, ActivityType.SESSION_CREATED, metadata, session.id);

      this.logger.info('Session created', { sessionId: session.id, userId });
      return session;
    } catch (error) {
      this.logger.error('Failed to create session', error);
      throw new ServiceError('Failed to create session', { cause: error });
    }
  }

  public async updateSessionActivity(sessionId: string): Promise<UserSession> {
    try {
      this.ensureNotDisposed();

      // Get from cache first
      let session = await this.cache.get<UserSession>(`session:${sessionId}`);

      if (!session) {
        // Fallback to database
        const result = await this.db.query(
          'SELECT * FROM user_sessions WHERE id = $1',
          [sessionId]
        );

        if (result.rows.length === 0) {
          throw new NotFoundError('Session');
        }

        session = this.mapRowToSession(result.rows[0]);
      }

      // Update activity timestamp
      session.lastActivityAt = new Date();
      session.activityCount++;

      // Update cache
      await this.cache.set(
        `session:${sessionId}`,
        session,
        this.SESSION_TIMEOUT_MS / 1000
      );

      // Update database (async, non-blocking)
      this.db
        .query(
          'UPDATE user_sessions SET last_activity_at = $1, activity_count = $2 WHERE id = $3',
          [session.lastActivityAt, session.activityCount, sessionId]
        )
        .catch((error) => {
          this.logger.warn('Failed to update session in database', { sessionId, error: error.message });
        });

      return session;
    } catch (error) {
      this.logger.error('Failed to update session activity', error);
      throw new ServiceError('Failed to update session activity', { cause: error });
    }
  }

  public async endSession(sessionId: string): Promise<UserSession> {
    try {
      this.ensureNotDisposed();

      const session = await this.getSession(sessionId);
      if (!session) {
        throw new NotFoundError('Session');
      }

      session.isActive = false;

      // Update database
      await this.db.query(
        'UPDATE user_sessions SET is_active = false WHERE id = $1',
        [sessionId]
      );

      // Remove from cache
      await this.cache.delete(`session:${sessionId}`);

      // Log session expiration
      await this.logActivity(session.userId, ActivityType.SESSION_EXPIRED, {}, sessionId);

      this.logger.info('Session ended', { sessionId });
      return session;
    } catch (error) {
      this.logger.error('Failed to end session', error);
      throw new ServiceError('Failed to end session', { cause: error });
    }
  }

  public async getActiveSessions(userId: string): Promise<UserSession[]> {
    try {
      this.ensureNotDisposed();

      const result = await this.db.query(
        `SELECT * FROM user_sessions
         WHERE user_id = $1 AND is_active = true AND expires_at > NOW()
         ORDER BY last_activity_at DESC`,
        [userId]
      );

      return result.rows.map(this.mapRowToSession);
    } catch (error) {
      this.logger.error('Failed to get active sessions', error);
      throw new ServiceError('Failed to get active sessions', { cause: error });
    }
  }

  public async getSession(sessionId: string): Promise<UserSession | null> {
    try {
      this.ensureNotDisposed();

      // Try cache first
      const cached = await this.cache.get<UserSession>(`session:${sessionId}`);
      if (cached) {
        return cached;
      }

      // Fallback to database
      const result = await this.db.query(
        'SELECT * FROM user_sessions WHERE id = $1',
        [sessionId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const session = this.mapRowToSession(result.rows[0]);

      // Cache for future lookups
      if (session.isActive) {
        await this.cache.set(`session:${sessionId}`, session, this.SESSION_TIMEOUT_MS / 1000);
      }

      return session;
    } catch (error) {
      this.logger.error('Failed to get session', error);
      return null;
    }
  }

  // ============================================================================
  // Statistics & Analytics
  // ============================================================================

  public async getActivityStats(
    startDate: Date,
    endDate: Date,
    userId?: string
  ): Promise<ActivityStats> {
    try {
      this.ensureNotDisposed();

      // Check cache first
      const cacheKey = `activity_stats:${startDate.getTime()}:${endDate.getTime()}:${userId || 'global'}`;
      const cached = await this.cache.get<ActivityStats>(cacheKey);
      if (cached) {
        return cached;
      }

      // Build base query
      let baseQuery = 'FROM user_activities WHERE timestamp >= $1 AND timestamp <= $2';
      const params: any[] = [startDate, endDate];

      if (userId) {
        baseQuery += ' AND user_id = $3';
        params.push(userId);
      }

      // Total activities
      const totalResult = await this.db.query(`SELECT COUNT(*) as total ${baseQuery}`, params);
      const totalActivities = parseInt(totalResult.rows[0].total, 10);

      // Unique users
      const usersResult = await this.db.query(
        `SELECT COUNT(DISTINCT user_id) as count ${baseQuery}`,
        params
      );
      const uniqueUsers = parseInt(usersResult.rows[0].count, 10);

      // Activities by type
      const byTypeResult = await this.db.query(
        `SELECT type, COUNT(*) as count ${baseQuery} GROUP BY type`,
        params
      );
      const byType: { [key in ActivityType]?: number } = {};
      byTypeResult.rows.forEach((row) => {
        byType[row.type as ActivityType] = parseInt(row.count, 10);
      });

      // Hourly distribution
      const byHourResult = await this.db.query(
        `SELECT EXTRACT(HOUR FROM timestamp) as hour, COUNT(*) as count ${baseQuery} GROUP BY hour ORDER BY hour`,
        params
      );
      const byHour = new Array(24).fill(0);
      byHourResult.rows.forEach((row) => {
        byHour[parseInt(row.hour, 10)] = parseInt(row.count, 10);
      });

      // Day of week distribution
      const byDayResult = await this.db.query(
        `SELECT EXTRACT(DOW FROM timestamp) as day, COUNT(*) as count ${baseQuery} GROUP BY day ORDER BY day`,
        params
      );
      const byDayOfWeek = new Array(7).fill(0);
      byDayResult.rows.forEach((row) => {
        byDayOfWeek[parseInt(row.day, 10)] = parseInt(row.count, 10);
      });

      // Calculate DAU, WAU, MAU (for this period)
      const dauResult = await this.db.query(
        `SELECT COUNT(DISTINCT user_id) as count FROM (
          SELECT user_id, DATE(timestamp) as day ${baseQuery} GROUP BY user_id, day
        ) subquery`,
        params
      );
      const dailyActiveUsers = parseInt(dauResult.rows[0]?.count || '0', 10);

      // Session metrics
      const sessionResult = await this.db.query(
        `SELECT
          AVG(EXTRACT(EPOCH FROM (COALESCE(ended_at, NOW()) - started_at)) * 1000) as avg_duration,
          AVG(activity_count) as avg_activities_per_session
         FROM user_sessions
         WHERE started_at >= $1 AND started_at <= $2${userId ? ' AND user_id = $3' : ''}`,
        params
      );

      const stats: ActivityStats = {
        period: { startDate, endDate },
        metrics: {
          totalActivities,
          uniqueUsers,
          dailyActiveUsers,
          weeklyActiveUsers: uniqueUsers, // Simplified
          monthlyActiveUsers: uniqueUsers, // Simplified
          averageSessionDuration: parseFloat(sessionResult.rows[0]?.avg_duration || '0'),
          averageActivitiesPerUser: totalActivities / (uniqueUsers || 1),
          averageActivitiesPerSession: parseFloat(sessionResult.rows[0]?.avg_activities_per_session || '0'),
        },
        byType,
        byHour,
        byDayOfWeek,
      };

      // Cache results
      await this.cache.set(cacheKey, stats, this.CACHE_TTL);

      return stats;
    } catch (error) {
      this.logger.error('Failed to get activity stats', error);
      throw new ServiceError('Failed to get activity stats', { cause: error });
    }
  }

  public async getDailyActiveUsers(date: Date = new Date()): Promise<number> {
    try {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const result = await this.db.query(
        'SELECT COUNT(DISTINCT user_id) as count FROM user_activities WHERE timestamp >= $1 AND timestamp <= $2',
        [startOfDay, endOfDay]
      );

      return parseInt(result.rows[0]?.count || '0', 10);
    } catch (error) {
      this.logger.error('Failed to get DAU', error);
      return 0;
    }
  }

  public async getWeeklyActiveUsers(date: Date = new Date()): Promise<number> {
    try {
      const startOfWeek = new Date(date);
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(endOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);

      const result = await this.db.query(
        'SELECT COUNT(DISTINCT user_id) as count FROM user_activities WHERE timestamp >= $1 AND timestamp <= $2',
        [startOfWeek, endOfWeek]
      );

      return parseInt(result.rows[0]?.count || '0', 10);
    } catch (error) {
      this.logger.error('Failed to get WAU', error);
      return 0;
    }
  }

  public async getMonthlyActiveUsers(date: Date = new Date()): Promise<number> {
    try {
      const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
      const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);

      const result = await this.db.query(
        'SELECT COUNT(DISTINCT user_id) as count FROM user_activities WHERE timestamp >= $1 AND timestamp <= $2',
        [startOfMonth, endOfMonth]
      );

      return parseInt(result.rows[0]?.count || '0', 10);
    } catch (error) {
      this.logger.error('Failed to get MAU', error);
      return 0;
    }
  }

  public async getRetentionRate(cohortDate: Date, daysAfter: number): Promise<number> {
    try {
      // Get users who were active on cohort date
      const cohortStart = new Date(cohortDate);
      cohortStart.setHours(0, 0, 0, 0);
      const cohortEnd = new Date(cohortDate);
      cohortEnd.setHours(23, 59, 59, 999);

      const cohortResult = await this.db.query(
        'SELECT DISTINCT user_id FROM user_activities WHERE timestamp >= $1 AND timestamp <= $2',
        [cohortStart, cohortEnd]
      );
      const cohortSize = cohortResult.rows.length;

      if (cohortSize === 0) {
        return 0;
      }

      // Get users who were active N days after
      const retentionDate = new Date(cohortDate);
      retentionDate.setDate(retentionDate.getDate() + daysAfter);
      const retentionStart = new Date(retentionDate);
      retentionStart.setHours(0, 0, 0, 0);
      const retentionEnd = new Date(retentionDate);
      retentionEnd.setHours(23, 59, 59, 999);

      const cohortUserIds = cohortResult.rows.map((row) => row.user_id);
      const retentionResult = await this.db.query(
        'SELECT COUNT(DISTINCT user_id) as count FROM user_activities WHERE user_id = ANY($1) AND timestamp >= $2 AND timestamp <= $3',
        [cohortUserIds, retentionStart, retentionEnd]
      );

      const retainedUsers = parseInt(retentionResult.rows[0]?.count || '0', 10);
      return retainedUsers / cohortSize;
    } catch (error) {
      this.logger.error('Failed to calculate retention rate', error);
      return 0;
    }
  }

  public async getActivityInsights(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<ActivityInsights> {
    try {
      this.ensureNotDisposed();

      // Get user stats
      const stats = await this.getActivityStats(startDate, endDate, userId);

      // Find most active hours
      const hourCounts = stats.byHour.map((count, hour) => ({ hour, count }));
      hourCounts.sort((a, b) => b.count - a.count);
      const mostActiveHours = hourCounts.slice(0, 3).map((h) => h.hour);

      // Find most active days
      const dayCounts = stats.byDayOfWeek.map((count, day) => ({ day, count }));
      dayCounts.sort((a, b) => b.count - a.count);
      const mostActiveDays = dayCounts.slice(0, 3).map((d) => d.day);

      // Find most frequent activities
      const activityEntries = Object.entries(stats.byType) as [ActivityType, number][];
      activityEntries.sort((a, b) => b[1] - a[1]);
      const mostFrequentActivities = activityEntries.slice(0, 5).map((e) => e[0]);

      // Find peak activity time
      const allActivities = await this.getActivityFeed({
        userId,
        startDate,
        endDate,
        limit: 1000,
      });
      const peakActivityTime = this.findPeakActivityTime(allActivities.activities);

      // Calculate comparisons (simplified - in production, query previous period)
      const insights: ActivityInsights = {
        userId,
        period: { startDate, endDate },
        patterns: {
          mostActiveHours,
          mostActiveDays,
          mostFrequentActivities,
          averageSessionDuration: stats.metrics.averageSessionDuration,
          peakActivityTime,
        },
        comparisons: {
          previousPeriod: {
            totalActivitiesChange: 0, // Would compare with previous period
            activeUsersChange: 0,
          },
          globalAverage: {
            activitiesPerUserDiff: 0, // Would compare with global average
            sessionDurationDiff: 0,
          },
        },
      };

      return insights;
    } catch (error) {
      this.logger.error('Failed to get activity insights', error);
      throw new ServiceError('Failed to get activity insights', { cause: error });
    }
  }

  // ============================================================================
  // Aggregations & Rollups
  // ============================================================================

  public async createAggregations(
    period: 'hourly' | 'daily' | 'weekly' | 'monthly',
    startDate: Date,
    endDate: Date
  ): Promise<ActivityAggregation[]> {
    try {
      this.ensureNotDisposed();

      const aggregations: ActivityAggregation[] = [];
      const intervals = this.generateIntervals(period, startDate, endDate);

      for (const interval of intervals) {
        // Get stats for interval
        const stats = await this.getActivityStats(interval.start, interval.end);

        // Create aggregation
        const aggregation: ActivityAggregation = {
          id: uuidv4(),
          period,
          startDate: interval.start,
          endDate: interval.end,
          activityCounts: stats.byType,
          uniqueUsers: stats.metrics.uniqueUsers,
          createdAt: new Date(),
        };

        // Store in database
        await this.db.query(
          `INSERT INTO activity_aggregations (id, period, start_date, end_date, activity_counts, unique_users, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            aggregation.id,
            aggregation.period,
            aggregation.startDate,
            aggregation.endDate,
            JSON.stringify(aggregation.activityCounts),
            aggregation.uniqueUsers,
            aggregation.createdAt,
          ]
        );

        aggregations.push(aggregation);
      }

      this.logger.info('Created aggregations', { period, count: aggregations.length });
      return aggregations;
    } catch (error) {
      this.logger.error('Failed to create aggregations', error);
      throw new ServiceError('Failed to create aggregations', { cause: error });
    }
  }

  public async getAggregations(
    period: 'hourly' | 'daily' | 'weekly' | 'monthly',
    startDate: Date,
    endDate: Date,
    userId?: string
  ): Promise<ActivityAggregation[]> {
    try {
      this.ensureNotDisposed();

      let query = `SELECT * FROM activity_aggregations
                   WHERE period = $1 AND start_date >= $2 AND end_date <= $3`;
      const params: any[] = [period, startDate, endDate];

      if (userId) {
        query += ' AND user_id = $4';
        params.push(userId);
      }

      query += ' ORDER BY start_date ASC';

      const result = await this.db.query(query, params);

      return result.rows.map(this.mapRowToAggregation);
    } catch (error) {
      this.logger.error('Failed to get aggregations', error);
      throw new ServiceError('Failed to get aggregations', { cause: error });
    }
  }

  // ============================================================================
  // Security & Fraud Detection
  // ============================================================================

  public async detectSuspiciousActivity(
    userId: string,
    recentMinutes: number = 60
  ): Promise<SuspiciousActivityResult> {
    try {
      this.ensureNotDisposed();

      const since = new Date(Date.now() - recentMinutes * 60 * 1000);
      const activities = await this.getActivityFeed({
        userId,
        startDate: since,
        limit: 1000,
      });

      const result: SuspiciousActivityResult = {
        isSuspicious: false,
        confidence: 0,
        reasons: [],
        patterns: {
          rapidRequests: false,
          multipleFailedLogins: false,
          unusualLocation: false,
          unusualTime: false,
          suspiciousUserAgent: false,
        },
      };

      // Check for rapid requests
      if (activities.activities.length > 100) {
        result.patterns.rapidRequests = true;
        result.reasons.push(`High activity volume: ${activities.activities.length} actions in ${recentMinutes} minutes`);
      }

      // Check for multiple failed logins
      const failedLogins = activities.activities.filter(
        (a) => a.type === ActivityType.FAILED_LOGIN
      );
      if (failedLogins.length >= 5) {
        result.patterns.multipleFailedLogins = true;
        result.reasons.push(`${failedLogins.length} failed login attempts`);
      }

      // Check for unusual locations
      const locations = activities.activities
        .map((a) => a.metadata.location?.country)
        .filter(Boolean);
      const uniqueLocations = new Set(locations);
      if (uniqueLocations.size > 3) {
        result.patterns.unusualLocation = true;
        result.reasons.push(`Activities from ${uniqueLocations.size} different countries`);
      }

      // Check for unusual times (e.g., 2am-5am)
      const nightActivities = activities.activities.filter((a) => {
        const hour = a.timestamp.getHours();
        return hour >= 2 && hour <= 5;
      });
      if (nightActivities.length > 10) {
        result.patterns.unusualTime = true;
        result.reasons.push(`${nightActivities.length} activities during unusual hours`);
      }

      // Calculate overall suspicion
      const suspiciousPatterns = Object.values(result.patterns).filter(Boolean).length;
      result.confidence = suspiciousPatterns / 5;
      result.isSuspicious = suspiciousPatterns >= 2;

      if (result.isSuspicious) {
        result.recommendedAction = suspiciousPatterns >= 4 ? 'lock' : 'warn';

        // Log suspicious activity
        await this.auditLog.log({
          action: 'security.suspicious_activity_detected',
          userId,
          details: result,
          timestamp: new Date(),
          severity: 'warning',
        });
      }

      return result;
    } catch (error) {
      this.logger.error('Failed to detect suspicious activity', error);
      throw new ServiceError('Failed to detect suspicious activity', { cause: error });
    }
  }

  public async checkRateLimit(
    userId: string,
    activityType: ActivityType,
    limit: number,
    windowMinutes: number
  ): Promise<boolean> {
    try {
      this.ensureNotDisposed();

      const cacheKey = `rate_limit:${userId}:${activityType}:${windowMinutes}`;
      const count = (await this.cache.get<number>(cacheKey)) || 0;

      if (count >= limit) {
        this.logger.warn('Rate limit exceeded', { userId, activityType, count, limit });
        return true;
      }

      // Increment counter
      await this.cache.increment(cacheKey, 1);

      // Set expiration if this is the first request
      if (count === 0) {
        await this.cache.set(cacheKey, 1, windowMinutes * 60);
      }

      return false;
    } catch (error) {
      this.logger.error('Failed to check rate limit', error);
      return false; // Fail open for availability
    }
  }

  // ============================================================================
  // Privacy & Compliance
  // ============================================================================

  public async exportUserActivity(request: ActivityExportRequest): Promise<ActivityExportResult> {
    try {
      this.ensureNotDisposed();

      const { userId, startDate, endDate, format, includeMetadata } = request;

      const activities = await this.getActivityFeed({
        userId,
        startDate,
        endDate,
        limit: 10000, // Maximum for export
      });

      let data: string | object;

      if (format === 'json') {
        data = activities.activities.map((activity) => ({
          id: activity.id,
          type: activity.type,
          timestamp: activity.timestamp.toISOString(),
          ...(includeMetadata ? { metadata: activity.metadata } : {}),
        }));
      } else {
        // CSV format
        const headers = ['id', 'type', 'timestamp', ...(includeMetadata ? ['metadata'] : [])];
        const rows = activities.activities.map((activity) =>
          [
            activity.id,
            activity.type,
            activity.timestamp.toISOString(),
            ...(includeMetadata ? [JSON.stringify(activity.metadata)] : []),
          ].join(',')
        );
        data = [headers.join(','), ...rows].join('\n');
      }

      const result: ActivityExportResult = {
        requestId: uuidv4(),
        userId,
        format,
        data,
        totalRecords: activities.total,
        generatedAt: new Date(),
      };

      // Log export for audit
      await this.auditLog.log({
        action: 'privacy.activity_exported',
        userId,
        details: { format, totalRecords: result.totalRecords },
        timestamp: new Date(),
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to export user activity', error);
      throw new ServiceError('Failed to export user activity', { cause: error });
    }
  }

  public async anonymizeActivities(userId: string, beforeDate?: Date): Promise<number> {
    try {
      this.ensureNotDisposed();

      const cutoffDate = beforeDate || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000); // 1 year ago

      const result = await this.db.query(
        `UPDATE user_activities
         SET is_anonymous = true,
             metadata = jsonb_set(
               jsonb_set(metadata, '{ipAddress}', '"anonymized"'),
               '{userAgent}', '"anonymized"'
             )
         WHERE user_id = $1 AND timestamp < $2 AND is_anonymous = false`,
        [userId, cutoffDate]
      );

      const count = result.rows[0]?.count || 0;

      await this.auditLog.log({
        action: 'privacy.activities_anonymized',
        userId,
        details: { count, beforeDate: cutoffDate },
        timestamp: new Date(),
      });

      this.logger.info('Activities anonymized', { userId, count });
      return count;
    } catch (error) {
      this.logger.error('Failed to anonymize activities', error);
      throw new ServiceError('Failed to anonymize activities', { cause: error });
    }
  }

  public async deleteActivities(userId: string, beforeDate?: Date): Promise<number> {
    try {
      this.ensureNotDisposed();

      const cutoffDate = beforeDate || new Date(Date.now() - 730 * 24 * 60 * 60 * 1000); // 2 years ago

      const result = await this.db.query(
        'DELETE FROM user_activities WHERE user_id = $1 AND timestamp < $2',
        [userId, cutoffDate]
      );

      const count = result.rows[0]?.count || 0;

      await this.auditLog.log({
        action: 'privacy.activities_deleted',
        userId,
        details: { count, beforeDate: cutoffDate },
        timestamp: new Date(),
      });

      this.logger.info('Activities deleted', { userId, count });
      return count;
    } catch (error) {
      this.logger.error('Failed to delete activities', error);
      throw new ServiceError('Failed to delete activities', { cause: error });
    }
  }

  public async applyRetentionPolicy(
    policy: ActivityRetentionPolicy
  ): Promise<{ anonymized: number; deleted: number }> {
    try {
      this.ensureNotDisposed();

      let anonymized = 0;
      let deleted = 0;

      // Anonymize old activities
      if (policy.anonymizeAfterDays) {
        const anonymizeDate = new Date(Date.now() - policy.anonymizeAfterDays * 24 * 60 * 60 * 1000);
        const result = await this.db.query(
          `UPDATE user_activities
           SET is_anonymous = true,
               metadata = jsonb_set(
                 jsonb_set(metadata, '{ipAddress}', '"anonymized"'),
                 '{userAgent}', '"anonymized"'
               )
           WHERE timestamp < $1 AND is_anonymous = false${
             policy.exemptActivityTypes ? ' AND type NOT IN ($2)' : ''
           }`,
          policy.exemptActivityTypes
            ? [anonymizeDate, policy.exemptActivityTypes]
            : [anonymizeDate]
        );
        anonymized = result.rows[0]?.count || 0;
      }

      // Delete very old activities
      if (policy.deleteAfterDays) {
        const deleteDate = new Date(Date.now() - policy.deleteAfterDays * 24 * 60 * 60 * 1000);
        const result = await this.db.query(
          `DELETE FROM user_activities
           WHERE timestamp < $1${policy.exemptActivityTypes ? ' AND type NOT IN ($2)' : ''}`,
          policy.exemptActivityTypes ? [deleteDate, policy.exemptActivityTypes] : [deleteDate]
        );
        deleted = result.rows[0]?.count || 0;
      }

      await this.auditLog.log({
        action: 'privacy.retention_policy_applied',
        userId: 'system',
        details: { policy, anonymized, deleted },
        timestamp: new Date(),
      });

      this.logger.info('Retention policy applied', { anonymized, deleted });
      return { anonymized, deleted };
    } catch (error) {
      this.logger.error('Failed to apply retention policy', error);
      throw new ServiceError('Failed to apply retention policy', { cause: error });
    }
  }

  // ============================================================================
  // Health & Monitoring
  // ============================================================================

  public async isHealthy(): Promise<boolean> {
    try {
      // Check database connectivity
      await this.db.query('SELECT 1');

      // Check cache connectivity
      await this.cache.get('health_check');

      return true;
    } catch (error) {
      this.logger.error('Health check failed', error);
      return false;
    }
  }

  public async flush(): Promise<number> {
    try {
      if (this.activityBuffer.activities.length === 0) {
        return 0;
      }

      const activities = [...this.activityBuffer.activities];
      this.activityBuffer.activities = [];
      this.activityBuffer.lastFlushedAt = new Date();

      // Batch insert into database
      const values = activities
        .map(
          (a, i) =>
            `($${i * 7 + 1}, $${i * 7 + 2}, $${i * 7 + 3}, $${i * 7 + 4}, $${i * 7 + 5}, $${i * 7 + 6}, $${i * 7 + 7})`
        )
        .join(',');

      const params = activities.flatMap((a) => [
        a.id,
        a.userId,
        a.sessionId || null,
        a.type,
        JSON.stringify(a.metadata),
        a.timestamp,
        a.isAnonymous || false,
      ]);

      await this.db.query(
        `INSERT INTO user_activities (id, user_id, session_id, type, metadata, timestamp, is_anonymous)
         VALUES ${values}`,
        params
      );

      this.logger.debug('Activity buffer flushed', { count: activities.length });
      return activities.length;
    } catch (error) {
      this.logger.error('Failed to flush activity buffer', error);
      // Re-add activities to buffer if flush failed
      this.activityBuffer.activities.unshift(...this.activityBuffer.activities);
      throw new ServiceError('Failed to flush activity buffer', { cause: error });
    }
  }

  public async dispose(): Promise<void> {
    if (this.isDisposed) {
      return;
    }

    this.isDisposed = true;

    // Stop flush interval
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }

    // Flush remaining activities
    try {
      await this.flush();
    } catch (error) {
      this.logger.error('Failed to flush on dispose', error);
    }

    this.logger.info('UserActivityService disposed');
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private parseDevice(userAgent?: string): ActivityMetadata['device'] {
    if (!userAgent) {
      return { type: 'unknown' };
    }

    const ua = userAgent.toLowerCase();
    let type: 'desktop' | 'mobile' | 'tablet' | 'unknown' = 'unknown';

    if (/mobile/.test(ua)) {
      type = 'mobile';
    } else if (/tablet|ipad/.test(ua)) {
      type = 'tablet';
    } else if (/desktop|windows|mac|linux/.test(ua)) {
      type = 'desktop';
    }

    let os: string | undefined;
    if (/windows/.test(ua)) os = 'Windows';
    else if (/mac/.test(ua)) os = 'macOS';
    else if (/linux/.test(ua)) os = 'Linux';
    else if (/android/.test(ua)) os = 'Android';
    else if (/ios|iphone|ipad/.test(ua)) os = 'iOS';

    let browser: string | undefined;
    if (/chrome/.test(ua)) browser = 'Chrome';
    else if (/firefox/.test(ua)) browser = 'Firefox';
    else if (/safari/.test(ua)) browser = 'Safari';
    else if (/edge/.test(ua)) browser = 'Edge';

    return { type, os, browser };
  }

  private async incrementActivityCounter(userId: string, type: ActivityType): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const key = `activity_counter:${userId}:${today}:${type}`;
      await this.cache.increment(key, 1);
      await this.cache.set(key, await this.cache.get(key), 86400); // 24 hours TTL
    } catch (error) {
      this.logger.warn('Failed to increment activity counter', { error: error.message });
    }
  }

  private activityToStreamEvent(activity: ActivityEvent): ActivityStreamEvent {
    return {
      activityId: activity.id,
      userId: activity.userId,
      type: activity.type,
      timestamp: activity.timestamp,
      preview: this.generateActivityPreview(activity),
      metadata: {
        ipAddress: activity.metadata.ipAddress,
        device: activity.metadata.device,
      },
    };
  }

  private generateActivityPreview(activity: ActivityEvent): string {
    switch (activity.type) {
      case ActivityType.LOGIN:
        return 'User logged in';
      case ActivityType.CONTENT_CREATED:
        return 'Created new content';
      case ActivityType.PAYMENT_MADE:
        return `Made payment of ${activity.metadata.amount} ${activity.metadata.currency}`;
      default:
        return activity.type.replace(/_/g, ' ');
    }
  }

  private findPeakActivityTime(activities: ActivityEvent[]): Date {
    if (activities.length === 0) {
      return new Date();
    }

    // Group by hour
    const hourCounts: Record<string, number> = {};
    activities.forEach((activity) => {
      const hourKey = activity.timestamp.toISOString().substring(0, 13); // YYYY-MM-DDTHH
      hourCounts[hourKey] = (hourCounts[hourKey] || 0) + 1;
    });

    // Find max
    const maxHour = Object.entries(hourCounts).reduce((max, [hour, count]) =>
      count > max.count ? { hour, count } : max
    , { hour: '', count: 0 });

    return new Date(maxHour.hour);
  }

  private generateIntervals(
    period: 'hourly' | 'daily' | 'weekly' | 'monthly',
    startDate: Date,
    endDate: Date
  ): Array<{ start: Date; end: Date }> {
    const intervals: Array<{ start: Date; end: Date }> = [];
    let current = new Date(startDate);

    while (current < endDate) {
      const intervalStart = new Date(current);
      let intervalEnd: Date;

      switch (period) {
        case 'hourly':
          intervalEnd = new Date(current.getTime() + 60 * 60 * 1000);
          break;
        case 'daily':
          intervalEnd = new Date(current);
          intervalEnd.setDate(intervalEnd.getDate() + 1);
          break;
        case 'weekly':
          intervalEnd = new Date(current);
          intervalEnd.setDate(intervalEnd.getDate() + 7);
          break;
        case 'monthly':
          intervalEnd = new Date(current);
          intervalEnd.setMonth(intervalEnd.getMonth() + 1);
          break;
      }

      if (intervalEnd > endDate) {
        intervalEnd = new Date(endDate);
      }

      intervals.push({ start: intervalStart, end: intervalEnd });
      current = intervalEnd;
    }

    return intervals;
  }

  private mapRowToActivity(row: any): ActivityEvent {
    return {
      id: row.id,
      userId: row.user_id,
      sessionId: row.session_id,
      type: row.type as ActivityType,
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
      timestamp: new Date(row.timestamp),
      isAnonymous: row.is_anonymous || false,
    };
  }

  private mapRowToSession(row: any): UserSession {
    return {
      id: row.id,
      userId: row.user_id,
      startedAt: new Date(row.started_at),
      lastActivityAt: new Date(row.last_activity_at),
      expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      device: {
        type: row.device_type || 'unknown',
        os: row.device_os,
        browser: row.device_browser,
      },
      isActive: row.is_active,
      activityCount: row.activity_count || 0,
    };
  }

  private mapRowToAggregation(row: any): ActivityAggregation {
    return {
      id: row.id,
      userId: row.user_id,
      period: row.period,
      startDate: new Date(row.start_date),
      endDate: new Date(row.end_date),
      activityCounts:
        typeof row.activity_counts === 'string'
          ? JSON.parse(row.activity_counts)
          : row.activity_counts,
      uniqueUsers: row.unique_users,
      createdAt: new Date(row.created_at),
    };
  }

  private ensureNotDisposed(): void {
    if (this.isDisposed) {
      throw new ServiceError('Service has been disposed');
    }
  }
}
