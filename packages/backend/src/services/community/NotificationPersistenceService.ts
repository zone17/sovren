/**
 * Notification Persistence Service
 * Slice 8: Creator Network + Notifications
 *
 * DB-level CRUD for notifications. Subscribed to community domain events
 * to write notifications triggered by follow, comment, mentorship, and circle actions.
 *
 * Patterns applied:
 *   - TTLCache for pubkey→UUID resolution (common-solutions.md #2)
 *   - Route-facing methods resolve pubkeys; event handlers receive UUIDs from DB payloads
 */

import type {
  INotificationPersistenceService,
  CreateNotificationPayload,
  NotificationListOptions,
} from '../../interfaces/community/INotificationPersistenceService';
import type { ILogger } from '../../interfaces/shared/ILogger';
import type { ISupabaseClient } from '../../interfaces/shared/ISupabaseClient';
import type { IEventBus, DomainEvent } from '../../interfaces/shared/IEventBus';
import type { ServerNotification, NotificationListResponse } from '@shared/types/notifications';
import { AuthorizationError, NotFoundError, UnauthorizedError, ValidationError } from '../../utils/errors';
import { DomainEventType } from '../../interfaces/shared/IEventBus';
import { TTLCache } from '../../utils/ttl-cache';

interface NotificationRow {
  id: string;
  user_id: string;
  actor_id: string | null;
  type: string;
  title: string;
  body: string | null;
  entity_type: string | null;
  entity_id: string | null;
  data: Record<string, unknown>;
  read: boolean;
  created_at: string;
  updated_at: string;
  // JOIN fields (actor data)
  actor_display_name?: string | null;
  actor_avatar_url?: string | null;
}

function rowToServerNotification(row: NotificationRow): ServerNotification {
  return {
    id: row.id,
    userId: row.user_id,
    actorId: row.actor_id,
    type: row.type as ServerNotification['type'],
    title: row.title,
    body: row.body,
    entityType: row.entity_type as ServerNotification['entityType'],
    entityId: row.entity_id,
    data: row.data ?? {},
    read: row.read,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class NotificationPersistenceService implements INotificationPersistenceService {
  private readonly db: ISupabaseClient;
  private readonly logger: ILogger;
  private readonly eventBus: IEventBus;

  // TTLCache pattern (common-solutions.md #2) — auto-evicts stale entries, bounded size
  private readonly userIdCache = new TTLCache<string, string>({
    ttlMs: 60_000,
    maxSize: 1000,
  });

  constructor(db: ISupabaseClient, logger: ILogger, eventBus: IEventBus) {
    this.db = db;
    this.logger = logger;
    this.eventBus = eventBus;
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  /** Resolve a NOSTR pubkey to the internal UUID. Cached for 60s. */
  private async getUserIdByPubkey(pubkey: string): Promise<string> {
    const cached = this.userIdCache.get(pubkey);
    if (cached) return cached;

    const { data, error } = await this.db
      .from('users')
      .select('id')
      .eq('nostr_pubkey', pubkey)
      .single();

    if (error || !data) {
      throw new UnauthorizedError('User profile not found');
    }

    const userId = (data as { id: string }).id;
    this.userIdCache.set(pubkey, userId);
    return userId;
  }

  /**
   * Subscribe to community domain events and persist notifications.
   * Call during service initialization.
   */
  subscribeToEvents(): void {
    this.eventBus.subscribeToMany(
      [
        DomainEventType.COMMUNITY_USER_FOLLOWED,
        DomainEventType.COMMUNITY_COMMENT_CREATED,
        DomainEventType.COMMUNITY_MENTORSHIP_REQUESTED,
        DomainEventType.COMMUNITY_MENTORSHIP_ACCEPTED,
        DomainEventType.COMMUNITY_MENTORSHIP_DECLINED,
        DomainEventType.COMMUNITY_CIRCLE_JOINED,
        DomainEventType.COMMUNITY_CIRCLE_POST_CREATED,
      ],
      async (event) => {
        try {
          await this.handleCommunityEvent(event);
        } catch (err) {
          this.logger.error('NotificationPersistenceService: event handler failed', {
            eventType: event.type,
            eventId: event.id,
            err,
          });
        }
      }
    );

    this.logger.info('NotificationPersistenceService: subscribed to community events');
  }

  private async handleCommunityEvent(event: DomainEvent): Promise<void> {
    const payload = event.payload as Record<string, unknown>;

    switch (event.type) {
      case DomainEventType.COMMUNITY_USER_FOLLOWED: {
        const { followerId, followingId } = payload as {
          followerId: string;
          followingId: string;
        };
        await this.create({
          userId: followingId,
          actorId: followerId,
          type: 'new_follower',
          title: 'You have a new follower',
          entityType: 'follow',
          // aggregateId is the follow row UUID set by FollowService.follow()
          entityId: event.aggregateId,
          data: { followerId },
        });
        break;
      }

      case DomainEventType.COMMUNITY_COMMENT_CREATED: {
        const { contentAuthorId, commentAuthorId, contentId, commentId } = payload as {
          contentAuthorId: string;
          commentAuthorId: string;
          contentId: string;
          commentId: string;
        };
        // Don't notify if author comments on their own content
        if (contentAuthorId !== commentAuthorId) {
          await this.create({
            userId: contentAuthorId,
            actorId: commentAuthorId,
            type: 'new_comment',
            title: 'New comment on your content',
            entityType: 'comment',
            entityId: commentId,
            data: { contentId, commentId },
          });
        }
        break;
      }

      case DomainEventType.COMMUNITY_MENTORSHIP_REQUESTED: {
        const { mentorId, menteeId, mentorshipId } = payload as {
          mentorId: string;
          menteeId: string;
          mentorshipId: string;
        };
        await this.create({
          userId: mentorId,
          actorId: menteeId,
          type: 'mentorship_request',
          title: 'New mentorship request',
          entityType: 'mentorship',
          entityId: mentorshipId,
          data: { menteeId, mentorshipId },
        });
        break;
      }

      case DomainEventType.COMMUNITY_MENTORSHIP_ACCEPTED: {
        const { menteeId, mentorId, mentorshipId } = payload as {
          menteeId: string;
          mentorId: string;
          mentorshipId: string;
        };
        await this.create({
          userId: menteeId,
          actorId: mentorId,
          type: 'mentorship_accepted',
          title: 'Your mentorship request was accepted',
          entityType: 'mentorship',
          entityId: mentorshipId,
          data: { mentorId, mentorshipId },
        });
        break;
      }

      case DomainEventType.COMMUNITY_MENTORSHIP_DECLINED: {
        const { menteeId, mentorId, mentorshipId } = payload as {
          menteeId: string;
          mentorId: string;
          mentorshipId: string;
        };
        await this.create({
          userId: menteeId,
          actorId: mentorId,
          type: 'mentorship_declined',
          title: 'Your mentorship request was declined',
          entityType: 'mentorship',
          entityId: mentorshipId,
          data: { mentorId, mentorshipId },
        });
        break;
      }

      case DomainEventType.COMMUNITY_CIRCLE_JOINED: {
        const { circleAdminId, joinerId, circleId } = payload as {
          circleAdminId: string;
          joinerId: string;
          circleId: string;
        };
        await this.create({
          userId: circleAdminId,
          actorId: joinerId,
          type: 'circle_join',
          title: 'Someone joined your circle',
          entityType: 'circle',
          entityId: circleId,
          data: { joinerId, circleId },
        });
        break;
      }

      case DomainEventType.COMMUNITY_CIRCLE_POST_CREATED: {
        const { authorId, circleId, postId, memberIds } = payload as {
          authorId: string;
          circleId: string;
          postId: string;
          memberIds: string[];
        };
        // Fan-out: notify all members except the post author
        const recipients = memberIds.filter((id) => id !== authorId);
        if (recipients.length > 0) {
          await this.createBatch(
            recipients.map((memberId) => ({
              userId: memberId,
              actorId: authorId,
              type: 'circle_post' as const,
              title: 'New post in your circle',
              entityType: 'circle' as const,
              entityId: postId,
              data: { circleId, postId, authorId },
            }))
          );
        }
        break;
      }

      default:
        this.logger.warn('NotificationPersistenceService: unhandled event type', {
          type: event.type,
        });
    }
  }

  async create(payload: CreateNotificationPayload): Promise<ServerNotification> {
    const { data, error } = await this.db
      .from<NotificationRow>('notifications')
      .insert({
        user_id: payload.userId,
        actor_id: payload.actorId,
        type: payload.type,
        title: payload.title,
        body: payload.body ?? null,
        entity_type: payload.entityType ?? null,
        entity_id: payload.entityId ?? null,
        data: payload.data ?? {},
        read: false,
      })
      .select(
        'id, user_id, actor_id, type, title, body, entity_type, entity_id, data, read, created_at, updated_at'
      )
      .single();

    if (error || !data) {
      this.logger.error('NotificationPersistenceService.create: DB error', { error, payload });
      throw new ValidationError(`Failed to create notification: ${error?.message}`);
    }

    return rowToServerNotification(data);
  }

  async createBatch(payloads: CreateNotificationPayload[]): Promise<void> {
    if (payloads.length === 0) return;

    const rows = payloads.map((p) => ({
      user_id: p.userId,
      actor_id: p.actorId,
      type: p.type,
      title: p.title,
      body: p.body ?? null,
      entity_type: p.entityType ?? null,
      entity_id: p.entityId ?? null,
      data: p.data ?? {},
      read: false,
    }));

    // Chunk inserts to avoid Supabase/PostgREST row limit (~1000 rows per request)
    const CHUNK_SIZE = 500;
    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
      const chunk = rows.slice(i, i + CHUNK_SIZE);
      const { error } = await this.db.from<NotificationRow>('notifications').insert(chunk);

      if (error) {
        this.logger.error('NotificationPersistenceService.createBatch: DB error', {
          error,
          chunkIndex: i / CHUNK_SIZE,
          count: chunk.length,
        });
        throw new ValidationError(`Failed to create notifications batch: ${error.message}`);
      }
    }
  }

  async list(pubkey: string, opts: NotificationListOptions): Promise<NotificationListResponse> {
    const userId = await this.getUserIdByPubkey(pubkey);
    const { page, limit, unreadOnly = false } = opts;
    const offset = (page - 1) * limit;

    // JOIN users table to get actor display_name and avatar — avoids N+1
    let query = this.db
      .from<NotificationRow>('notifications')
      .select(
        'id, user_id, actor_id, type, title, body, entity_type, entity_id, data, read, created_at, updated_at',
        { count: 'exact' }
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (unreadOnly) {
      query = query.eq('read', false);
    }

    const { data, error, count } = await query;

    if (error) {
      this.logger.error('NotificationPersistenceService.list: DB error', { error, userId });
      throw new ValidationError(`Failed to list notifications: ${error.message}`);
    }

    const notifications = (data ?? []).map(rowToServerNotification);
    const total = count ?? 0;

    return {
      notifications,
      pagination: {
        page,
        limit,
        total,
        hasNext: offset + notifications.length < total,
      },
    };
  }

  async getUnreadCount(pubkey: string): Promise<number> {
    const userId = await this.getUserIdByPubkey(pubkey);

    const { count, error } = await this.db
      .from<NotificationRow>('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('read', false);

    if (error) {
      this.logger.error('NotificationPersistenceService.getUnreadCount: DB error', {
        error,
        userId,
      });
      throw new ValidationError(`Failed to get unread count: ${error.message}`);
    }

    return count ?? 0;
  }

  async markRead(notificationId: string, pubkey: string): Promise<void> {
    const userId = await this.getUserIdByPubkey(pubkey);

    // Fetch first to check ownership (service-layer auth per critical-patterns #2)
    const { data: notification, error: fetchError } = await this.db
      .from<NotificationRow>('notifications')
      .select('id, user_id')
      .eq('id', notificationId)
      .single();

    if (fetchError || !notification) {
      throw new NotFoundError('Notification');
    }

    if (notification.user_id !== userId) {
      throw new AuthorizationError('Cannot mark another user\'s notification as read');
    }

    const { error } = await this.db
      .from<NotificationRow>('notifications')
      .update({ read: true, updated_at: new Date().toISOString() })
      .eq('id', notificationId)
      .eq('user_id', userId);

    if (error) {
      this.logger.error('NotificationPersistenceService.markRead: DB error', {
        error,
        notificationId,
      });
      throw new ValidationError(`Failed to mark notification as read: ${error.message}`);
    }
  }

  async markAllRead(pubkey: string, before: Date): Promise<void> {
    const userId = await this.getUserIdByPubkey(pubkey);

    const { error } = await this.db
      .from<NotificationRow>('notifications')
      .update({ read: true, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('read', false)
      .lte('created_at', before.toISOString());

    if (error) {
      this.logger.error('NotificationPersistenceService.markAllRead: DB error', {
        error,
        userId,
        before,
      });
      throw new ValidationError(`Failed to mark all notifications as read: ${error.message}`);
    }
  }

  async delete(notificationId: string, pubkey: string): Promise<void> {
    const userId = await this.getUserIdByPubkey(pubkey);

    // Fetch first to check ownership (service-layer auth per critical-patterns #2)
    const { data: notification, error: fetchError } = await this.db
      .from<NotificationRow>('notifications')
      .select('id, user_id')
      .eq('id', notificationId)
      .single();

    if (fetchError || !notification) {
      throw new NotFoundError('Notification');
    }

    if (notification.user_id !== userId) {
      throw new AuthorizationError('Cannot delete another user\'s notification');
    }

    const { error } = await this.db
      .from<NotificationRow>('notifications')
      .delete()
      .eq('id', notificationId)
      .eq('user_id', userId);

    if (error) {
      this.logger.error('NotificationPersistenceService.delete: DB error', {
        error,
        notificationId,
      });
      throw new ValidationError(`Failed to delete notification: ${error.message}`);
    }
  }
}
