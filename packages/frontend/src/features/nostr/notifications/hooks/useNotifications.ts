/**
 * useNotifications Hook
 * EPIC 003 WAVE 5 - STORY 6: Mentions/Notifications UI
 */

import { useState, useEffect, useCallback } from 'react';
import { getNotificationService } from '../services/NotificationService';
import type {
  NotificationFilter,
  NotificationServiceState,
} from '../types';

/**
 * Hook to manage notifications
 */
export const useNotifications = (filter?: NotificationFilter) => {
  const service = getNotificationService();
  const [state, setState] = useState<NotificationServiceState>(service.getState());

  useEffect(() => {
    // Subscribe to service state changes
    const unsubscribe = service.subscribe(setState);
    return unsubscribe;
  }, [service]);

  // Filter notifications based on provided filter
  const filteredNotifications = useCallback(() => {
    if (!filter) return state.notifications;

    return state.notifications.filter((notification) => {
      if (filter.types && !filter.types.includes(notification.type)) {
        return false;
      }
      if (filter.read !== undefined && notification.read !== filter.read) {
        return false;
      }
      if (filter.startDate && notification.createdAt < filter.startDate) {
        return false;
      }
      if (filter.endDate && notification.createdAt > filter.endDate) {
        return false;
      }
      if (filter.authorPubkey && notification.author.pubkey !== filter.authorPubkey) {
        return false;
      }
      return true;
    });
  }, [state.notifications, filter]);

  const notifications = filteredNotifications();

  // Mark notification as read
  const markAsRead = useCallback(
    async (notificationId: string) => {
      try {
        await service.markAsRead(notificationId);
      } catch (error) {
        console.error('Failed to mark notification as read:', error);
        throw error;
      }
    },
    [service]
  );

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    try {
      await service.markAllAsRead();
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
      throw error;
    }
  }, [service]);

  // Delete notification
  const deleteNotification = useCallback(
    async (notificationId: string) => {
      try {
        await service.deleteNotification(notificationId);
      } catch (error) {
        console.error('Failed to delete notification:', error);
        throw error;
      }
    },
    [service]
  );

  // Refresh notifications
  const refresh = useCallback(async () => {
    try {
      await service.cleanupOldNotifications();
    } catch (error) {
      console.error('Failed to refresh notifications:', error);
      throw error;
    }
  }, [service]);

  return {
    notifications,
    unreadCount: state.unreadCount,
    loading: state.loading,
    error: state.error,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refresh,
  };
};
