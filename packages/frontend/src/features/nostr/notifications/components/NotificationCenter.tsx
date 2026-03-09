/**
 * NotificationCenter Component
 * EPIC 003 WAVE 5 - STORY 6: Mentions/Notifications UI
 */

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { NotificationItem } from './NotificationItem';
import { NotificationBadge } from './NotificationBadge';
import { NotificationEmpty } from './NotificationEmpty';
import { NotificationSettings } from './NotificationSettings';
import { useNotifications } from '../hooks/useNotifications';
import { useUnreadCount } from '../hooks/useUnreadCount';
import { NotificationType, NotificationGroup, Notification } from '../types';
import { getNotificationService } from '../services/NotificationService';

export interface NotificationCenterProps {
  position?: 'left' | 'right';
  maxHeight?: string;
  showSettings?: boolean;
  playSound?: boolean;
  autoMarkRead?: boolean;
  initialOpen?: boolean;
  onNotificationClick?: (notification: Notification) => void;
  className?: string;
}

/**
 * Main notification center component
 */
export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  position = 'right',
  maxHeight = '600px',
  showSettings = true,
  playSound = true,
  autoMarkRead = true,
  initialOpen = false,
  onNotificationClick,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(initialOpen);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<NotificationType | 'all'>('all');
  const panelRef = useRef<HTMLDivElement>(null);

  const service = getNotificationService();
  const unreadCount = useUnreadCount();
  const { notifications, markAsRead, markAllAsRead, deleteNotification } = useNotifications();

  // Filter notifications based on selected filter
  const filteredNotifications = useMemo(() => {
    if (selectedFilter === 'all') {
      return notifications;
    }
    return notifications.filter((n) => n.type === selectedFilter);
  }, [notifications, selectedFilter]);

  // Group notifications by date
  const groupedNotifications = useMemo(() => {
    const preferences = service.getPreferences();
    if (!preferences.groupByDate) {
      return [
        {
          label: 'All Notifications',
          notifications: filteredNotifications,
          unreadCount: filteredNotifications.filter((n) => !n.read).length,
        },
      ];
    }

    const now = Math.floor(Date.now() / 1000);
    const today = now - (now % 86400);
    const yesterday = today - 86400;
    const weekAgo = now - 7 * 86400;

    const groups: NotificationGroup[] = [
      { label: 'Today', notifications: [], unreadCount: 0 },
      { label: 'Yesterday', notifications: [], unreadCount: 0 },
      { label: 'This Week', notifications: [], unreadCount: 0 },
      { label: 'Older', notifications: [], unreadCount: 0 },
    ];

    filteredNotifications.forEach((notification) => {
      if (notification.createdAt >= today) {
        groups[0].notifications.push(notification);
        if (!notification.read) groups[0].unreadCount++;
      } else if (notification.createdAt >= yesterday) {
        groups[1].notifications.push(notification);
        if (!notification.read) groups[1].unreadCount++;
      } else if (notification.createdAt >= weekAgo) {
        groups[2].notifications.push(notification);
        if (!notification.read) groups[2].unreadCount++;
      } else {
        groups[3].notifications.push(notification);
        if (!notification.read) groups[3].unreadCount++;
      }
    });

    return groups.filter((g) => g.notifications.length > 0);
  }, [filteredNotifications, service]);

  // Toggle panel
  const togglePanel = useCallback(() => {
    setIsOpen((prev) => !prev);
    setShowSettingsPanel(false);
  }, []);

  // Handle notification click
  const handleNotificationClick = useCallback(
    (notification: Notification) => {
      if (onNotificationClick) {
        onNotificationClick(notification);
      }
    },
    [onNotificationClick]
  );

  // Handle mark all as read
  const handleMarkAllAsRead = useCallback(async () => {
    try {
      await markAllAsRead();
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  }, [markAllAsRead]);

  // Close panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowSettingsPanel(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
    return undefined;
  }, [isOpen]);

  // Get filter tabs
  const filterTabs: Array<{ type: NotificationType | 'all'; label: string; icon: string }> = [
    { type: 'all', label: 'All', icon: '📬' },
    { type: NotificationType.MENTION, label: 'Mentions', icon: '@' },
    { type: NotificationType.REPLY, label: 'Replies', icon: '💬' },
    { type: NotificationType.REACTION, label: 'Reactions', icon: '❤️' },
    { type: NotificationType.DM, label: 'Messages', icon: '✉️' },
    { type: NotificationType.ZAP, label: 'Zaps', icon: '⚡' },
  ];

  return (
    <div className={`relative ${className}`} ref={panelRef}>
      {/* Notification Bell Button */}
      <button
        onClick={togglePanel}
        className="relative p-2 text-muted-foreground hover:bg-purple-500/10 rounded-full transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-purple-500"
        aria-label={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ''}`}
        aria-expanded={isOpen}
        type="button"
      >
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
        </svg>
        {unreadCount > 0 && (
          <div className="absolute -top-1 -right-1">
            <NotificationBadge count={unreadCount} size="sm" />
          </div>
        )}
      </button>

      {/* Notification Panel */}
      {isOpen && (
        <div
          className={`
            absolute top-full mt-2 w-96 max-w-screen
            glass rounded-lg shadow-2xl
            border border-border
            z-50 overflow-hidden
            ${position === 'left' ? 'left-0' : 'right-0'}
          `}
          style={{ maxHeight }}
          role="dialog"
          aria-label="Notification center"
        >
          {showSettingsPanel ? (
            <NotificationSettings onClose={() => setShowSettingsPanel(false)} />
          ) : (
            <>
              {/* Header */}
              <div className="sticky top-0 bg-background/80 backdrop-blur-sm border-b border-border z-10">
                <div className="flex items-center justify-between p-4">
                  <h2 className="text-lg font-semibold text-foreground font-display">
                    Notifications
                  </h2>
                  <div className="flex items-center gap-2">
                    {showSettings && (
                      <button
                        onClick={() => setShowSettingsPanel(true)}
                        className="p-1 text-muted-foreground hover:text-foreground transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-purple-500 rounded"
                        aria-label="Settings"
                        title="Settings"
                        type="button"
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </button>
                    )}
                    <button
                      onClick={togglePanel}
                      className="p-1 text-muted-foreground hover:text-foreground transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-purple-500 rounded"
                      aria-label="Close"
                      type="button"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Filter Tabs */}
                <div className="flex overflow-x-auto px-4 pb-2 gap-2 scrollbar-hide">
                  {filterTabs.map((tab) => (
                    <button
                      key={tab.type}
                      onClick={() => setSelectedFilter(tab.type)}
                      className={`
                        flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap
                        transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-purple-500
                        ${
                          selectedFilter === tab.type
                            ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-[0_4px_16px_rgba(139,92,246,0.3)]'
                            : 'bg-card text-muted-foreground hover:bg-purple-500/10'
                        }
                      `}
                      type="button"
                    >
                      <span>{tab.icon}</span>
                      <span>{tab.label}</span>
                    </button>
                  ))}
                </div>

                {/* Action Bar */}
                {notifications.length > 0 && (
                  <div className="flex items-center justify-between px-4 py-2 bg-card">
                    <span className="text-xs text-muted-foreground">
                      {filteredNotifications.length} notification
                      {filteredNotifications.length !== 1 ? 's' : ''}
                    </span>
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllAsRead}
                        className="text-xs text-purple-400 hover:text-purple-300 font-medium focus:outline-none focus:underline transition-colors duration-150"
                        type="button"
                      >
                        Mark all as read
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Notification List */}
              <div className="overflow-y-auto" style={{ maxHeight: `calc(${maxHeight} - 200px)` }}>
                {notifications.length === 0 ? (
                  <NotificationEmpty />
                ) : filteredNotifications.length === 0 ? (
                  <NotificationEmpty message="No notifications in this category" />
                ) : (
                  groupedNotifications.map((group) => (
                    <div key={group.label}>
                      <div className="sticky top-0 px-4 py-2 bg-card border-b border-border">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            {group.label}
                          </h3>
                          {group.unreadCount > 0 && (
                            <NotificationBadge count={group.unreadCount} size="sm" />
                          )}
                        </div>
                      </div>
                      {group.notifications.map((notification) => (
                        <NotificationItem
                          key={notification.id}
                          notification={notification}
                          onRead={markAsRead}
                          onClick={handleNotificationClick}
                          onDelete={deleteNotification}
                          autoMarkRead={autoMarkRead}
                        />
                      ))}
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
