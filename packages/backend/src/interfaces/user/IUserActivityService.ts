/**
 * User Activity Service Interface
 * Interface for tracking and analyzing user activity
 *
 * @epic Epic-005
 * @story US-E5-021
 */

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
} from '../../types/user-activity';

/**
 * UserActivityService Interface
 * Provides comprehensive user activity tracking, analytics, and privacy controls
 */
export interface IUserActivityService {
  // Activity Logging
  /**
   * Log a single activity event
   * @param userId - User performing the activity
   * @param type - Type of activity
   * @param metadata - Activity metadata
   * @param sessionId - Optional session ID
   * @returns Logged activity event
   */
  logActivity(
    userId: string,
    type: ActivityType,
    metadata: ActivityMetadata,
    sessionId?: string
  ): Promise<ActivityEvent>;

  /**
   * Log multiple activity events in batch
   * @param activities - Array of activities to log
   * @returns Array of logged activity events
   */
  logActivityBatch(activities: Omit<ActivityEvent, 'id' | 'timestamp'>[]): Promise<ActivityEvent[]>;

  // Activity Feed
  /**
   * Get activity feed for a user or globally
   * @param options - Feed filtering and pagination options
   * @returns Paginated activity feed
   */
  getActivityFeed(options: ActivityFeedOptions): Promise<ActivityFeed>;

  /**
   * Get real-time activity stream
   * @param userId - User to get stream for (optional for global)
   * @param types - Activity types to include
   * @returns AsyncIterator for streaming activities
   */
  getActivityStream(userId?: string, types?: ActivityType[]): AsyncIterableIterator<ActivityStreamEvent>;

  // Session Management
  /**
   * Create a new user session
   * @param userId - User ID
   * @param metadata - Session metadata (IP, user agent, etc.)
   * @returns Created session
   */
  createSession(userId: string, metadata: ActivityMetadata): Promise<UserSession>;

  /**
   * Update session activity
   * @param sessionId - Session to update
   * @returns Updated session
   */
  updateSessionActivity(sessionId: string): Promise<UserSession>;

  /**
   * End a user session
   * @param sessionId - Session to end
   * @returns Ended session
   */
  endSession(sessionId: string): Promise<UserSession>;

  /**
   * Get active sessions for a user
   * @param userId - User ID
   * @returns Array of active sessions
   */
  getActiveSessions(userId: string): Promise<UserSession[]>;

  /**
   * Get session by ID
   * @param sessionId - Session ID
   * @returns Session or null if not found
   */
  getSession(sessionId: string): Promise<UserSession | null>;

  // Statistics & Analytics
  /**
   * Get activity statistics for a time period
   * @param startDate - Start of period
   * @param endDate - End of period
   * @param userId - Optional user ID for user-specific stats
   * @returns Activity statistics
   */
  getActivityStats(startDate: Date, endDate: Date, userId?: string): Promise<ActivityStats>;

  /**
   * Get daily active users count
   * @param date - Date to get DAU for (defaults to today)
   * @returns Number of daily active users
   */
  getDailyActiveUsers(date?: Date): Promise<number>;

  /**
   * Get weekly active users count
   * @param date - Date to get WAU for (defaults to this week)
   * @returns Number of weekly active users
   */
  getWeeklyActiveUsers(date?: Date): Promise<number>;

  /**
   * Get monthly active users count
   * @param date - Date to get MAU for (defaults to this month)
   * @returns Number of monthly active users
   */
  getMonthlyActiveUsers(date?: Date): Promise<number>;

  /**
   * Calculate user retention rate
   * @param cohortDate - Date of user cohort
   * @param daysAfter - Days after cohort to check retention
   * @returns Retention rate (0-1)
   */
  getRetentionRate(cohortDate: Date, daysAfter: number): Promise<number>;

  /**
   * Get activity insights for a user
   * @param userId - User ID
   * @param startDate - Start of analysis period
   * @param endDate - End of analysis period
   * @returns Activity insights and patterns
   */
  getActivityInsights(userId: string, startDate: Date, endDate: Date): Promise<ActivityInsights>;

  // Aggregations & Rollups
  /**
   * Create activity aggregations for a time period
   * @param period - 'hourly', 'daily', 'weekly', or 'monthly'
   * @param startDate - Start of period
   * @param endDate - End of period
   * @returns Array of aggregations
   */
  createAggregations(
    period: 'hourly' | 'daily' | 'weekly' | 'monthly',
    startDate: Date,
    endDate: Date
  ): Promise<ActivityAggregation[]>;

  /**
   * Get existing aggregations
   * @param period - Aggregation period
   * @param startDate - Start of period
   * @param endDate - End of period
   * @param userId - Optional user ID
   * @returns Array of aggregations
   */
  getAggregations(
    period: 'hourly' | 'daily' | 'weekly' | 'monthly',
    startDate: Date,
    endDate: Date,
    userId?: string
  ): Promise<ActivityAggregation[]>;

  // Security & Fraud Detection
  /**
   * Analyze activity for suspicious patterns
   * @param userId - User to analyze
   * @param recentMinutes - How far back to analyze (default 60)
   * @returns Suspicious activity analysis
   */
  detectSuspiciousActivity(userId: string, recentMinutes?: number): Promise<SuspiciousActivityResult>;

  /**
   * Check rate limit for a specific activity type
   * @param userId - User ID
   * @param activityType - Type of activity
   * @param limit - Maximum allowed in window
   * @param windowMinutes - Time window in minutes
   * @returns Whether limit is exceeded
   */
  checkRateLimit(
    userId: string,
    activityType: ActivityType,
    limit: number,
    windowMinutes: number
  ): Promise<boolean>;

  // Privacy & Compliance
  /**
   * Export user activity for GDPR compliance
   * @param request - Export request parameters
   * @returns Exported activity data
   */
  exportUserActivity(request: ActivityExportRequest): Promise<ActivityExportResult>;

  /**
   * Anonymize user activities (remove PII)
   * @param userId - User to anonymize activities for
   * @param beforeDate - Anonymize activities before this date
   * @returns Number of activities anonymized
   */
  anonymizeActivities(userId: string, beforeDate?: Date): Promise<number>;

  /**
   * Delete user activities
   * @param userId - User to delete activities for
   * @param beforeDate - Delete activities before this date
   * @returns Number of activities deleted
   */
  deleteActivities(userId: string, beforeDate?: Date): Promise<number>;

  /**
   * Apply retention policy to clean up old activities
   * @param policy - Retention policy to apply
   * @returns Summary of cleanup actions
   */
  applyRetentionPolicy(policy: ActivityRetentionPolicy): Promise<{
    anonymized: number;
    deleted: number;
  }>;

  // Health & Monitoring
  /**
   * Get service health status
   * @returns Whether service is healthy
   */
  isHealthy(): Promise<boolean>;

  /**
   * Flush buffered activities to database
   * @returns Number of activities flushed
   */
  flush(): Promise<number>;

  /**
   * Dispose service and cleanup resources
   */
  dispose(): Promise<void>;
}
