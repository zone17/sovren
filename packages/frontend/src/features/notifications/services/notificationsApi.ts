/**
 * Notifications API Service
 * Slice 8: Creator Network + Notifications
 *
 * Domain-scoped API service following the commentsApi.ts pattern.
 */

import apiClient from '@/services/api/apiClient';
import type { NotificationListResponse, ServerNotification } from '@shared/types/notifications';

const BASE = '/api/v2/notifications';

export const notificationsApi = {
  list(params?: { page?: number; limit?: number }): Promise<NotificationListResponse> {
    return apiClient.get(BASE, params as Record<string, number | undefined>);
  },

  markRead(notificationId: string): Promise<ServerNotification> {
    return apiClient.patch(`${BASE}/${notificationId}`, { read: true });
  },

  markAllRead(before: string): Promise<{ updated: number }> {
    return apiClient.post(`${BASE}/mark-all-read`, { before });
  },

  getUnreadCount(): Promise<{ count: number }> {
    return apiClient.get(`${BASE}/unread-count`);
  },

  delete(notificationId: string): Promise<void> {
    return apiClient.delete(`${BASE}/${notificationId}`);
  },
};
