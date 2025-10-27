/**
 * useUnreadCount Hook
 * EPIC 003 WAVE 5 - STORY 6: Mentions/Notifications UI
 */

import { useState, useEffect } from 'react';
import { getNotificationService } from '../services/NotificationService';
import type { NotificationServiceState } from '../types';

/**
 * Hook to track unread notification count
 */
export const useUnreadCount = () => {
  const service = getNotificationService();
  const [unreadCount, setUnreadCount] = useState<number>(service.getUnreadCount());

  useEffect(() => {
    // Subscribe to service state changes
    const unsubscribe = service.subscribe((state: NotificationServiceState) => {
      setUnreadCount(state.unreadCount);
    });

    return unsubscribe;
  }, [service]);

  return unreadCount;
};
