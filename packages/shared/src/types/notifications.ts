/**
 * Server-side notification types for Slice 8: Creator Network + Notifications
 */

export type NotificationType =
  | 'new_comment'
  | 'new_follower'
  | 'payment_received'
  | 'mentorship_request'
  | 'mentorship_accepted'
  | 'mentorship_declined'
  | 'circle_join'
  | 'circle_post';

export type NotificationEntityType =
  | 'comment'
  | 'follow'
  | 'payment'
  | 'mentorship'
  | 'circle';

export interface ServerNotification {
  id: string;
  userId: string;
  actorId: string | null;
  type: NotificationType;
  title: string;
  body: string | null;
  entityType: NotificationEntityType | null;
  entityId: string | null;
  data: Record<string, unknown>;
  read: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationListResponse {
  notifications: ServerNotification[];
  pagination: { page: number; limit: number; total: number; hasNext: boolean };
}
