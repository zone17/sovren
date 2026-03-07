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
import { AuthorizationError, DatabaseError, NotFoundError } from '../../utils/errors';
import { DomainEventType } from '../../interfaces/shared/IEventBus';
import { getUserIdByPubkey } from '../../utils/getUserIdByPubkey';

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

  constructor(db: ISupabaseClient, logger: ILogger, eventBus: IEventBus) {
    this.db = db;
    this.logger = logger;
    this.eventBus = eventBus;
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

  // #736: Typed payload validators — replace unsafe double-cast with explicit field checks.
  private static extractFollowPayload(
    payload: unknown
  ): { followerId: string; followingId: string } | null {
    if (
      typeof payload === 'object' &&
      payload !== null &&
      typeof (payload as Record<string, unknown>).followerId === 'string' &&
      typeof (payload as Record<string, unknown>).followingId === 'string'
    ) {
      return payload as { followerId: string; followingId: string };
    }
    return null;
  }

  private static extractCommentPayload(payload: unknown): {
    contentAuthorId: string;
    commentAuthorId: string;
    contentId: string;
    commentId: string;
  } | null {
    if (
      typeof payload === 'object' &&
      payload !== null &&
      typeof (payload as Record<string, unknown>).contentAuthorId === 'string' &&
      typeof (payload as Record<string, unknown>).commentAuthorId === 'string' &&
      typeof (payload as Record<string, unknown>).contentId === 'string' &&
      typeof (payload as Record<string, unknown>).commentId === 'string'
    ) {
      return payload as {
        contentAuthorId: string;
        commentAuthorId: string;
        contentId: string;
        commentId: string;
      };
    }
    return null;
  }

  private static extractMentorshipPayload(
    payload: unknown
  ): { mentorId: string; menteeId: string; mentorshipId: string } | null {
    if (
      typeof payload === 'object' &&
      payload !== null &&
      typeof (payload as Record<string, unknown>).mentorId === 'string' &&
      typeof (payload as Record<string, unknown>).menteeId === 'string' &&
      typeof (payload as Record<string, unknown>).mentorshipId === 'string'
    ) {
      return payload as { mentorId: string; menteeId: string; mentorshipId: string };
    }
    return null;
  }

  private static extractCircleJoinPayload(
    payload: unknown
  ): { circleAdminId: string; joinerId: string; circleId: string } | null {
    if (
      typeof payload === 'object' &&
      payload !== null &&
      typeof (payload as Record<string, unknown>).circleAdminId === 'string' &&
      typeof (payload as Record<string, unknown>).joinerId === 'string' &&
      typeof (payload as Record<string, unknown>).circleId === 'string'
    ) {
      return payload as { circleAdminId: string; joinerId: string; circleId: string };
    }
    return null;
  }

  private static extractCirclePostPayload(
    payload: unknown
  ): { authorId: string; circleId: string; postId: string; memberIds: string[] } | null {
    const p = payload as Record<string, unknown>;
    if (
      typeof p === 'object' &&
      p !== null &&
      typeof p.authorId === 'string' &&
      typeof p.circleId === 'string' &&
      typeof p.postId === 'string' &&
      Array.isArray(p.memberIds) &&
      (p.memberIds as unknown[]).every((id) => typeof id === 'string')
    ) {
      return p as { authorId: string; circleId: string; postId: string; memberIds: string[] };
    }
    return null;
  }

  private async handleCommunityEvent(event: DomainEvent): Promise<void> {
    switch (event.type) {
      case DomainEventType.COMMUNITY_USER_FOLLOWED: {
        const p = NotificationPersistenceService.extractFollowPayload(event.payload);
        if (!p) {
          this.logger.warn('handleCommunityEvent: invalid COMMUNITY_USER_FOLLOWED payload', {
            payload: event.payload,
          });
          break;
        }
        await this.create({
          userId: p.followingId,
          actorId: p.followerId,
          type: 'new_follower',
          title: 'You have a new follower',
          entityType: 'follow',
          // aggregateId is the follow row UUID set by FollowService.follow()
          entityId: event.aggregateId,
          data: { followerId: p.followerId },
        });
        break;
      }

      case DomainEventType.COMMUNITY_COMMENT_CREATED: {
        const p = NotificationPersistenceService.extractCommentPayload(event.payload);
        if (!p) {
          this.logger.warn('handleCommunityEvent: invalid COMMUNITY_COMMENT_CREATED payload', {
            payload: event.payload,
          });
          break;
        }
        // Don't notify if author comments on their own content
        if (p.contentAuthorId !== p.commentAuthorId) {
          await this.create({
            userId: p.contentAuthorId,
            actorId: p.commentAuthorId,
            type: 'new_comment',
            title: 'New comment on your content',
            entityType: 'comment',
            entityId: p.commentId,
            data: { contentId: p.contentId, commentId: p.commentId },
          });
        }
        break;
      }

      case DomainEventType.COMMUNITY_MENTORSHIP_REQUESTED: {
        const p = NotificationPersistenceService.extractMentorshipPayload(event.payload);
        if (!p) {
          this.logger.warn('handleCommunityEvent: invalid COMMUNITY_MENTORSHIP_REQUESTED payload', {
            payload: event.payload,
          });
          break;
        }
        await this.create({
          userId: p.mentorId,
          actorId: p.menteeId,
          type: 'mentorship_request',
          title: 'New mentorship request',
          entityType: 'mentorship',
          entityId: p.mentorshipId,
          data: { menteeId: p.menteeId, mentorshipId: p.mentorshipId },
        });
        break;
      }

      case DomainEventType.COMMUNITY_MENTORSHIP_ACCEPTED: {
        const p = NotificationPersistenceService.extractMentorshipPayload(event.payload);
        if (!p) {
          this.logger.warn('handleCommunityEvent: invalid COMMUNITY_MENTORSHIP_ACCEPTED payload', {
            payload: event.payload,
          });
          break;
        }
        await this.create({
          userId: p.menteeId,
          actorId: p.mentorId,
          type: 'mentorship_accepted',
          title: 'Your mentorship request was accepted',
          entityType: 'mentorship',
          entityId: p.mentorshipId,
          data: { mentorId: p.mentorId, mentorshipId: p.mentorshipId },
        });
        break;
      }

      case DomainEventType.COMMUNITY_MENTORSHIP_DECLINED: {
        const p = NotificationPersistenceService.extractMentorshipPayload(event.payload);
        if (!p) {
          this.logger.warn('handleCommunityEvent: invalid COMMUNITY_MENTORSHIP_DECLINED payload', {
            payload: event.payload,
          });
          break;
        }
        await this.create({
          userId: p.menteeId,
          actorId: p.mentorId,
          type: 'mentorship_declined',
          title: 'Your mentorship request was declined',
          entityType: 'mentorship',
          entityId: p.mentorshipId,
          data: { mentorId: p.mentorId, mentorshipId: p.mentorshipId },
        });
        break;
      }

      case DomainEventType.COMMUNITY_CIRCLE_JOINED: {
        const p = NotificationPersistenceService.extractCircleJoinPayload(event.payload);
        if (!p) {
          this.logger.warn('handleCommunityEvent: invalid COMMUNITY_CIRCLE_JOINED payload', {
            payload: event.payload,
          });
          break;
        }
        await this.create({
          userId: p.circleAdminId,
          actorId: p.joinerId,
          type: 'circle_join',
          title: 'Someone joined your circle',
          entityType: 'circle',
          entityId: p.circleId,
          data: { joinerId: p.joinerId, circleId: p.circleId },
        });
        break;
      }

      case DomainEventType.COMMUNITY_CIRCLE_POST_CREATED: {
        const p = NotificationPersistenceService.extractCirclePostPayload(event.payload);
        if (!p) {
          this.logger.warn('handleCommunityEvent: invalid COMMUNITY_CIRCLE_POST_CREATED payload', {
            payload: event.payload,
          });
          break;
        }
        // Fan-out: notify all members except the post author
        const recipients = p.memberIds.filter((id) => id !== p.authorId);
        if (recipients.length > 0) {
          await this.createBatch(
            recipients.map((memberId) => ({
              userId: memberId,
              actorId: p.authorId,
              type: 'circle_post' as const,
              title: 'New post in your circle',
              entityType: 'circle' as const,
              entityId: p.postId,
              data: { circleId: p.circleId, postId: p.postId, authorId: p.authorId },
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
      throw new DatabaseError('Failed to create notification');
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
        throw new DatabaseError('Failed to create notifications batch');
      }
    }
  }

  async list(pubkey: string, opts: NotificationListOptions): Promise<NotificationListResponse> {
    const userId = await getUserIdByPubkey(this.db, pubkey);
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
      throw new DatabaseError('Failed to list notifications');
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
    const userId = await getUserIdByPubkey(this.db, pubkey);

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
      throw new DatabaseError('Failed to get unread count');
    }

    return count ?? 0;
  }

  async markRead(notificationId: string, pubkey: string): Promise<void> {
    const userId = await getUserIdByPubkey(this.db, pubkey);

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
      throw new AuthorizationError("Cannot mark another user's notification as read");
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
      throw new DatabaseError('Failed to mark notification as read');
    }
  }

  async markAllRead(pubkey: string, before: Date): Promise<void> {
    const userId = await getUserIdByPubkey(this.db, pubkey);

    // #745: Limit the UPDATE to at most 1000 rows to prevent unbounded DB lock time.
    const { error } = await this.db
      .from<NotificationRow>('notifications')
      .update({ read: true, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('read', false)
      .lte('created_at', before.toISOString())
      .limit(1000);

    if (error) {
      this.logger.error('NotificationPersistenceService.markAllRead: DB error', {
        error,
        userId,
        before,
      });
      throw new DatabaseError('Failed to mark all notifications as read');
    }
  }

  async delete(notificationId: string, pubkey: string): Promise<void> {
    const userId = await getUserIdByPubkey(this.db, pubkey);

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
      throw new AuthorizationError("Cannot delete another user's notification");
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
      throw new DatabaseError('Failed to delete notification');
    }
  }
}
