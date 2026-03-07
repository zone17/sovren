/**
 * INotificationPersistenceService — DB notification CRUD
 * Slice 8: Creator Network + Notifications
 *
 * Focused 7-method interface for persisting and querying notifications.
 * Separate from legacy INotificationService (multi-channel push delivery).
 */

import type {
  ServerNotification,
  NotificationListResponse,
  NotificationType,
  NotificationEntityType,
} from '@shared/types/notifications';

export interface CreateNotificationPayload {
  userId: string;
  actorId: string | null;
  type: NotificationType;
  title: string;
  body?: string;
  entityType?: NotificationEntityType;
  entityId?: string;
  data?: Record<string, unknown>;
}

export interface NotificationListOptions {
  page: number;
  limit: number;
  unreadOnly?: boolean;
}

export interface INotificationPersistenceService {
  /**
   * Create a single notification.
   */
  create(payload: CreateNotificationPayload): Promise<ServerNotification>;

  /**
   * Create multiple notifications in a single multi-row INSERT.
   * Used for circle post fan-out to all circle members (except author).
   */
  createBatch(payloads: CreateNotificationPayload[]): Promise<void>;

  /**
   * List notifications for a user (JOIN actor display_name/avatar to avoid N+1).
   */
  list(userId: string, opts: NotificationListOptions): Promise<NotificationListResponse>;

  /**
   * Get unread notification count for a user.
   * Leverages partial index idx_notifications_user_unread.
   */
  getUnreadCount(userId: string): Promise<number>;

  /**
   * Mark a single notification as read. Throws AuthorizationError if not owner.
   */
  markRead(notificationId: string, userId: string): Promise<void>;

  /**
   * Mark all unread notifications before a cutoff as read.
   * WHERE created_at <= before AND read = FALSE AND user_id = userId
   */
  markAllRead(userId: string, before: Date): Promise<void>;

  /**
   * Delete a notification. Throws AuthorizationError if not owner.
   */
  delete(notificationId: string, userId: string): Promise<void>;
}
