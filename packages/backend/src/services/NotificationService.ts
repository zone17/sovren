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
import type {
  Notification,
  NotificationChannel,
  NotificationPreferences,
  NotificationTemplate,
  NotificationDeliveryStatus,
  NotificationPriority,
  NotificationResult,
  NotificationMetrics,
  BulkNotificationRequest,
  BulkNotificationResult,
  NotificationHistory
} from '../types/notification';

import { EventEmitter } from 'events';
import * as webpush from 'web-push';
import { createHash } from 'crypto';

/**
 * Channel handler interface
 */
interface IChannelHandler {
  send(notification: Notification): Promise<NotificationResult>;
  isAvailable(): Promise<boolean>;
  getPriority(): number;
}

/**
 * Notification queue item
 */
interface NotificationQueueItem {
  id: string;
  notification: Notification;
  channels: NotificationChannel[];
  attemptedChannels: NotificationChannel[];
  createdAt: Date;
  priority: NotificationPriority;
  retries: number;
  maxRetries: number;
  error?: string;
}

/**
 * Concrete implementation of NotificationService
 */
export class NotificationService implements INotificationService {
  private readonly eventBus: IEventBus;
  private readonly logger: ILogger;
  private readonly cache?: ICacheService;
  private readonly emailService?: IEmailService;
  private readonly channelHandlers: Map<NotificationChannel, IChannelHandler> = new Map();
  private readonly templates: Map<string, NotificationTemplate> = new Map();
  private readonly queue: NotificationQueueItem[] = [];
  private readonly userPreferences: Map<string, NotificationPreferences> = new Map();
  private readonly metrics: NotificationMetrics;
  private isProcessing = false;
  private processInterval?: NodeJS.Timeout;

  constructor(
    eventBus: IEventBus,
    logger: ILogger,
    cache?: ICacheService,
    emailService?: IEmailService
  ) {
    this.eventBus = eventBus;
    this.logger = logger;
    this.cache = cache;
    this.emailService = emailService;

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
        sms: { sent: 0, failed: 0 }
      }
    };

    // Initialize channel handlers
    this.initializeChannelHandlers();

    // Start queue processor
    this.startQueueProcessor();
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
          channels: []
        };
      }

      // Check if notification type is enabled
      if (notification.type && preferences.types) {
        const typePreference = preferences.types[notification.type];
        if (typePreference === false) {
          return {
            success: false,
            error: `User has disabled ${notification.type} notifications`,
            channels: []
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
          channels: []
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
              type: notification.type
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
            error: error.message,
            channels: [channel]
          });
        }
      }

      if (successfulChannel) {
        return {
          success: true,
          channels: [successfulChannel],
          messageId: notification.id,
          deliveredAt: new Date()
        };
      }

      // All channels failed, add to retry queue if configured
      if (notification.retryOnFailure !== false) {
        await this.addToQueue(notification, channels);

        return {
          success: false,
          error: 'All channels failed, added to retry queue',
          channels,
          queued: true
        };
      }

      this.metrics.failed++;

      return {
        success: false,
        error: 'All channels failed',
        channels
      };

    } catch (error) {
      this.logger.error('Failed to send notification', error);

      return {
        success: false,
        error: error.message,
        channels: []
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
      priorityGroups.get(priority)!.push(notification);
    }

    // Process in priority order
    const priorities: NotificationPriority[] = ['urgent', 'high', 'normal', 'low'];

    for (const priority of priorities) {
      const notifications = priorityGroups.get(priority) || [];

      for (let i = 0; i < notifications.length; i += batchSize) {
        const batch = notifications.slice(i, i + batchSize);

        // Send batch in parallel
        const batchResults = await Promise.allSettled(
          batch.map(notification => this.send(notification))
        );

        // Collect results
        for (const result of batchResults) {
          if (result.status === 'fulfilled') {
            results.push(result.value);
          } else {
            results.push({
              success: false,
              error: result.reason?.message || 'Unknown error',
              channels: []
            });
          }
        }

        // Delay between batches
        if (i + batchSize < notifications.length) {
          await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
        }
      }
    }

    // Calculate summary
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const queued = results.filter(r => r.queued).length;

    return {
      totalSent: successful,
      totalFailed: failed,
      totalQueued: queued,
      results,
      duration: Date.now() - Date.now() // Would track actual duration
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
    let preferences = this.userPreferences.get(userId);

    if (!preferences) {
      // Return default preferences
      preferences = {
        userId,
        enabled: true,
        channels: ['email', 'push', 'inApp'],
        quiet: {
          enabled: false,
          start: '22:00',
          end: '08:00',
          timezone: 'UTC'
        },
        types: {}
      };
    }

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
      preferences: updated
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
      channel: 'email',
      events: []
    };
  }

  async getHistory(
    userId: string,
    limit: number = 50
  ): Promise<NotificationHistory[]> {
    // In production, this would query a database
    // For now, return from cache if available
    if (this.cache) {
      const history = await this.cache.get<NotificationHistory[]>(
        `notification:history:${userId}`
      );
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
      readAt: new Date()
    });

    // Update in cache
    if (this.cache) {
      await this.cache.set(
        `notification:read:${notificationId}`,
        { readAt: new Date() },
        86400
      );
    }
  }

  async registerTemplate(template: NotificationTemplate): Promise<void> {
    this.templates.set(template.id, template);
    this.logger.info(`Notification template registered: ${template.id}`);
  }

  async getMetrics(): Promise<NotificationMetrics> {
    return {
      ...this.metrics,
      pending: this.queue.length
    };
  }

  async retryFailed(): Promise<void> {
    const failedItems = this.queue.filter(item => item.retries > 0);

    for (const item of failedItems) {
      item.retries = 0;
      item.attemptedChannels = [];
    }

    // Process immediately
    await this.processQueue();
  }

  async clearQueue(): Promise<void> {
    const queueSize = this.queue.length;
    this.queue.length = 0;

    this.logger.info(`Notification queue cleared: ${queueSize} items removed`);
  }

  async dispose(): Promise<void> {
    // Stop queue processor
    if (this.processInterval) {
      clearInterval(this.processInterval);
    }

    // Clear queue
    await this.clearQueue();

    this.logger.info('NotificationService disposed');
  }

  // Private helper methods

  private initializeChannelHandlers(): void {
    // Email channel handler
    if (this.emailService) {
      this.channelHandlers.set('email', {
        send: async (notification) => {
          const result = await this.emailService!.send({
            to: notification.email || '',
            subject: notification.title,
            text: notification.body,
            html: notification.data?.html
          });

          return {
            success: result.success,
            error: result.error,
            channels: ['email'],
            messageId: result.messageId
          };
        },
        isAvailable: async () => true,
        getPriority: () => 1
      });
    }

    // Push notification handler
    this.channelHandlers.set('push', {
      send: async (notification) => {
        // In production, would use web-push or FCM
        return {
          success: true,
          channels: ['push'],
          messageId: notification.id
        };
      },
      isAvailable: async () => true,
      getPriority: () => 2
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
          messageId: notification.id
        };
      },
      isAvailable: async () => true,
      getPriority: () => 3
    });

    // SMS handler (stub)
    this.channelHandlers.set('sms', {
      send: async (notification) => {
        // Would integrate with Twilio or similar
        return {
          success: false,
          error: 'SMS not configured',
          channels: ['sms']
        };
      },
      isAvailable: async () => false,
      getPriority: () => 4
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
    let channels = notification.channels || preferences.channels || ['email'];

    // Check quiet hours
    if (preferences.quiet?.enabled && this.isQuietHours(preferences.quiet)) {
      // Filter out noisy channels during quiet hours
      channels = channels.filter(c => c === 'email' || c === 'inApp');
    }

    // Sort by priority
    return channels.sort((a, b) => {
      const handlerA = this.channelHandlers.get(a);
      const handlerB = this.channelHandlers.get(b);
      return (handlerA?.getPriority() || 999) - (handlerB?.getPriority() || 999);
    });
  }

  private isQuietHours(quiet: NotificationPreferences['quiet']): boolean {
    if (!quiet?.enabled) return false;

    const now = new Date();
    const start = this.parseTime(quiet.start!);
    const end = this.parseTime(quiet.end!);

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
      type: notification.type
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
      priority: notification.priority || template.priority
    };
  }

  private renderTemplate(template: string, data: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return data[key] || match;
    });
  }

  private async saveToHistory(
    notification: Notification,
    channel: NotificationChannel,
    status: 'sent' | 'failed'
  ): Promise<void> {
    const history: NotificationHistory = {
      id: notification.id!,
      userId: notification.userId,
      title: notification.title,
      body: notification.body,
      channel,
      status,
      sentAt: new Date(),
      type: notification.type
    };

    if (this.cache) {
      const key = `notification:history:${notification.userId}`;
      const existing = await this.cache.get<NotificationHistory[]>(key) || [];
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
    const item: NotificationQueueItem = {
      id: notification.id || this.getNotificationHash(notification),
      notification,
      channels,
      attemptedChannels: [],
      createdAt: new Date(),
      priority: notification.priority || 'normal',
      retries: 0,
      maxRetries: 3
    };

    this.queue.push(item);

    // Sort queue by priority
    this.queue.sort((a, b) => {
      const priorities: NotificationPriority[] = ['urgent', 'high', 'normal', 'low'];
      return priorities.indexOf(a.priority) - priorities.indexOf(b.priority);
    });

    this.logger.info(`Notification added to retry queue: ${item.id}`);
  }

  private startQueueProcessor(): void {
    this.processInterval = setInterval(() => {
      if (!this.isProcessing) {
        this.processQueue().catch(error => {
          this.logger.error('Queue processing error', error);
        });
      }
    }, 5000); // Process every 5 seconds
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      // Process up to 10 items at once
      const items = this.queue.slice(0, 10);

      for (const item of items) {
        try {
          // Filter out attempted channels
          const remainingChannels = item.channels.filter(
            c => !item.attemptedChannels.includes(c)
          );

          if (remainingChannels.length === 0) {
            // All channels attempted
            item.retries++;

            if (item.retries >= item.maxRetries) {
              // Max retries reached
              const index = this.queue.indexOf(item);
              if (index > -1) {
                this.queue.splice(index, 1);
              }

              await this.eventBus.emit('notification.permanentFailure', {
                notification: item.notification,
                error: item.error,
                retries: item.retries
              });

              continue;
            }

            // Reset for retry
            item.attemptedChannels = [];
          }

          // Try sending
          const result = await this.send({
            ...item.notification,
            channels: remainingChannels
          });

          if (result.success) {
            // Remove from queue
            const index = this.queue.indexOf(item);
            if (index > -1) {
              this.queue.splice(index, 1);
            }
          } else {
            // Mark attempted channels
            item.attemptedChannels.push(...(result.channels || []));
            item.error = result.error;
          }
        } catch (error) {
          item.error = error.message;
          item.retries++;
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }
}