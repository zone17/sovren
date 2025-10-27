/**
 * User Activity Type Definitions
 * Comprehensive types for user activity tracking and analytics
 *
 * @epic Epic-005
 * @story US-E5-021
 */

/**
 * Activity types representing different user actions
 */
export enum ActivityType {
  // Authentication
  LOGIN = 'login',
  LOGOUT = 'logout',
  FAILED_LOGIN = 'failed_login',
  PASSWORD_RESET = 'password_reset',
  MFA_ENABLED = 'mfa_enabled',
  MFA_DISABLED = 'mfa_disabled',

  // Profile
  PROFILE_CREATED = 'profile_created',
  PROFILE_UPDATED = 'profile_updated',
  PROFILE_VIEWED = 'profile_viewed',
  AVATAR_UPDATED = 'avatar_updated',

  // Content
  CONTENT_CREATED = 'content_created',
  CONTENT_PUBLISHED = 'content_published',
  CONTENT_UPDATED = 'content_updated',
  CONTENT_DELETED = 'content_deleted',
  CONTENT_VIEWED = 'content_viewed',
  CONTENT_LIKED = 'content_liked',
  CONTENT_SHARED = 'content_shared',
  CONTENT_COMMENTED = 'content_commented',

  // Subscriptions
  SUBSCRIPTION_CREATED = 'subscription_created',
  SUBSCRIPTION_CANCELLED = 'subscription_cancelled',
  SUBSCRIPTION_RENEWED = 'subscription_renewed',

  // Payments
  PAYMENT_MADE = 'payment_made',
  PAYMENT_RECEIVED = 'payment_received',
  PAYMENT_FAILED = 'payment_failed',
  PAYOUT_REQUESTED = 'payout_requested',
  PAYOUT_COMPLETED = 'payout_completed',

  // Social
  FOLLOW_USER = 'follow_user',
  UNFOLLOW_USER = 'unfollow_user',
  MESSAGE_SENT = 'message_sent',
  MESSAGE_RECEIVED = 'message_received',

  // API
  API_KEY_CREATED = 'api_key_created',
  API_KEY_REVOKED = 'api_key_revoked',
  API_REQUEST = 'api_request',

  // Settings
  SETTINGS_UPDATED = 'settings_updated',
  NOTIFICATION_PREFERENCES_UPDATED = 'notification_preferences_updated',
  PRIVACY_SETTINGS_UPDATED = 'privacy_settings_updated',

  // Security
  SESSION_CREATED = 'session_created',
  SESSION_EXPIRED = 'session_expired',
  SUSPICIOUS_ACTIVITY_DETECTED = 'suspicious_activity_detected',
  ACCOUNT_LOCKED = 'account_locked',
  ACCOUNT_UNLOCKED = 'account_unlocked',
}

/**
 * Structured metadata for activity events
 */
export interface ActivityMetadata {
  // Request context
  ipAddress?: string;
  userAgent?: string;
  location?: {
    country?: string;
    city?: string;
    timezone?: string;
  };
  device?: {
    type: 'desktop' | 'mobile' | 'tablet' | 'unknown';
    os?: string;
    browser?: string;
  };

  // Activity-specific data
  resourceId?: string;
  resourceType?: string;
  previousValue?: any;
  newValue?: any;
  amount?: number;
  currency?: string;
  duration?: number; // milliseconds

  // Additional context
  [key: string]: any;
}

/**
 * Single activity event record
 */
export interface ActivityEvent {
  id: string;
  userId: string;
  sessionId?: string;
  type: ActivityType;
  metadata: ActivityMetadata;
  timestamp: Date;
  isAnonymous?: boolean; // For privacy compliance
}

/**
 * Activity feed options for filtering and pagination
 */
export interface ActivityFeedOptions {
  userId?: string;
  types?: ActivityType[];
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
  includeAnonymized?: boolean;
}

/**
 * Activity feed result with pagination
 */
export interface ActivityFeed {
  activities: ActivityEvent[];
  total: number;
  hasMore: boolean;
  nextOffset?: number;
}

/**
 * User session information
 */
export interface UserSession {
  id: string;
  userId: string;
  startedAt: Date;
  lastActivityAt: Date;
  expiresAt?: Date;
  ipAddress?: string;
  userAgent?: string;
  device?: ActivityMetadata['device'];
  isActive: boolean;
  activityCount: number;
}

/**
 * Activity statistics for a time period
 */
export interface ActivityStats {
  period: {
    startDate: Date;
    endDate: Date;
  };
  metrics: {
    totalActivities: number;
    uniqueUsers: number;
    dailyActiveUsers: number;
    weeklyActiveUsers: number;
    monthlyActiveUsers: number;
    averageSessionDuration: number; // milliseconds
    averageActivitiesPerUser: number;
    averageActivitiesPerSession: number;
  };
  byType: {
    [K in ActivityType]?: number;
  };
  byHour: number[]; // 24 elements for hourly distribution
  byDayOfWeek: number[]; // 7 elements for day of week distribution
}

/**
 * Activity aggregation for rollups
 */
export interface ActivityAggregation {
  id: string;
  userId?: string; // null for global aggregations
  period: 'hourly' | 'daily' | 'weekly' | 'monthly';
  startDate: Date;
  endDate: Date;
  activityCounts: {
    [K in ActivityType]?: number;
  };
  uniqueUsers?: number;
  createdAt: Date;
}

/**
 * Real-time activity stream event
 */
export interface ActivityStreamEvent {
  activityId: string;
  userId: string;
  type: ActivityType;
  timestamp: Date;
  preview: string; // Human-readable preview
  metadata: Partial<ActivityMetadata>;
}

/**
 * Suspicious activity detection result
 */
export interface SuspiciousActivityResult {
  isSuspicious: boolean;
  confidence: number; // 0-1
  reasons: string[];
  recommendedAction?: 'none' | 'warn' | 'lock' | 'investigate';
  patterns: {
    rapidRequests?: boolean;
    multipleFailedLogins?: boolean;
    unusualLocation?: boolean;
    unusualTime?: boolean;
    suspiciousUserAgent?: boolean;
  };
}

/**
 * Activity export request for GDPR compliance
 */
export interface ActivityExportRequest {
  userId: string;
  startDate?: Date;
  endDate?: Date;
  format: 'json' | 'csv';
  includeMetadata: boolean;
}

/**
 * Activity export result
 */
export interface ActivityExportResult {
  requestId: string;
  userId: string;
  format: 'json' | 'csv';
  data: string | object;
  totalRecords: number;
  generatedAt: Date;
}

/**
 * Activity retention policy configuration
 */
export interface ActivityRetentionPolicy {
  retentionDays: number;
  anonymizeAfterDays?: number;
  deleteAfterDays?: number;
  exemptActivityTypes?: ActivityType[];
}

/**
 * Activity insights for pattern analysis
 */
export interface ActivityInsights {
  userId: string;
  period: {
    startDate: Date;
    endDate: Date;
  };
  patterns: {
    mostActiveHours: number[]; // Top 3 hours
    mostActiveDays: number[]; // Top 3 days of week
    mostFrequentActivities: ActivityType[];
    averageSessionDuration: number;
    peakActivityTime: Date;
  };
  comparisons: {
    previousPeriod: {
      totalActivitiesChange: number; // percentage
      activeUsersChange: number; // percentage
    };
    globalAverage: {
      activitiesPerUserDiff: number; // percentage vs average
      sessionDurationDiff: number; // percentage vs average
    };
  };
}

/**
 * Rate limit tracking for activity monitoring
 */
export interface RateLimitTracker {
  userId: string;
  activityType: ActivityType;
  windowStart: Date;
  windowEnd: Date;
  count: number;
  limit: number;
  isExceeded: boolean;
}

/**
 * Activity buffer for high-throughput logging
 */
export interface ActivityBuffer {
  activities: ActivityEvent[];
  maxSize: number;
  flushIntervalMs: number;
  lastFlushedAt: Date;
}
