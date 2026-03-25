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
  useUnreadNotificationCount,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useDeleteNotification,
} from '../hooks/useNotifications';
import NotificationItem from './NotificationItem';
import type { ServerNotification } from '@shared/types/notifications';

function groupByDate(
  notifications: ServerNotification[]
): { label: string; items: ServerNotification[] }[] {
  const DAY = 86_400_000;
  // #690: Use UTC midnight to avoid local timezone shifting group boundaries
  const todayIso = new Date().toISOString().split('T')[0];
  const todayStart = new Date(todayIso).getTime();
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
  const { data: unreadCount = 0 } = useUnreadNotificationCount();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const deleteNotification = useDeleteNotification();

  // #738: Use the stable React Query data reference directly to avoid re-creating
  // the grouped array when the notifications array reference changes but content doesn't.
  // data?.notifications is stable across renders when the query data hasn't changed.
  const notifications = data?.notifications ?? [];
  const grouped = useMemo(() => groupByDate(data?.notifications ?? []), [data?.notifications]);

  return (
    <div className={['flex flex-col', className].filter(Boolean).join(' ')}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="text-sm font-semibold text-foreground font-display">Activity</span>
        {unreadCount > 0 && (
          <button
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
            className="text-xs text-purple-400 hover:text-purple-300 font-medium disabled:opacity-50 transition-colors duration-150"
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
                <div className="w-2 h-2 mt-1.5 rounded-full bg-purple-500/20 shrink-0" />
                <div className="flex-1">
                  <div className="h-3 w-40 bg-purple-500/10 rounded mb-1.5" />
                  <div className="h-2 w-24 bg-purple-500/5 rounded" />
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
            <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center mb-3">
              <svg
                className="w-5 h-5 text-purple-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
              </svg>
            </div>
            <p className="text-sm font-medium text-foreground">No notifications yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              When someone follows you or comments, you'll see it here.
            </p>
          </div>
        ) : (
          <ul role="list">
            {grouped.map((group) => (
              <li key={group.label}>
                <div className="px-4 py-1.5 bg-card border-b border-border">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {group.label}
                  </span>
                </div>
                <ul role="list">
                  {group.items.map((notification) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      onMarkRead={(id) => markRead.mutate(id)}
                      onDelete={(id) => deleteNotification.mutate(id)}
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
