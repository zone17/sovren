/**
 * Shared Service Factory
 * Factory implementation for shared/utility services
 * Part of Epic 005 - Backend Service Refactoring - Story E5-004
 */

import { SafeServiceFactory } from '../ServiceFactory';
import { ServiceToken } from '../../interfaces/shared/IServiceRegistry';
import { IEventBus } from '../../interfaces/shared/IEventBus';

// Service Tokens
export const SHARED_SERVICE_TOKENS = {
  EmailService: new ServiceToken<IEmailService>('EmailService'),
  NotificationService: new ServiceToken<INotificationService>('NotificationService'),
  AuditLogService: new ServiceToken<IAuditLogService>('AuditLogService'),
  CacheService: new ServiceToken<ICacheService>('CacheService'),
  EventBus: new ServiceToken<IEventBus>('EventBus'),
  Logger: new ServiceToken<ILogger>('Logger'),
  Database: new ServiceToken<IDatabase>('Database'),
  RedisClient: new ServiceToken<IRedisClient>('RedisClient')
};

// Shared Service Interfaces
export interface IEmailService {
  sendEmail(options: EmailOptions): Promise<EmailResult>;
  sendBulkEmails(recipients: EmailRecipient[]): Promise<BulkEmailResult>;
  validateEmail(email: string): boolean;
  getEmailTemplate(templateId: string): Promise<EmailTemplate | null>;
  trackEmailEvent(event: EmailEvent): Promise<void>;
  getEmailStats(filter: EmailStatsFilter): Promise<EmailStats>;
}

export interface INotificationService {
  sendNotification(notification: Notification): Promise<NotificationResult>;
  sendBulkNotifications(notifications: Notification[]): Promise<BulkNotificationResult>;
  getNotificationChannels(userId: string): Promise<NotificationChannel[]>;
  updateNotificationPreferences(userId: string, preferences: NotificationPreferences): Promise<void>;
  markAsRead(notificationId: string): Promise<void>;
  markAllAsRead(userId: string): Promise<void>;
  getUnreadCount(userId: string): Promise<number>;
}

export interface IAuditLogService {
  log(entry: AuditEntry): Promise<void>;
  query(filter: AuditFilter): Promise<AuditEntry[]>;
  export(filter: AuditFilter, format: 'json' | 'csv'): Promise<string>;
  getAuditTrail(entityId: string, entityType: string): Promise<AuditEntry[]>;
  purgeOldLogs(beforeDate: Date): Promise<number>;
  getComplianceReport(period: TimePeriod): Promise<ComplianceReport>;
}

export interface ICacheService {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  deletePattern(pattern: string): Promise<number>;
  exists(key: string): Promise<boolean>;
  expire(key: string, ttl: number): Promise<void>;
  flush(): Promise<void>;
  getStats(): Promise<CacheStats>;
}

// Type definitions
interface EmailOptions {
  to: string | string[];
  from?: string;
  subject: string;
  html?: string;
  text?: string;
  templateId?: string;
  variables?: Record<string, any>;
  attachments?: EmailAttachment[];
  replyTo?: string;
  cc?: string[];
  bcc?: string[];
}

interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  timestamp: Date;
}

interface Notification {
  id?: string;
  userId: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  channel: 'in-app' | 'email' | 'push' | 'sms';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  data?: Record<string, any>;
  expiresAt?: Date;
}

interface AuditEntry {
  id?: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValue?: any;
  newValue?: any;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
  timestamp: Date;
}

interface CacheStats {
  hits: number;
  misses: number;
  keys: number;
  memoryUsage: number;
  evictions: number;
  hitRate: number;
}

interface ILogger {
  info(message: string, meta?: any): void;
  error(message: string, error?: Error): void;
  warn(message: string, meta?: any): void;
  debug(message: string, meta?: any): void;
}

interface IDatabase {
  query<T>(sql: string, params?: any[]): Promise<T[]>;
  execute(sql: string, params?: any[]): Promise<void>;
  transaction<T>(fn: () => Promise<T>): Promise<T>;
}

interface IRedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options?: any): Promise<void>;
  del(key: string): Promise<number>;
  keys(pattern: string): Promise<string[]>;
  expire(key: string, seconds: number): Promise<boolean>;
  ttl(key: string): Promise<number>;
}

// Factory Implementations

/**
 * Email Service Factory
 */
export class EmailServiceFactory extends SafeServiceFactory<IEmailService> {
  protected validateDependencies(): boolean {
    return this.canCreate();
  }

  protected getRequiredDependencies(): ServiceToken<any>[] {
    return [
      SHARED_SERVICE_TOKENS.Logger,
      SHARED_SERVICE_TOKENS.Database,
      SHARED_SERVICE_TOKENS.EventBus
    ];
  }

  async create(): Promise<IEmailService> {
    const logger = this.resolve(SHARED_SERVICE_TOKENS.Logger);
    const db = this.resolve(SHARED_SERVICE_TOKENS.Database);
    const eventBus = this.resolve(SHARED_SERVICE_TOKENS.EventBus);

    return {
      async sendEmail(options: EmailOptions): Promise<EmailResult> {
        try {
          logger.info('Sending email', {
            to: options.to,
            subject: options.subject,
            templateId: options.templateId
          });

          // Here would be actual email sending logic (SendGrid, SES, etc.)
          const messageId = `msg_${Date.now()}`;

          // Log email event
          await db.execute(
            'INSERT INTO email_logs (message_id, recipient, subject, status, sent_at) VALUES (?, ?, ?, ?, ?)',
            [messageId, Array.isArray(options.to) ? options.to.join(',') : options.to, options.subject, 'sent', new Date()]
          );

          return {
            success: true,
            messageId,
            timestamp: new Date()
          };
        } catch (error) {
          logger.error('Failed to send email', error as Error);
          return {
            success: false,
            error: (error as Error).message,
            timestamp: new Date()
          };
        }
      },

      async sendBulkEmails(recipients: any[]): Promise<any> {
        logger.info(`Sending bulk emails to ${recipients.length} recipients`);

        const results = await Promise.all(
          recipients.map(recipient =>
            this.sendEmail({
              to: recipient.email,
              subject: recipient.subject,
              templateId: recipient.templateId,
              variables: recipient.variables
            })
          )
        );

        return {
          total: recipients.length,
          successful: results.filter(r => r.success).length,
          failed: results.filter(r => !r.success).length,
          results
        };
      },

      validateEmail(email: string): boolean {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
      },

      async getEmailTemplate(templateId: string): Promise<any> {
        const results = await db.query(
          'SELECT * FROM email_templates WHERE id = ?',
          [templateId]
        );
        return results[0] || null;
      },

      async trackEmailEvent(event: any): Promise<void> {
        await db.execute(
          'INSERT INTO email_events (message_id, event_type, timestamp, metadata) VALUES (?, ?, ?, ?)',
          [event.messageId, event.type, new Date(), JSON.stringify(event.metadata)]
        );
      },

      async getEmailStats(filter: any): Promise<any> {
        const stats = await db.query(
          'SELECT COUNT(*) as total, SUM(CASE WHEN status = "sent" THEN 1 ELSE 0 END) as sent FROM email_logs WHERE sent_at >= ?',
          [filter.startDate]
        );
        return stats[0];
      }
    };
  }
}

/**
 * Notification Service Factory
 */
export class NotificationServiceFactory extends SafeServiceFactory<INotificationService> {
  protected validateDependencies(): boolean {
    return this.canCreate();
  }

  protected getRequiredDependencies(): ServiceToken<any>[] {
    return [
      SHARED_SERVICE_TOKENS.Logger,
      SHARED_SERVICE_TOKENS.Database,
      SHARED_SERVICE_TOKENS.EventBus,
      SHARED_SERVICE_TOKENS.CacheService
    ];
  }

  async create(): Promise<INotificationService> {
    const logger = this.resolve(SHARED_SERVICE_TOKENS.Logger);
    const db = this.resolve(SHARED_SERVICE_TOKENS.Database);
    const eventBus = this.resolve(SHARED_SERVICE_TOKENS.EventBus);
    const cache = this.resolve(SHARED_SERVICE_TOKENS.CacheService);

    return {
      async sendNotification(notification: Notification): Promise<any> {
        logger.info('Sending notification', {
          userId: notification.userId,
          type: notification.type,
          channel: notification.channel
        });

        const notificationId = notification.id || `notif_${Date.now()}`;

        // Store notification
        await db.execute(
          'INSERT INTO notifications (id, user_id, type, title, message, channel, priority, data, created_at, read_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [notificationId, notification.userId, notification.type, notification.title, notification.message,
           notification.channel, notification.priority, JSON.stringify(notification.data), new Date(), null]
        );

        // Update unread count in cache
        const countKey = `unread_count:${notification.userId}`;
        await cache.delete(countKey);

        return {
          success: true,
          notificationId,
          timestamp: new Date()
        };
      },

      async sendBulkNotifications(notifications: Notification[]): Promise<any> {
        const results = await Promise.all(
          notifications.map(n => this.sendNotification(n))
        );

        return {
          total: notifications.length,
          successful: results.filter(r => r.success).length,
          failed: results.filter(r => !r.success).length
        };
      },

      async getNotificationChannels(userId: string): Promise<any[]> {
        const results = await db.query(
          'SELECT channel, enabled FROM notification_preferences WHERE user_id = ?',
          [userId]
        );
        return results;
      },

      async updateNotificationPreferences(userId: string, preferences: any): Promise<void> {
        logger.info(`Updating notification preferences for user ${userId}`);
        // Update preferences in database
      },

      async markAsRead(notificationId: string): Promise<void> {
        await db.execute(
          'UPDATE notifications SET read_at = ? WHERE id = ?',
          [new Date(), notificationId]
        );

        // Clear cache
        const notification = await db.query<{user_id: string}>(
          'SELECT user_id FROM notifications WHERE id = ?',
          [notificationId]
        );
        if (notification[0]) {
          await cache.delete(`unread_count:${notification[0].user_id}`);
        }
      },

      async markAllAsRead(userId: string): Promise<void> {
        await db.execute(
          'UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL',
          [new Date(), userId]
        );
        await cache.delete(`unread_count:${userId}`);
      },

      async getUnreadCount(userId: string): Promise<number> {
        const cacheKey = `unread_count:${userId}`;
        const cached = await cache.get<number>(cacheKey);
        if (cached !== null) return cached;

        const result = await db.query<{count: number}>(
          'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read_at IS NULL',
          [userId]
        );

        const count = result[0]?.count || 0;
        await cache.set(cacheKey, count, 300); // Cache for 5 minutes
        return count;
      }
    };
  }
}

/**
 * Audit Log Service Factory
 */
export class AuditLogServiceFactory extends SafeServiceFactory<IAuditLogService> {
  protected validateDependencies(): boolean {
    return this.canCreate();
  }

  protected getRequiredDependencies(): ServiceToken<any>[] {
    return [
      SHARED_SERVICE_TOKENS.Logger,
      SHARED_SERVICE_TOKENS.Database
    ];
  }

  async create(): Promise<IAuditLogService> {
    const logger = this.resolve(SHARED_SERVICE_TOKENS.Logger);
    const db = this.resolve(SHARED_SERVICE_TOKENS.Database);

    return {
      async log(entry: AuditEntry): Promise<void> {
        logger.debug('Audit log entry', entry);

        await db.execute(
          `INSERT INTO audit_logs
           (user_id, action, entity_type, entity_id, old_value, new_value, ip_address, user_agent, metadata, timestamp)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [entry.userId, entry.action, entry.entityType, entry.entityId,
           JSON.stringify(entry.oldValue), JSON.stringify(entry.newValue),
           entry.ipAddress, entry.userAgent, JSON.stringify(entry.metadata), entry.timestamp]
        );
      },

      async query(filter: any): Promise<AuditEntry[]> {
        let query = 'SELECT * FROM audit_logs WHERE 1=1';
        const params: any[] = [];

        if (filter.userId) {
          query += ' AND user_id = ?';
          params.push(filter.userId);
        }
        if (filter.action) {
          query += ' AND action = ?';
          params.push(filter.action);
        }
        if (filter.entityType) {
          query += ' AND entity_type = ?';
          params.push(filter.entityType);
        }
        if (filter.startDate) {
          query += ' AND timestamp >= ?';
          params.push(filter.startDate);
        }
        if (filter.endDate) {
          query += ' AND timestamp <= ?';
          params.push(filter.endDate);
        }

        query += ' ORDER BY timestamp DESC LIMIT 1000';

        return db.query<AuditEntry>(query, params);
      },

      async export(filter: any, format: 'json' | 'csv'): Promise<string> {
        const entries = await this.query(filter);

        if (format === 'json') {
          return JSON.stringify(entries, null, 2);
        } else {
          // CSV export logic
          const headers = ['timestamp', 'userId', 'action', 'entityType', 'entityId'];
          const rows = entries.map(e => [e.timestamp, e.userId, e.action, e.entityType, e.entityId]);
          return [headers, ...rows].map(r => r.join(',')).join('\n');
        }
      },

      async getAuditTrail(entityId: string, entityType: string): Promise<AuditEntry[]> {
        return db.query<AuditEntry>(
          'SELECT * FROM audit_logs WHERE entity_id = ? AND entity_type = ? ORDER BY timestamp DESC',
          [entityId, entityType]
        );
      },

      async purgeOldLogs(beforeDate: Date): Promise<number> {
        const result = await db.execute(
          'DELETE FROM audit_logs WHERE timestamp < ?',
          [beforeDate]
        );
        logger.info(`Purged audit logs before ${beforeDate}`);
        return 0; // Would return affected rows count
      },

      async getComplianceReport(period: any): Promise<any> {
        // Generate compliance report based on audit logs
        return {
          period,
          totalActions: 0,
          userActivity: {},
          criticalActions: [],
          anomalies: []
        };
      }
    };
  }
}

/**
 * Cache Service Factory
 */
export class CacheServiceFactory extends SafeServiceFactory<ICacheService> {
  protected validateDependencies(): boolean {
    return this.canCreate();
  }

  protected getRequiredDependencies(): ServiceToken<any>[] {
    return [
      SHARED_SERVICE_TOKENS.Logger,
      SHARED_SERVICE_TOKENS.RedisClient
    ];
  }

  async create(): Promise<ICacheService> {
    const logger = this.resolve(SHARED_SERVICE_TOKENS.Logger);
    const redis = this.resolveOptional(SHARED_SERVICE_TOKENS.RedisClient);

    // In-memory cache fallback if Redis not available
    const memoryCache = new Map<string, { value: any; expires: number }>();

    return {
      async get<T>(key: string): Promise<T | null> {
        if (redis) {
          const value = await redis.get(key);
          return value ? JSON.parse(value) : null;
        } else {
          const entry = memoryCache.get(key);
          if (!entry) return null;
          if (entry.expires < Date.now()) {
            memoryCache.delete(key);
            return null;
          }
          return entry.value;
        }
      },

      async set<T>(key: string, value: T, ttl = 3600): Promise<void> {
        if (redis) {
          await redis.set(key, JSON.stringify(value), { EX: ttl });
        } else {
          memoryCache.set(key, {
            value,
            expires: Date.now() + (ttl * 1000)
          });
        }
      },

      async delete(key: string): Promise<void> {
        if (redis) {
          await redis.del(key);
        } else {
          memoryCache.delete(key);
        }
      },

      async deletePattern(pattern: string): Promise<number> {
        if (redis) {
          const keys = await redis.keys(pattern);
          if (keys.length > 0) {
            await Promise.all(keys.map(k => redis.del(k)));
          }
          return keys.length;
        } else {
          let count = 0;
          const regex = new RegExp(pattern.replace('*', '.*'));
          for (const key of memoryCache.keys()) {
            if (regex.test(key)) {
              memoryCache.delete(key);
              count++;
            }
          }
          return count;
        }
      },

      async exists(key: string): Promise<boolean> {
        if (redis) {
          const ttl = await redis.ttl(key);
          return ttl > 0;
        } else {
          return memoryCache.has(key);
        }
      },

      async expire(key: string, ttl: number): Promise<void> {
        if (redis) {
          await redis.expire(key, ttl);
        } else {
          const entry = memoryCache.get(key);
          if (entry) {
            entry.expires = Date.now() + (ttl * 1000);
          }
        }
      },

      async flush(): Promise<void> {
        if (redis) {
          // Would flush Redis cache
        } else {
          memoryCache.clear();
        }
        logger.warn('Cache flushed');
      },

      async getStats(): Promise<CacheStats> {
        return {
          hits: 0,
          misses: 0,
          keys: memoryCache.size,
          memoryUsage: 0,
          evictions: 0,
          hitRate: 0
        };
      }
    };
  }
}