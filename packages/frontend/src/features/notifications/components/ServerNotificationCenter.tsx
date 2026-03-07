/**
 * ServerNotificationCenter — server-side notifications panel
 * Slice 8: Creator Network + Notifications
 *
 * - Date grouping (Today / Yesterday / This Week / Older)
 * - Mark-all-read button
 * - Empty state
 * - aria-live="polite" for accessibility
 */

import React, { useMemo } from 'react';
import {
  useServerNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from '../hooks/useNotifications';
import NotificationItem from './NotificationItem';
import type { ServerNotification } from '@shared/types/notifications';

function groupByDate(notifications: ServerNotification[]): { label: string; items: ServerNotification[] }[] {
  const DAY = 86_400_000;
  const todayStartDate = new Date();
  todayStartDate.setHours(0, 0, 0, 0);
  const todayStart = todayStartDate.getTime();
  const yesterdayStart = todayStart - DAY;
  const weekStart = Date.now() - 7 * DAY;

  const groups: { label: string; items: ServerNotification[] }[] = [
    { label: 'Today', items: [] },
    { label: 'Yesterday', items: [] },
    { label: 'This Week', items: [] },
    { label: 'Older', items: [] },
  ];

  for (const n of notifications) {
    const ts = new Date(n.createdAt).getTime();
    if (ts >= todayStart) {
      groups[0].items.push(n);
    } else if (ts >= yesterdayStart) {
      groups[1].items.push(n);
    } else if (ts >= weekStart) {
      groups[2].items.push(n);
    } else {
      groups[3].items.push(n);
    }
  }

  return groups.filter((g) => g.items.length > 0);
}

interface ServerNotificationCenterProps {
  className?: string;
}

const ServerNotificationCenter: React.FC<ServerNotificationCenterProps> = ({ className = '' }) => {
  const { data, isLoading, isError } = useServerNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const notifications = data?.notifications ?? [];
  const unreadCount = notifications.filter((n) => !n.read).length;
  const grouped = useMemo(() => groupByDate(notifications), [notifications]);

  return (
    <div className={['flex flex-col', className].filter(Boolean).join(' ')}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <span className="text-sm font-semibold text-gray-700">Activity</span>
        {unreadCount > 0 && (
          <button
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium disabled:opacity-50"
            type="button"
          >
            {markAllRead.isPending ? 'Marking...' : 'Mark all read'}
          </button>
        )}
      </div>

      {/* Live region for screen readers */}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="sr-only"
        aria-label={`${unreadCount} unread notifications`}
      />

      {/* Content */}
      <div className="overflow-y-auto flex-1">
        {isLoading ? (
          <div className="flex flex-col gap-3 p-4 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-3 items-start">
                <div className="w-2 h-2 mt-1.5 rounded-full bg-gray-200 shrink-0" />
                <div className="flex-1">
                  <div className="h-3 w-40 bg-gray-200 rounded mb-1.5" />
                  <div className="h-2 w-24 bg-gray-100 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : isError ? (
          <p className="text-sm text-red-500 text-center py-8 px-4">
            Failed to load notifications. Please refresh.
          </p>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-900">No notifications yet</p>
            <p className="text-xs text-gray-500 mt-1">
              When someone follows you or comments, you'll see it here.
            </p>
          </div>
        ) : (
          <ul role="list">
            {grouped.map((group) => (
              <li key={group.label}>
                <div className="px-4 py-1.5 bg-gray-50 border-b border-gray-100">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {group.label}
                  </span>
                </div>
                <ul role="list">
                  {group.items.map((notification) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      onMarkRead={(id) => markRead.mutate(id)}
                    />
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default ServerNotificationCenter;
