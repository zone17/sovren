/**
 * Notification Types and Interfaces
 * EPIC 003 WAVE 5 - STORY 6: Mentions/Notifications UI
 */

import type { Event as NostrEvent } from 'nostr-tools';

/**
 * Enumeration of all notification types supported by the system
 */
export enum NotificationType {
  MENTION = 'mention', // Tagged in event (kind 1)
  REPLY = 'reply', // Reply to your event
  REACTION = 'reaction', // Reaction to your event (kind 7)
  REPOST = 'repost', // Repost of your event (kind 6)
  DM = 'dm', // Direct message (kind 4)
  FOLLOW = 'follow', // New follower (kind 3)
  ZAP = 'zap', // Lightning payment received (kind 9735)
}

/**
 * Author information for a notification
 */
export interface NotificationAuthor {
  pubkey: string;
  name?: string;
  displayName?: string;
  avatar?: string;
  nip05?: string;
}

/**
 * Core notification data structure
 */
export interface Notification {
  id: string; // Unique notification ID
  type: NotificationType; // Type of notification
  event: NostrEvent; // The NOSTR event that triggered this notification
  author: NotificationAuthor; // Author of the event
  content: string; // Formatted notification message
  createdAt: number; // Unix timestamp (seconds)
  read: boolean; // Read status
  url?: string; // Link to event/thread (naddr/nevent)
  metadata?: NotificationMetadata; // Type-specific metadata
}

/**
 * Type-specific metadata for notifications
 */
export interface NotificationMetadata {
  // For reactions
  reactionContent?: string; // The emoji or reaction content

  // For replies
  parentEventId?: string; // The event being replied to

  // For reposts
  originalEventId?: string; // The event being reposted

  // For zaps
  zapAmount?: number; // Amount in millisats
  zapComment?: string; // Comment attached to zap

  // For DMs
  encrypted?: boolean; // Whether DM is encrypted
}

/**
 * User preferences for notifications
 */
export interface NotificationPreferences {
  enableMentions: boolean;
  enableReplies: boolean;
  enableReactions: boolean;
  enableReposts: boolean;
  enableDMs: boolean;
  enableFollows: boolean;
  enableZaps: boolean;
  playSound: boolean;
  showDesktopNotifications: boolean;
  soundVolume: number; // 0-1
  groupByDate: boolean; // Group notifications by date
  autoMarkRead: boolean; // Mark as read when viewed
}

/**
 * Default notification preferences
 */
export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  enableMentions: true,
  enableReplies: true,
  enableReactions: true,
  enableReposts: true,
  enableDMs: true,
  enableFollows: true,
  enableZaps: true,
  playSound: true,
  showDesktopNotifications: true,
  soundVolume: 0.5,
  groupByDate: true,
  autoMarkRead: true,
};

/**
 * Notification filter for querying
 */
export interface NotificationFilter {
  types?: NotificationType[];
  read?: boolean;
  startDate?: number; // Unix timestamp
  endDate?: number; // Unix timestamp
  authorPubkey?: string;
  limit?: number;
  offset?: number;
}

/**
 * Notification group for date-based grouping
 */
export interface NotificationGroup {
  label: string; // "Today", "Yesterday", "This Week", etc.
  notifications: Notification[];
  unreadCount: number;
}

/**
 * Notification statistics
 */
export interface NotificationStats {
  total: number;
  unread: number;
  byType: Record<NotificationType, number>;
  todayCount: number;
  weekCount: number;
}

/**
 * Notification service state
 */
export interface NotificationServiceState {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  error: Error | null;
  lastFetchedAt: number | null;
  subscribed: boolean;
}

/**
 * Notification sound type
 */
export enum NotificationSound {
  DEFAULT = 'default',
  MENTION = 'mention',
  DM = 'dm',
  REACTION = 'reaction',
  NONE = 'none',
}

/**
 * Desktop notification options
 */
export interface DesktopNotificationOptions {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  requireInteraction?: boolean;
  silent?: boolean;
  data?: unknown;
}

/**
 * Notification event handlers
 */
export interface NotificationEventHandlers {
  onNotificationReceived?: (notification: Notification) => void;
  onNotificationRead?: (notificationId: string) => void;
  onNotificationClick?: (notification: Notification) => void;
  onNotificationDismiss?: (notificationId: string) => void;
}

/**
 * IndexedDB schema for notifications
 */
export interface NotificationStorageSchema {
  id: string;
  type: NotificationType;
  eventId: string; // NOSTR event ID
  eventJson: string; // Serialized event
  authorPubkey: string;
  content: string;
  createdAt: number;
  read: boolean;
  url?: string;
  metadataJson?: string; // Serialized metadata
}

/**
 * Type guard to check if notification is unread
 */
export const isUnreadNotification = (notification: Notification): boolean => {
  return !notification.read;
};

/**
 * Type guard to check if notification is recent (within 24 hours)
 */
export const isRecentNotification = (notification: Notification): boolean => {
  const oneDayAgo = Math.floor(Date.now() / 1000) - 86400;
  return notification.createdAt > oneDayAgo;
};

/**
 * Get notification priority (for sorting)
 */
export const getNotificationPriority = (type: NotificationType): number => {
  const priorities: Record<NotificationType, number> = {
    [NotificationType.DM]: 1,
    [NotificationType.MENTION]: 2,
    [NotificationType.REPLY]: 3,
    [NotificationType.ZAP]: 4,
    [NotificationType.REACTION]: 5,
    [NotificationType.REPOST]: 6,
    [NotificationType.FOLLOW]: 7,
  };
  return priorities[type] || 999;
};
