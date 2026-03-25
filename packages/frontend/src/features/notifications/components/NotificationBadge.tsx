/**
 * NotificationBadge — combined server + NOSTR unread count
 * Slice 8: Creator Network + Notifications
 *
 * Renders null until both counts are loaded to avoid flicker.
 */

import React from 'react';
import { useUnreadNotificationCount } from '../hooks/useNotifications';
import { useUnreadCount as useNostrUnreadCount } from '../../nostr/notifications/hooks/useUnreadCount';

interface NotificationBadgeProps {
  className?: string;
}

const NotificationBadge: React.FC<NotificationBadgeProps> = ({ className = '' }) => {
  const { data: serverCount, isLoading: serverLoading } = useUnreadNotificationCount();
  const nostrCount = useNostrUnreadCount();

  // Render null until both counts are loaded (per spec)
  if (serverLoading) return null;

  const total = (serverCount ?? 0) + nostrCount;
  if (total === 0) return null;

  return (
    <span
      className={[
        'inline-flex items-center justify-center min-w-[1.25rem] h-5 rounded-full bg-red-500 px-1 text-xs font-bold text-white',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label={`${total} unread notifications`}
    >
      {total > 99 ? '99+' : total}
    </span>
  );
};

export default NotificationBadge;
