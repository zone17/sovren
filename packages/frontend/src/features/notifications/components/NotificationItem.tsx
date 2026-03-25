/**
 * NotificationItem — single server notification row
 * Slice 8: Creator Network + Notifications
 */

import React from 'react';
import type { ServerNotification } from '@shared/types/notifications';

interface NotificationItemProps {
  notification: ServerNotification;
  onMarkRead?: (id: string) => void;
  onDelete?: (id: string) => void;
}

function formatRelativeTime(createdAt: string): string {
  const diff = Date.now() - new Date(createdAt).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onMarkRead,
  onDelete,
}) => {
  const handleClick = () => {
    if (!notification.read && onMarkRead) {
      onMarkRead(notification.id);
    }
  };

  const handleDelete = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    if (onDelete) {
      onDelete(notification.id);
    }
  };

  return (
    <li
      className={[
        'flex items-start gap-3 px-4 py-3 hover:bg-purple-500/5 cursor-pointer group transition-colors duration-150',
        !notification.read ? 'bg-purple-500/10 hover:bg-purple-500/15' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') handleClick();
      }}
      aria-label={notification.title}
    >
      {/* Unread indicator */}
      <div className="mt-1.5 shrink-0 w-2 h-2 rounded-full" aria-hidden="true">
        {!notification.read && <div className="w-2 h-2 rounded-full bg-purple-500" />}
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground truncate">{notification.title}</p>
        {notification.body && (
          <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{notification.body}</p>
        )}
        <p className="text-xs text-muted-foreground mt-1">
          {formatRelativeTime(notification.createdAt)}
        </p>
      </div>

      {/* #752: Delete button — visible on hover */}
      {onDelete && (
        <button
          type="button"
          onClick={handleDelete}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') handleDelete(e);
          }}
          className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150 p-1 rounded text-muted-foreground hover:text-red-500 hover:bg-red-500/10 focus:opacity-100"
          aria-label="Delete notification"
          tabIndex={0}
        >
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}
    </li>
  );
};

export default NotificationItem;
