/**
 * NotificationService Implementation
 * User Story: US-E5-008
 * Multi-channel notification system with user preferences and fallback support
 * Part of Epic 005 - Backend Service Layer Refactoring
 */

import type { INotificationService } from '../interfaces/communication/INotificationService';
import type { IEventBus } from '../interfaces/shared/IEventBus';
import type { ILogger } from '../interfaces/shared/ILogger';
import type { ICacheService } from '../interfaces/shared/ICacheService';
import type { IEmailService } from '../interfaces/communication/IEmailService';
import type { IQueueService } from '../interfaces/queue/IQueueService';
import type {
  NotificationPriority,
} from '../types/notification';

/**
 * Internal notification types used by this service.
 * These extend the shared types with richer domain-specific fields.
 */

type InternalChannel = 'email' | 'push' | 'inApp' | 'sms';

interface Notification {
  id?: string;
  userId: string;
  type?: string;
  title: string;
  body: string;
  email?: string;
  channels?: InternalChannel[];
  priority?: NotificationPriority;
  templateId?: string;
  data?: Record<string, unknown>;
  retryOnFailure?: boolean;
  [key: string]: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

interface NotificationResult {
  success: boolean;
  error?: string;
  channels: InternalChannel[];
  messageId?: string;
  deliveredAt?: Date;
  queued?: boolean;
}

interface NotificationPreferences {
  userId: string;
  enabled: boolean;
  channels: InternalChannel[];
  quiet?: {
    enabled: boolean;
    start?: string;
    end?: string;
    timezone?: string;
  };
  types?: Record<string, boolean>;
}

interface NotificationTemplate {
  id: string;
  title: string;
  body: string;
  channels?: InternalChannel[];
  priority?: NotificationPriority;
}

interface NotificationDeliveryStatus {
  notificationId: string;
  status: 'sent' | 'delivered' | 'failed';
  deliveredAt?: Date;
  channel: InternalChannel;
  events: unknown[];
}

interface NotificationMetrics {
  sent: number;
  failed: number;
  pending: number;
  delivered: number;
  opened: number;
  clicked: number;
  byChannel: Record<InternalChannel, { sent: number; failed: number }>;
}

interface BulkNotificationRequest {
  notifications: Notification[];
  batchSize?: number;
  delayMs?: number;
}

interface BulkNotificationResult {
  totalSent: number;
  totalFailed: number;
  totalQueued: number;
  results: NotificationResult[];
  duration: number;
}

interface NotificationHistory {
  id: string;
  userId: string;
  title: string;
  body: string;
  channel: InternalChannel;
  status: 'sent' | 'failed';
  sentAt: Date;
  type?: string;
}

type NotificationChannel = InternalChannel;

// EventEmitter and webpush imported when push notification channel is implemented
import { createHash } from 'crypto';
import type { JobContext } from '../interfaces/queue/IJobProcessor';

/**
 * Channel handler interface
 */
interface IChannelHandler {
  send(notification: Notification): Promise<NotificationResult>;
  isAvailable(): Promise<boolean>;
  getPriority(): number;
}

/** BullMQ queue name for notification jobs */
const NOTIFICATION_QUEUE = 'notifications';

/** Rate limit: max notifications per window (configurable via env) */
const NOTIFICATION_RATE_LIMIT_MAX = parseInt(process.env.NOTIFICATION_RATE_LIMIT_MAX || '50', 10);
/** Rate limit window in milliseconds (default: 60 seconds) */
const NOTIFICATION_RATE_LIMIT_DURATION = parseInt(
  process.env.NOTIFICATION_RATE_LIMIT_DURATION || '60000',
  10
);

/**
 * Concrete implementation of NotificationService
 */
export class NotificationService {
  private readonly eventBus: IEventBus;
  private readonly logger: ILogger;
  private readonly cache?: ICacheService;
  private readonly emailService?: IEmailService;
  private readonly queueService?: IQueueService;
  private readonly channelHandlers: Map<NotificationChannel, IChannelHandler> = new Map();
  private readonly templates: Map<string, NotificationTemplate> = new Map();
  private readonly userPreferences: Map<string, NotificationPreferences> = new Map();
  private readonly metrics: NotificationMetrics;

  constructor(
    eventBus: IEventBus,
    logger: ILogger,
    cache?: ICacheService,
    emailService?: IEmailService,
    queueService?: IQueueService
  ) {
    this.eventBus = eventBus;
    this.logger = logger;
    this.cache = cache;
    this.emailService = emailService;
    this.queueService = queueService;

    // Initialize metrics
    this.metrics = {
      sent: 0,
      failed: 0,
      pending: 0,
      delivered: 0,
      opened: 0,
      clicked: 0,
      byChannel: {
        email: { sent: 0, failed: 0 },
        push: { sent: 0, failed: 0 },
        inApp: { sent: 0, failed: 0 },
        sms: { sent: 0, failed: 0 },
      },
    };

    // Initialize channel handlers
    this.initializeChannelHandlers();

    // Initialize BullMQ queue and worker
    this.initializeQueue();
  }

  async send(notification: Notification): Promise<NotificationResult> {
    try {
      // Validate notification
      this.validateNotification(notification);

      // Get user preferences
      const preferences = await this.getUserPreferences(notification.userId);

      // Check if user has disabled notifications
      if (!preferences.enabled) {
        return {
          success: false,
          error: 'User has disabled notifications',
          channels: [],
        };
      }

      // Check if notification type is enabled
      if (notification.type && preferences.types) {
        const typePreference = preferences.types[notification.type];
        if (typePreference === false) {
          return {
            success: false,
            error: `User has disabled ${notification.type} notifications`,
            channels: [],
          };
        }
      }

      // Determine channels to use
      const channels = this.determineChannels(notification, preferences);

      // Check for duplicate notifications
      if (await this.isDuplicate(notification)) {
        return {
          success: false,
          error: 'Duplicate notification',
          channels: [],
        };
      }

      // Process template if specified
      if (notification.templateId) {
        notification = await this.applyTemplate(notification);
      }

      // Try sending through channels with fallback
      const results: NotificationResult[] = [];
      let successfulChannel: NotificationChannel | null = null;

      for (const channel of channels) {
        const handler = this.channelHandlers.get(channel);
        if (!handler) continue;

        // Check if channel is available
        if (!(await handler.isAvailable())) {
          this.logger.warn(`Channel ${channel} is not available`);
          continue;
        }

        try {
          const result = await handler.send(notification);

          results.push(result);

          if (result.success) {
            successfulChannel = channel;
            this.metrics.sent++;
            this.metrics.byChannel[channel].sent++;

            // Emit success event
            await this.eventBus.emit('notification.sent', {
              notificationId: notification.id,
              userId: notification.userId,
              channel,
              type: notification.type,
            });

            // Cache for deduplication
            if (this.cache) {
              await this.cache.set(
                `notification:${this.getNotificationHash(notification)}`,
                { sentAt: new Date(), channel },
                3600 // 1 hour TTL
              );
            }

            // Save to history
            await this.saveToHistory(notification, channel, 'sent');

            break; // Success, no need for fallback
          }
        } catch (error) {
          this.logger.error(`Failed to send notification via ${channel}`, error);
          this.metrics.byChannel[channel].failed++;

          results.push({
            success: false,
            error: (error as Error).message,
            channels: [channel],
          });
        }
      }

      if (successfulChannel) {
        return {
          success: true,
          channels: [successfulChannel],
          messageId: notification.id,
          deliveredAt: new Date(),
        };
      }

      // All channels failed, add to retry queue if configured
      if (notification.retryOnFailure !== false) {
        await this.addToQueue(notification, channels);

        return {
          success: false,
          error: 'All channels failed, added to retry queue',
          channels,
          queued: true,
        };
      }

      this.metrics.failed++;

      return {
        success: false,
        error: 'All channels failed',
        channels,
      };
    } catch (error) {
      this.logger.error('Failed to send notification', error);

      return {
        success: false,
        error: (error as Error).message,
        channels: [],
      };
    }
  }

  async sendBulk(request: BulkNotificationRequest): Promise<BulkNotificationResult> {
    const results: NotificationResult[] = [];
    const batchSize = request.batchSize || 10;
    const delayBetweenBatches = request.delayMs || 100;

    // Group by priority
    const priorityGroups = new Map<NotificationPriority, Notification[]>();
    for (const notification of request.notifications) {
      const priority = notification.priority || 'normal';
      if (!priorityGroups.has(priority)) {
        priorityGroups.set(priority, []);
      }
      priorityGroups.get(priority)?.push(notification);
    }

    // Process in priority order
    const priorities: NotificationPriority[] = ['urgent', 'high', 'normal', 'low'];

    for (const priority of priorities) {
      const notifications = priorityGroups.get(priority) || [];

      for (let i = 0; i < notifications.length; i += batchSize) {
        const batch = notifications.slice(i, i + batchSize);

        // Send batch in parallel
        const batchResults = await Promise.allSettled(
          batch.map((notification) => this.send(notification))
        );

        // Collect results
        for (const result of batchResults) {
          if (result.status === 'fulfilled') {
            results.push(result.value);
          } else {
            results.push({
              success: false,
              error: result.reason?.message || 'Unknown error',
              channels: [],
            });
          }
        }

        // Delay between batches
        if (i + batchSize < notifications.length) {
          await new Promise((resolve) => setTimeout(resolve, delayBetweenBatches));
        }
      }
    }

    // Calculate summary
    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;
    const queued = results.filter((r) => r.queued).length;

    return {
      totalSent: successful,
      totalFailed: failed,
      totalQueued: queued,
      results,
      duration: Date.now() - Date.now(), // Would track actual duration
    };
  }

  async getUserPreferences(userId: string): Promise<NotificationPreferences> {
    // Check cache first
    if (this.cache) {
      const cached = await this.cache.get<NotificationPreferences>(
        `notification:preferences:${userId}`
      );
      if (cached) return cached;
    }

    // Get from memory store
    const preferences: NotificationPreferences = this.userPreferences.get(userId) ?? {
      userId,
      enabled: true,
      channels: ['email', 'push', 'inApp'],
      quiet: {
        enabled: false,
        start: '22:00',
        end: '08:00',
        timezone: 'UTC',
      },
      types: {},
    };

    // Cache preferences
    if (this.cache) {
      await this.cache.set(
        `notification:preferences:${userId}`,
        preferences,
        86400 // 24 hours
      );
    }

    return preferences;
  }

  async updateUserPreferences(
    userId: string,
    preferences: Partial<NotificationPreferences>
  ): Promise<void> {
    const current = await this.getUserPreferences(userId);
    const updated = { ...current, ...preferences, userId };

    // Save to memory store
    this.userPreferences.set(userId, updated);

    // Update cache
    if (this.cache) {
      await this.cache.set(
        `notification:preferences:${userId}`,
        updated,
        86400 // 24 hours
      );
    }

    // Emit event
    await this.eventBus.emit('notification.preferencesUpdated', {
      userId,
      preferences: updated,
    });

    this.logger.info(`Notification preferences updated for user: ${userId}`);
  }

  async getDeliveryStatus(notificationId: string): Promise<NotificationDeliveryStatus | null> {
    // Check cache first
    if (this.cache) {
      const cached = await this.cache.get<NotificationDeliveryStatus>(
        `notification:status:${notificationId}`
      );
      if (cached) return cached;
    }

    // In production, this would query the channel provider's API
    return {
      notificationId,
      status: 'delivered',
      deliveredAt: new Date(),
      channel: 'email' as InternalChannel,
      events: [],
    };
  }

  async getHistory(userId: string, limit: number = 50): Promise<NotificationHistory[]> {
    // In production, this would query a database
    // For now, return from cache if available
    if (this.cache) {
      const history = await this.cache.get<NotificationHistory[]>(`notification:history:${userId}`);
      return history?.slice(0, limit) || [];
    }

    return [];
  }

  async markAsRead(notificationId: string): Promise<void> {
    // Update metrics
    this.metrics.opened++;

    // Emit event
    await this.eventBus.emit('notification.read', {
      notificationId,
      readAt: new Date(),
    });

    // Update in cache
    if (this.cache) {
      await this.cache.set(`notification:read:${notificationId}`, { readAt: new Date() }, 86400);
    }
  }

  async registerTemplate(template: NotificationTemplate): Promise<void> {
    this.templates.set(template.id, template);
    this.logger.info(`Notification template registered: ${template.id}`);
  }

  async getMetrics(): Promise<NotificationMetrics> {
    let pending = 0;
    if (this.queueService) {
      const queue = (this.queueService as any).getQueue(NOTIFICATION_QUEUE);
      if (queue) {
        pending = (await queue.getWaitingCount()) + (await queue.getActiveCount());
      }
    }

    return {
      ...this.metrics,
      pending,
    };
  }

  async retryFailed(): Promise<void> {
    if (this.queueService) {
      const queue = (this.queueService as any).getQueue(NOTIFICATION_QUEUE);
      if (queue) {
        const failed = await queue.getFailed();
        for (const job of failed) {
          await job.retry();
        }
        this.logger.info(`Retried ${failed.length} failed notification jobs`);
      }
    }
  }

  async clearQueue(): Promise<void> {
    if (this.queueService) {
      const queue = (this.queueService as any).getQueue(NOTIFICATION_QUEUE);
      if (queue) {
        await queue.obliterate({ force: true });
        this.logger.info('Notification queue cleared');
      }
    }
  }

  async dispose(): Promise<void> {
    // QueueService.closeAll() handles worker/queue cleanup
    this.logger.info('NotificationService disposed');
  }

  // Private helper methods

  private initializeChannelHandlers(): void {
    // Email channel handler
    if (this.emailService) {
      const emailSvc = this.emailService;
      this.channelHandlers.set('email', {
        send: async (notification) => {
          const result = await emailSvc.sendEmail({
            to: notification.email || '',
            subject: notification.title,
            body: notification.body,
            html: notification.data?.html as string | undefined,
          });

          return {
            success: result.success,
            error: result.error,
            channels: ['email'],
            messageId: result.messageId,
          };
        },
        isAvailable: async () => true,
        getPriority: () => 1,
      });
    }

    // Push notification handler
    this.channelHandlers.set('push', {
      send: async (notification) => {
        // In production, would use web-push or FCM
        return {
          success: true,
          channels: ['push'],
          messageId: notification.id,
        };
      },
      isAvailable: async () => true,
      getPriority: () => 2,
    });

    // In-app notification handler
    this.channelHandlers.set('inApp', {
      send: async (notification) => {
        // Store in database/cache for retrieval by frontend
        if (this.cache) {
          await this.cache.set(
            `notification:inapp:${notification.userId}:${notification.id}`,
            notification,
            604800 // 7 days
          );
        }

        return {
          success: true,
          channels: ['inApp'],
          messageId: notification.id,
        };
      },
      isAvailable: async () => true,
      getPriority: () => 3,
    });

    // SMS handler (stub)
    this.channelHandlers.set('sms', {
      send: async (_notification) => {
        // Would integrate with Twilio or similar
        return {
          success: false,
          error: 'SMS not configured',
          channels: ['sms'],
        };
      },
      isAvailable: async () => false,
      getPriority: () => 4,
    });
  }

  private validateNotification(notification: Notification): void {
    if (!notification.userId) {
      throw new Error('User ID is required');
    }

    if (!notification.title && !notification.templateId) {
      throw new Error('Title or template is required');
    }

    if (!notification.body && !notification.templateId) {
      throw new Error('Body or template is required');
    }
  }

  private determineChannels(
    notification: Notification,
    preferences: NotificationPreferences
  ): NotificationChannel[] {
    // Use specified channels or user preferences
    let channels: InternalChannel[] = notification.channels || preferences.channels || ['email'];

    // Check quiet hours
    if (preferences.quiet?.enabled && this.isQuietHours(preferences.quiet)) {
      // Filter out noisy channels during quiet hours
      channels = channels.filter((c: InternalChannel) => c === 'email' || c === 'inApp');
    }

    // Sort by priority
    return channels.sort((a: InternalChannel, b: InternalChannel) => {
      const handlerA = this.channelHandlers.get(a);
      const handlerB = this.channelHandlers.get(b);
      return (handlerA?.getPriority() || 999) - (handlerB?.getPriority() || 999);
    });
  }

  private isQuietHours(quiet: NotificationPreferences['quiet']): boolean {
    if (!quiet?.enabled) return false;

    const now = new Date();
    const start = this.parseTime(quiet.start ?? '22:00');
    const end = this.parseTime(quiet.end ?? '08:00');

    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    if (start < end) {
      return currentMinutes >= start && currentMinutes < end;
    } else {
      // Spans midnight
      return currentMinutes >= start || currentMinutes < end;
    }
  }

  private parseTime(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  private async isDuplicate(notification: Notification): Promise<boolean> {
    if (!this.cache) return false;

    const hash = this.getNotificationHash(notification);
    const exists = await this.cache.get(`notification:${hash}`);

    return !!exists;
  }

  private getNotificationHash(notification: Notification): string {
    const data = JSON.stringify({
      userId: notification.userId,
      title: notification.title,
      body: notification.body,
      type: notification.type,
    });

    return createHash('md5').update(data).digest('hex');
  }

  private async applyTemplate(notification: Notification): Promise<Notification> {
    if (!notification.templateId) return notification;

    const template = this.templates.get(notification.templateId);
    if (!template) {
      throw new Error(`Template not found: ${notification.templateId}`);
    }

    // Merge template with notification
    return {
      ...notification,
      title: this.renderTemplate(template.title, notification.data || {}),
      body: this.renderTemplate(template.body, notification.data || {}),
      channels: notification.channels || template.channels,
      priority: notification.priority || template.priority,
    };
  }

  private renderTemplate(template: string, data: Record<string, unknown>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return String(data[key] ?? match);
    });
  }

  private async saveToHistory(
    notification: Notification,
    channel: NotificationChannel,
    status: 'sent' | 'failed'
  ): Promise<void> {
    const history: NotificationHistory = {
      id: notification.id ?? '',
      userId: notification.userId,
      title: notification.title,
      body: notification.body,
      channel,
      status,
      sentAt: new Date(),
      type: notification.type,
    };

    if (this.cache) {
      const key = `notification:history:${notification.userId}`;
      const existing = (await this.cache.get<NotificationHistory[]>(key)) || [];
      existing.unshift(history);

      // Keep last 100 items
      if (existing.length > 100) {
        existing.length = 100;
      }

      await this.cache.set(key, existing, 604800); // 7 days
    }
  }

  private async addToQueue(
    notification: Notification,
    channels: NotificationChannel[]
  ): Promise<void> {
    if (!this.queueService) {
      // ERROR level: this is data loss, not a transient warning.
      // Callers expecting retry behaviour will silently lose the notification.
      this.logger.error(
        '[NotificationService] QueueService unavailable — notification retry DROPPED (data loss)',
        {
          notificationId: notification.id,
          userId: notification.userId,
          channels,
        }
      );

      // Emit a countable event so monitoring dashboards/alerting can track drops.
      await this.eventBus.emit('notification.queueUnavailable', {
        notificationId: notification.id,
        userId: notification.userId,
        channels,
        droppedAt: new Date(),
      });

      return;
    }

    const jobId = notification.id || this.getNotificationHash(notification);

    // Map notification priority to BullMQ priority (lower = higher priority)
    const priorityMap: Record<string, number> = {
      urgent: 1,
      high: 2,
      normal: 3,
      low: 4,
    };

    await this.queueService.addJob(
      NOTIFICATION_QUEUE,
      'send-notification',
      {
        notification,
        channels,
      },
      {
        jobId,
        priority: priorityMap[notification.priority || 'normal'] ?? 3,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000, // 2s, 4s, 8s
        },
      }
    );

    this.logger.info(`Notification added to BullMQ retry queue: ${jobId}`);
  }

  /**
   * Initialize BullMQ queue and register the notification worker processor.
   */
  private initializeQueue(): void {
    if (!this.queueService) {
      this.logger.warn(
        '[NotificationService] QueueService not provided — BullMQ queue disabled, falling back to direct send only'
      );
      return;
    }

    // Create the notifications queue (BullMQ's built-in removeOnFail retention
    // keeps failed jobs — no separate DLQ queue needed)
    this.queueService.createQueue(NOTIFICATION_QUEUE);

    // Register worker processor with rate limiting to prevent thundering herd.
    //
    // RATE LIMITER BEHAVIOUR (BullMQ Redis-global):
    // BullMQ's Worker `limiter` option is backed by Redis and is therefore
    // GLOBAL across all worker instances sharing the same Redis connection —
    // not per-process. A 50/min limit here means at most 50 jobs/min total,
    // regardless of how many replicas are running. This is correct behaviour
    // for thundering-herd protection.
    //
    // SENDБULK() INTERACTION:
    // `sendBulk()` calls `this.send()` for each notification, which tries
    // direct delivery first and only calls `addToQueue()` if ALL channels fail.
    // Bulk notifications that succeed on direct delivery never enter the queue,
    // so the BullMQ rate limiter only throttles retries. The in-method batching
    // in sendBulk() (batchSize: 10, delayMs: 100) is therefore NOT redundant —
    // it throttles direct delivery concurrency, while the BullMQ limiter throttles
    // queue-based retries. Both limits can apply simultaneously to a single bulk
    // send if the direct delivery fails, which is intentional conservative backpressure.
    //
    // CONCURRENCY NOTE:
    // concurrency: 5 means 5 jobs processed in parallel per worker instance.
    // Each job calls this.send() which loops channels sequentially, so at most
    // 5 concurrent SMTP/push connections per worker. This is safe for typical
    // email providers (most allow 10+ concurrent connections).
    this.queueService.registerProcessor<{
      notification: Notification;
      channels: NotificationChannel[];
    }>({
      name: 'notification-processor',
      queueName: NOTIFICATION_QUEUE,
      concurrency: 5,
      limiter: {
        max: NOTIFICATION_RATE_LIMIT_MAX, // Configurable via NOTIFICATION_RATE_LIMIT_MAX env var (default: 50)
        duration: NOTIFICATION_RATE_LIMIT_DURATION, // Configurable via NOTIFICATION_RATE_LIMIT_DURATION env var (default: 60000ms)
      },
      process: async (
        job: JobContext<{ notification: Notification; channels: NotificationChannel[] }>
      ) => {
        const { notification, channels } = job.data;
        this.logger.info(`[NotificationService] Processing queued notification job ${job.id}`);

        const result = await this.send({
          ...notification,
          channels,
          retryOnFailure: false, // Prevent re-queuing from within the worker
        });

        if (!result.success) {
          throw new Error(result.error || 'All channels failed');
        }
      },
      onCompleted: async (job) => {
        this.logger.info(`[NotificationService] Notification job ${job.id} completed`);
      },
      onFailed: async (job, error) => {
        this.logger.error(`[NotificationService] Notification job ${job.id} failed permanently`, {
          error: error.message,
          retries: job.attemptsMade,
          notificationId: job.data.notification.id,
          userId: job.data.notification.userId,
        });

        // Failed jobs are retained by BullMQ's built-in removeOnFail: { count: 5000 }
        // (set in QueueService defaults) and inspectable via Bull Board — no manual DLQ needed.
        // The job data is NOT lost even if the event emission below fails.
        try {
          await this.eventBus.emit('notification.permanentFailure', {
            notification: job.data.notification,
            error: error.message,
            retries: job.attemptsMade,
          });
        } catch (emitError) {
          // Log at ERROR so this secondary failure is observable. The job data
          // is still retained in BullMQ's failed set — this is not additional data loss.
          this.logger.error(
            '[NotificationService] Failed to emit notification.permanentFailure event',
            {
              jobId: job.id,
              emitError: (emitError as Error).message,
            }
          );
        }
      },
    });

    this.logger.info('[NotificationService] BullMQ queue and worker initialized');
  }
}
