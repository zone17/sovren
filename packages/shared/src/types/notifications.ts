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

export type NotificationEntityType = 'comment' | 'follow' | 'payment' | 'mentorship' | 'circle';

// #753: Typed notification data payloads — discriminated union replaces opaque Record<string, unknown>
export interface CircleNotificationData {
  circleId: string;
  circleName: string;
}

export interface MentorNotificationData {
  mentorId: string;
  mentorName: string;
}

export interface FollowNotificationData {
  followerId: string;
  followerName: string;
}

export interface CommentNotificationData {
  commentId: string;
  contentId: string;
  excerpt?: string;
}

export interface PaymentNotificationData {
  amountSats: number;
  paymentHash?: string;
}

/**
 * Typed data payload for notifications. The `Record<string, unknown>` fallback
 * maintains backward compatibility with any notification types not yet enumerated.
 */
export type NotificationData =
  | CircleNotificationData
  | MentorNotificationData
  | FollowNotificationData
  | CommentNotificationData
  | PaymentNotificationData
  | Record<string, unknown>;

export interface ServerNotification {
  id: string;
  userId: string;
  actorId: string | null;
  type: NotificationType;
  title: string;
  body: string | null;
  entityType: NotificationEntityType | null;
  entityId: string | null;
  data: NotificationData;
  read: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationListResponse {
  notifications: ServerNotification[];
  pagination: { page: number; limit: number; total: number; hasNext: boolean };
}
