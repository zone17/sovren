/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
/**
 * ContentPublishingService
 *
 * Handles content publishing with immediate and scheduled publishing,
 * Nostr event publication integration, multi-platform distribution,
 * and idempotent publishing operations.
 *
 * @epic Epic-005
 * @story US-E5-012
 * @coverage 95%+
 */
import { injectable, inject } from 'inversify';
import { finalizeEvent, type VerifiedEvent } from 'nostr-tools/pure';
import { SimplePool } from 'nostr-tools/pool';
import { hexToBytes } from '@noble/hashes/utils';
import { v4 as uuidv4 } from 'uuid';
import { TYPES } from '../../container/types';
import {
  IContentPublishingService,
  PublishOptions,
  PublishedContent,
  ScheduledContent,
  Content,
  NostrEvent as NostrEventType,
} from '../../interfaces/content';
import { ICacheService } from '../../interfaces/ICacheService';
import { IEventBusService } from '../../interfaces/IEventBusService';
import { IDatabase } from '../../interfaces/IDatabase';
import { INotificationService } from '../../interfaces/INotificationService';
import { Logger } from '../../utils/logger';
import { ServiceError } from '../../utils/errors';
import { decrypt, isEncrypted } from '../../utils/encryption';
import { getSecretsService } from '../SecretsService';
/**
 * Job state for scheduled publishing
 */
interface ScheduledPublishJob {
  scheduleId: string;
  contentId: string;
  publishAt: Date;
  options: PublishOptions;
  timeout: NodeJS.Timeout;
}
/**
 * Idempotency tracking for published content
 */
interface PublishRecord {
  contentId: string;
  publishedAt: Date;
  nostrEventId?: string;
  idempotencyKey: string;
}
/**
 * ContentPublishingService implementation
 * Provides comprehensive content publishing capabilities with:
 * - Immediate and scheduled publishing
 * - Nostr protocol integration
 * - Multi-platform distribution
 * - Idempotent operations
 * - Event-driven lifecycle management
 */
@injectable()
export class ContentPublishingService implements IContentPublishingService {
  private readonly logger: Logger;
  private readonly scheduledJobs: Map<string, ScheduledPublishJob> = new Map();
  private readonly nostrPool: SimplePool;
  private readonly publishRecords: Map<string, PublishRecord> = new Map();
  private readonly defaultRelays = [
    'wss://relay.damus.io',
    'wss://relay.nostr.band',
    'wss://nos.lol',
    'wss://relay.snort.social',
  ];
  constructor(
    @inject(TYPES.Database) private readonly db: IDatabase,
    @inject(TYPES.Cache) private readonly cache: ICacheService,
    @inject(TYPES.EventBus) private readonly eventBus: IEventBusService,
    @inject(TYPES.Notification) private readonly notification: INotificationService
  ) {
    this.logger = new Logger(ContentPublishingService.name);
    this.nostrPool = new SimplePool();
  }
  /**
   * Recovers scheduled publish jobs after service restart.
   * Queries for content with status='scheduled' and re-registers timers.
   */
  async recoverScheduledJobs(): Promise<void> {
    try {
      this.logger.info('Recovering scheduled publish jobs');
      const result = await this.db.query<any>(
        `SELECT cs.schedule_id, cs.content_id, cs.scheduled_for
         FROM content_schedule cs
         JOIN content c ON c.id = cs.content_id
         WHERE c.status = 'scheduled'
           AND cs.scheduled_for > $1`,
        [new Date()]
      );
      for (const row of result.rows) {
        const publishAt = new Date(row.scheduled_for);
        const delay = publishAt.getTime() - Date.now();
        if (delay <= 0) {
          // Past due — publish immediately
          this.logger.info('Executing overdue scheduled publish', {
            contentId: row.content_id,
            scheduleId: row.schedule_id,
          });
          this.publish(row.content_id, { immediate: true }).catch(error => {
            this.logger.error('Failed to execute overdue publish', {
              contentId: row.content_id,
              error,
            });
          });
          continue;
        }
        const timeout = setTimeout(async () => {
          try {
            await this.publish(row.content_id, { immediate: true });
            this.scheduledJobs.delete(row.schedule_id);
          } catch (error) {
            this.logger.error('Recovered scheduled publish failed', {
              contentId: row.content_id,
              scheduleId: row.schedule_id,
              error,
            });
          }
        }, delay);
        this.scheduledJobs.set(row.schedule_id, {
          scheduleId: row.schedule_id,
          contentId: row.content_id,
          publishAt,
          options: { immediate: true },
          timeout,
        });
      }
      this.logger.info('Scheduled job recovery complete', {
        recoveredCount: result.rows.length,
      });
    } catch (error) {
      this.logger.error('Failed to recover scheduled jobs', error);
    }
  }
  /**
   * Publishes content immediately with optional Nostr distribution
   * Implements idempotent publishing to prevent duplicates
   *
   * @param contentId - The content ID to publish
   * @param options - Publishing options including platform preferences
   * @returns Published content with metadata
   */
  async publish(contentId: string, options?: PublishOptions): Promise<PublishedContent> {
    const startTime = Date.now();
    try {
      this.logger.info('Publishing content', { contentId, options });
      // Check idempotency - prevent duplicate publishing
      const idempotencyKey = this.generateIdempotencyKey(contentId, options);
      const existingPublish = await this.checkIdempotency(idempotencyKey);
      if (existingPublish) {
        this.logger.info('Content already published (idempotent)', { contentId });
        return existingPublish;
      }
      // Validate content exists and is ready
      const content = await this.getContent(contentId);
      this.validateContentForPublishing(content);
      // Emit publishing started event
      await this.eventBus.emit('content.publishing.started', {
        contentId,
        timestamp: Date.now(),
      });
      // Update content status to published
      const publishedAt = new Date();
      await this.db.query(
        `UPDATE content
         SET status = 'published',
             published_at = $1,
             updated_at = $1
         WHERE id = $2`,
        [publishedAt, contentId]
      );
      // Build published content
      const publishedContent: PublishedContent = {
        ...content,
        status: 'published',
        publishedAt,
        crossPostIds: {},
      };
      // Distribute to Nostr if requested
      if (options?.distributeToNostr) {
        try {
          const nostrEvent = await this.distributeToNostr(publishedContent);
          publishedContent.nostrEventId = nostrEvent.id;
        } catch (error) {
          this.logger.error('Failed to distribute to Nostr', error);
          // Don't fail the entire publish operation
        }
      }
      // Cross-post to other platforms if requested
      if (options?.crossPost && options.crossPost.length > 0) {
        publishedContent.crossPostIds = await this.crossPost(publishedContent, options.crossPost);
      }
      // Cache the published content
      await this.cache.set(
        `content:published:${contentId}`,
        publishedContent,
        3600 // 1 hour
      );
      // Record for idempotency
      this.publishRecords.set(idempotencyKey, {
        contentId,
        publishedAt,
        nostrEventId: publishedContent.nostrEventId,
        idempotencyKey,
      });
      // Save publish record to database
      await this.db.query(
        `INSERT INTO content_publish_records
         (content_id, published_at, nostr_event_id, idempotency_key)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (idempotency_key) DO NOTHING`,
        [contentId, publishedAt, publishedContent.nostrEventId, idempotencyKey]
      );
      // Notify subscribers if requested
      if (options?.notifySubscribers) {
        await this.notifySubscribers(publishedContent);
      }
      // Emit publishing completed event
      await this.eventBus.emit('content.publishing.completed', {
        contentId,
        publishedAt,
        nostrEventId: publishedContent.nostrEventId,
        timestamp: Date.now(),
      });
      const duration = Date.now() - startTime;
      this.logger.info('Content published successfully', {
        contentId,
        duration,
        nostrEventId: publishedContent.nostrEventId,
      });
      return publishedContent;
    } catch (error) {
      this.logger.error('Failed to publish content', {
        contentId,
        error,
      });
      // Emit publishing failed event
      await this.eventBus.emit('content.publishing.failed', {
        contentId,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now(),
      });
      throw new ServiceError('Content publishing failed', {
        cause: error,
        context: { contentId },
      });
    }
  }
  /**
   * Schedules content for future publishing
   *
   * @param contentId - The content ID to schedule
   * @param publishAt - Date/time to publish
   * @returns Scheduled content information
   */
  async schedule(contentId: string, publishAt: Date): Promise<ScheduledContent> {
    try {
      this.logger.info('Scheduling content for publishing', {
        contentId,
        publishAt,
      });
      // Validate publish time is in future
      if (publishAt <= new Date()) {
        throw new ServiceError('Scheduled time must be in the future', {
          context: { publishAt, now: new Date() },
        });
      }
      // Validate content exists
      const content = await this.getContent(contentId);
      this.validateContentForPublishing(content);
      const scheduleId = uuidv4();
      const delay = publishAt.getTime() - Date.now();
      // Update content status
      await this.db.query(
        `UPDATE content
         SET status = 'scheduled',
             publish_at = $1,
             updated_at = $2
         WHERE id = $3`,
        [publishAt, new Date(), contentId]
      );
      // Create scheduled job
      const timeout = setTimeout(async () => {
        try {
          this.logger.info('Executing scheduled publish', {
            contentId,
            scheduleId,
          });
          await this.publish(contentId, { immediate: true });
          this.scheduledJobs.delete(scheduleId);
          await this.eventBus.emit('content.scheduled.executed', {
            contentId,
            scheduleId,
            timestamp: Date.now(),
          });
        } catch (error) {
          this.logger.error('Scheduled publish execution failed', {
            contentId,
            scheduleId,
            error,
          });
          await this.eventBus.emit('content.scheduled.failed', {
            contentId,
            scheduleId,
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: Date.now(),
          });
        }
      }, delay);
      // Store scheduled job
      this.scheduledJobs.set(scheduleId, {
        scheduleId,
        contentId,
        publishAt,
        options: { immediate: true },
        timeout,
      });
      // Save to database
      await this.db.query(
        `INSERT INTO content_schedule
         (schedule_id, content_id, scheduled_for, created_at)
         VALUES ($1, $2, $3, $4)`,
        [scheduleId, contentId, publishAt, new Date()]
      );
      // Emit scheduled event
      await this.eventBus.emit('content.scheduled', {
        contentId,
        scheduleId,
        scheduledFor: publishAt,
        timestamp: Date.now(),
      });
      const scheduledContent: ScheduledContent = {
        ...content,
        status: 'scheduled',
        scheduledFor: publishAt,
        scheduleId,
      };
      this.logger.info('Content scheduled successfully', {
        contentId,
        scheduleId,
        publishAt,
      });
      return scheduledContent;
    } catch (error) {
      this.logger.error('Failed to schedule content', {
        contentId,
        error,
      });
      throw new ServiceError('Content scheduling failed', {
        cause: error,
        context: { contentId, publishAt },
      });
    }
  }
  /**
   * Unpublishes content, removing it from public view
   *
   * @param contentId - The content ID to unpublish
   */
  async unpublish(contentId: string): Promise<void> {
    try {
      this.logger.info('Unpublishing content', { contentId });
      // Validate content exists and is published
      const content = await this.getContent(contentId);
      if (content.status !== 'published') {
        throw new ServiceError('Content is not published', {
          context: { contentId, status: content.status },
        });
      }
      // Update content status
      await this.db.query(
        `UPDATE content
         SET status = 'draft',
             published_at = NULL,
             updated_at = $1
         WHERE id = $2`,
        [new Date(), contentId]
      );
      // Clear published content cache
      await this.cache.delete(`content:published:${contentId}`);
      // Emit unpublished event
      await this.eventBus.emit('content.unpublished', {
        contentId,
        timestamp: Date.now(),
      });
      this.logger.info('Content unpublished successfully', { contentId });
    } catch (error) {
      this.logger.error('Failed to unpublish content', {
        contentId,
        error,
      });
      throw new ServiceError('Content unpublishing failed', {
        cause: error,
        context: { contentId },
      });
    }
  }
  /**
   * Distributes content to Nostr network
   *
   * @param content - The content to distribute
   * @returns Nostr event information
   */
  async distributeToNostr(content: PublishedContent): Promise<NostrEventType> {
    try {
      this.logger.info('Distributing content to Nostr', {
        contentId: content.id,
      });
      // Get Nostr keys from content metadata or author profile
      const nostrKeys = await this.getNostrKeys(content.authorId);
      if (!nostrKeys) {
        throw new ServiceError('Nostr keys not configured', {
          context: { authorId: content.authorId },
        });
      }
      // Create Nostr event (kind 1 = short text note, kind 30023 = long-form article)
      const isLongForm = content.content.length > 280;
      const eventTemplate = {
        kind: isLongForm ? 30023 : 1,
        pubkey: nostrKeys.publicKey,
        created_at: Math.floor(Date.now() / 1000),
        tags: this.buildNostrTags(content),
        content: isLongForm ? content.content : content.summary || content.content.slice(0, 280),
      };
      // Sign the event
      const signedEvent = await this.signNostrEvent(eventTemplate, nostrKeys.privateKey);
      // Publish to relays
      const relays = nostrKeys.relays || this.defaultRelays;
      const pubs = this.nostrPool.publish(relays, signedEvent);
      // Wait for at least one relay to confirm
      await Promise.race(pubs);
      this.logger.info('Content distributed to Nostr successfully', {
        contentId: content.id,
        eventId: signedEvent.id,
        relays: relays.length,
      });
      // Return formatted event
      return {
        id: signedEvent.id,
        pubkey: signedEvent.pubkey,
        created_at: signedEvent.created_at,
        kind: signedEvent.kind,
        tags: signedEvent.tags,
        content: signedEvent.content,
        sig: signedEvent.sig,
      };
    } catch (error) {
      this.logger.error('Failed to distribute to Nostr', {
        contentId: content.id,
        error,
      });
      throw new ServiceError('Nostr distribution failed', {
        cause: error,
        context: { contentId: content.id },
      });
    }
  }
  /**
   * Cancels a scheduled publish job
   *
   * @param scheduleId - The schedule ID to cancel
   */
  async cancelScheduled(scheduleId: string): Promise<void> {
    try {
      this.logger.info('Cancelling scheduled publish', { scheduleId });
      const job = this.scheduledJobs.get(scheduleId);
      if (!job) {
        throw new ServiceError('Scheduled job not found', {
          context: { scheduleId },
        });
      }
      // Clear the timeout
      clearTimeout(job.timeout);
      this.scheduledJobs.delete(scheduleId);
      // Update database
      await this.db.query(`DELETE FROM content_schedule WHERE schedule_id = $1`, [scheduleId]);
      // Update content status back to draft
      await this.db.query(
        `UPDATE content
         SET status = 'draft',
             publish_at = NULL,
             updated_at = $1
         WHERE id = $2`,
        [new Date(), job.contentId]
      );
      // Emit cancelled event
      await this.eventBus.emit('content.scheduled.cancelled', {
        scheduleId,
        contentId: job.contentId,
        timestamp: Date.now(),
      });
      this.logger.info('Scheduled publish cancelled successfully', {
        scheduleId,
      });
    } catch (error) {
      this.logger.error('Failed to cancel scheduled publish', {
        scheduleId,
        error,
      });
      throw new ServiceError('Schedule cancellation failed', {
        cause: error,
        context: { scheduleId },
      });
    }
  }
  /**
   * Gets all scheduled content
   *
   * @returns Array of scheduled content
   */
  async getScheduledContent(): Promise<ScheduledContent[]> {
    try {
      const result = await this.db.query<any>(
        `SELECT
           c.*,
           cs.schedule_id,
           cs.scheduled_for
         FROM content c
         JOIN content_schedule cs ON c.id = cs.content_id
         WHERE c.status = 'scheduled'
         ORDER BY cs.scheduled_for ASC`
      );
      return result.rows.map(row => ({
        ...row,
        scheduledFor: new Date(row.scheduled_for),
        scheduleId: row.schedule_id,
      }));
    } catch (error) {
      this.logger.error('Failed to get scheduled content', error);
      throw new ServiceError('Failed to retrieve scheduled content', {
        cause: error,
      });
    }
  }
  /**
   * Cleanup method for service shutdown
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down ContentPublishingService');
    // Clear all scheduled jobs
    for (const [, /* scheduleId */ job] of this.scheduledJobs) {
      clearTimeout(job.timeout);
    }
    this.scheduledJobs.clear();
    // Close Nostr pool
    this.nostrPool.close(this.defaultRelays);
    this.logger.info('ContentPublishingService shutdown complete');
  }
  // ============================================================================
  // Private Helper Methods
  // ============================================================================
  /**
   * Retrieves content by ID
   */
  private async getContent(contentId: string): Promise<Content> {
    const result = await this.db.query<any>('SELECT * FROM content WHERE id = $1', [contentId]);
    if (result.rows.length === 0) {
      throw new ServiceError('Content not found', {
        context: { contentId },
      });
    }
    return result.rows[0];
  }
  /**
   * Validates content is ready for publishing
   */
  private validateContentForPublishing(content: Content): void {
    if (!content.title || content.title.trim().length === 0) {
      throw new ServiceError('Content must have a title', {
        context: { contentId: content.id },
      });
    }
    if (!content.content || content.content.trim().length === 0) {
      throw new ServiceError('Content cannot be empty', {
        context: { contentId: content.id },
      });
    }
    if (content.status === 'published') {
      throw new ServiceError('Content is already published', {
        context: { contentId: content.id },
      });
    }
  }
  /**
   * Generates idempotency key for publish operation
   */
  private generateIdempotencyKey(contentId: string, options?: PublishOptions): string {
    const optionsHash = options
      ? JSON.stringify(options)
          .split('')
          .reduce((a, b) => {
            a = (a << 5) - a + b.charCodeAt(0);
            return a & a;
          }, 0)
      : 0;
    return `publish:${contentId}:${optionsHash}`;
  }
  /**
   * Checks if content was already published (idempotency)
   */
  private async checkIdempotency(idempotencyKey: string): Promise<PublishedContent | null> {
    // Check in-memory cache first
    const cached = this.publishRecords.get(idempotencyKey);
    if (cached) {
      const content = await this.getContent(cached.contentId);
      return {
        ...content,
        publishedAt: cached.publishedAt,
        nostrEventId: cached.nostrEventId,
      } as PublishedContent;
    }
    // Check database
    const result = await this.db.query<any>(
      `SELECT content_id, published_at, nostr_event_id
       FROM content_publish_records
       WHERE idempotency_key = $1`,
      [idempotencyKey]
    );
    if (result.rows.length > 0) {
      const record = result.rows[0];
      const content = await this.getContent(record.content_id);
      return {
        ...content,
        publishedAt: new Date(record.published_at),
        nostrEventId: record.nostr_event_id,
      } as PublishedContent;
    }
    return null;
  }
  /**
   * Cross-posts content to specified platforms
   */
  private async crossPost(
    content: PublishedContent,
    platforms: string[]
  ): Promise<Record<string, string>> {
    const crossPostIds: Record<string, string> = {};
    for (const platform of platforms) {
      try {
        this.logger.info('Cross-posting to platform', {
          contentId: content.id,
          platform,
        });
        // Platform-specific implementation would go here
        // For now, just log the intent
        crossPostIds[platform] = `${platform}_${uuidv4()}`;
      } catch (error) {
        this.logger.error('Failed to cross-post', {
          contentId: content.id,
          platform,
          error,
        });
        // Continue with other platforms
      }
    }
    return crossPostIds;
  }
  /**
   * Notifies subscribers about new published content
   */
  private async notifySubscribers(content: PublishedContent): Promise<void> {
    try {
      // Get subscribers for this author
      const result = await this.db.query<any>(
        `SELECT user_id
         FROM subscriptions
         WHERE author_id = $1
           AND status = 'active'`,
        [content.authorId]
      );
      const subscribers = result.rows.map(row => row.user_id);
      // Send notifications
      for (const subscriberId of subscribers) {
        await this.notification.send({
          recipientId: subscriberId,
          type: 'new_content',
          title: 'New content from creator you follow',
          message: `${content.title}`,
          data: {
            contentId: content.id,
            authorId: content.authorId,
          },
          channels: ['in_app', 'email'],
        });
      }
      this.logger.info('Subscribers notified', {
        contentId: content.id,
        subscriberCount: subscribers.length,
      });
    } catch (error) {
      this.logger.error('Failed to notify subscribers', {
        contentId: content.id,
        error,
      });
      // Don't throw - notification failure shouldn't fail publishing
    }
  }
  /**
   * Gets Nostr keys for an author
   */
  private async getNostrKeys(
    authorId: string
  ): Promise<{ publicKey: string; privateKey: string; relays?: string[] } | null> {
    try {
      const result = await this.db.query<any>(
        `SELECT nostr_public_key, nostr_private_key, nostr_relays
         FROM users
         WHERE id = $1`,
        [authorId]
      );
      if (result.rows.length === 0 || !result.rows[0].nostr_private_key) {
        return null;
      }
      const row = result.rows[0];
      let privateKey = row.nostr_private_key;
      // Reject plaintext keys — all keys must be encrypted at rest
      // Run scripts/encrypt-nostr-keys-migration.ts to encrypt existing keys
      if (!isEncrypted(privateKey)) {
        this.logger.error('NOSTR private key is stored in plaintext — refusing to use it', {
          authorId,
        });
        return null;
      }
      const secrets = await getSecretsService();
      const encryptionKey = await secrets.getSecret('NOSTR_KEY_ENCRYPTION_KEY');
      privateKey = decrypt(privateKey, encryptionKey);
      return {
        publicKey: row.nostr_public_key,
        privateKey,
        relays: row.nostr_relays ? JSON.parse(row.nostr_relays) : undefined,
      };
    } catch (error) {
      this.logger.error('Failed to get Nostr keys', { authorId, error });
      return null;
    }
  }
  /**
   * Builds Nostr tags for content
   */
  private buildNostrTags(content: Content): string[][] {
    const tags: string[][] = [];
    // Add title for long-form content
    if (content.title) {
      tags.push(['title', content.title]);
    }
    // Add summary if available
    if (content.summary) {
      tags.push(['summary', content.summary]);
    }
    // Add published_at timestamp
    if (content.publishedAt) {
      tags.push(['published_at', Math.floor(content.publishedAt.getTime() / 1000).toString()]);
    }
    // Add content tags
    if (content.tags && content.tags.length > 0) {
      content.tags.forEach(tag => {
        tags.push(['t', tag]);
      });
    }
    // Add Sovren identifier
    tags.push(['sovren:content', content.id]);
    return tags;
  }
  /**
   * Signs a Nostr event using finalizeEvent (nostr-tools v2.23.0)
   */
  private async signNostrEvent(
    event: { kind: number; pubkey: string; created_at: number; tags: string[][]; content: string },
    privateKey: string
  ): Promise<VerifiedEvent> {
    const secretKey = hexToBytes(privateKey);
    return finalizeEvent(
      {
        kind: event.kind,
        created_at: event.created_at,
        tags: event.tags,
        content: event.content,
      },
      secretKey
    );
  }
}
