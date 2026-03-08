/**
 * NotificationItem Component
 * EPIC 003 WAVE 5 - STORY 6: Mentions/Notifications UI
 */

import React, { useCallback } from 'react';
import { Notification, NotificationType } from '../types';
import { formatDistanceToNow } from 'date-fns';

export interface NotificationItemProps {
  notification: Notification;
  onRead?: (id: string) => void;
  onClick?: (notification: Notification) => void;
  onDelete?: (id: string) => void;
  autoMarkRead?: boolean;
  showActions?: boolean;
  className?: string;
}

/**
 * Individual notification item component
 */
export const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onRead,
  onClick,
  onDelete,
  autoMarkRead = true,
  showActions = true,
  className = '',
}) => {
  const handleClick = useCallback(() => {
    if (autoMarkRead && !notification.read && onRead) {
      onRead(notification.id);
    }
    if (onClick) {
      onClick(notification);
    } else if (notification.url) {
      window.location.href = notification.url;
    }
  }, [notification, autoMarkRead, onRead, onClick]);

  const handleMarkAsRead = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (onRead) {
        onRead(notification.id);
      }
    },
    [notification.id, onRead]
  );

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (onDelete) {
        onDelete(notification.id);
      }
    },
    [notification.id, onDelete]
  );

  // Get notification icon based on type
  const getNotificationIcon = () => {
    const iconClass = 'w-5 h-5';

    switch (notification.type) {
      case NotificationType.MENTION:
        return (
          <svg className={iconClass} fill="currentColor" viewBox="0 0 20 20">
            <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
            <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z" />
          </svg>
        );
      case NotificationType.REPLY:
        return (
          <svg className={iconClass} fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M7.707 3.293a1 1 0 010 1.414L5.414 7H11a7 7 0 017 7v2a1 1 0 11-2 0v-2a5 5 0 00-5-5H5.414l2.293 2.293a1 1 0 11-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        );
      case NotificationType.REACTION:
        return (
          <svg className={iconClass} fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"
              clipRule="evenodd"
            />
          </svg>
        );
      case NotificationType.REPOST:
        return (
          <svg className={iconClass} fill="currentColor" viewBox="0 0 20 20">
            <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" />
          </svg>
        );
      case NotificationType.DM:
        return (
          <svg className={iconClass} fill="currentColor" viewBox="0 0 20 20">
            <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
            <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
          </svg>
        );
      case NotificationType.FOLLOW:
        return (
          <svg className={iconClass} fill="currentColor" viewBox="0 0 20 20">
            <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z" />
          </svg>
        );
      case NotificationType.ZAP:
        return (
          <svg className={iconClass} fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z"
              clipRule="evenodd"
            />
          </svg>
        );
      default:
        return (
          <svg className={iconClass} fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
          </svg>
        );
    }
  };

  // Get icon color based on type
  const getIconColor = () => {
    switch (notification.type) {
      case NotificationType.MENTION:
        return 'text-purple-500';
      case NotificationType.REPLY:
        return 'text-green-500';
      case NotificationType.REACTION:
        return 'text-red-500';
      case NotificationType.REPOST:
        return 'text-purple-500';
      case NotificationType.DM:
        return 'text-yellow-500';
      case NotificationType.FOLLOW:
        return 'text-violet-500';
      case NotificationType.ZAP:
        return 'text-orange-500';
      default:
        return 'text-gray-500';
    }
  };

  // Format timestamp
  const formattedTime = formatDistanceToNow(notification.createdAt * 1000, {
    addSuffix: true,
  });

  return (
    <div
      className={`
        flex items-start p-4 border-b border-border
        cursor-pointer transition-colors duration-150
        hover:bg-purple-500/5
        ${!notification.read ? 'bg-purple-500/10' : 'bg-background'}
        ${className}
      `}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
      aria-label={`Notification: ${notification.content}`}
    >
      {/* Unread indicator */}
      {!notification.read && (
        <div className="mr-2 mt-1.5">
          <div className="w-2 h-2 rounded-full bg-purple-500" aria-label="Unread" />
        </div>
      )}

      {/* Avatar or Icon */}
      <div className="flex-shrink-0 mr-3">
        {notification.author.avatar ? (
          <img
            src={notification.author.avatar}
            alt={notification.author.name || 'User'}
            className="w-10 h-10 rounded-full object-cover"
          />
        ) : (
          <div
            className={`
              w-10 h-10 rounded-full flex items-center justify-center
              bg-card
              ${getIconColor()}
            `}
          >
            {getNotificationIcon()}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-foreground mb-1">{notification.content}</p>
        <p className="text-xs text-muted-foreground">{formattedTime}</p>
      </div>

      {/* Actions */}
      {showActions && (
        <div className="flex items-center gap-2 ml-3">
          {!notification.read && onRead && (
            <button
              onClick={handleMarkAsRead}
              className="p-1 text-muted-foreground hover:text-purple-400 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-purple-500 rounded"
              aria-label="Mark as read"
              title="Mark as read"
              type="button"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          )}

          {onDelete && (
            <button
              onClick={handleDelete}
              className="p-1 text-muted-foreground hover:text-red-500 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-red-500 rounded"
              aria-label="Delete notification"
              title="Delete"
              type="button"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
