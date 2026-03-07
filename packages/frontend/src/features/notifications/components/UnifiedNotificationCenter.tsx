/**
 * UnifiedNotificationCenter — tabbed interface combining server + NOSTR notifications
 * Slice 8: Creator Network + Notifications
 *
 * Tabs: "Activity" (server notifications) | "Nostr" (relay notifications)
 * Bell badge in header shows combined unread count.
 */

import React, { useEffect, useRef, useState } from 'react';
import { useAuthStatus } from '../../auth';
import { useUnreadCount as useNostrUnreadCount } from '../../nostr/notifications/hooks/useUnreadCount';
import { useUnreadNotificationCount, useNotificationRealtime } from '../hooks/useNotifications';
import ServerNotificationCenter from './ServerNotificationCenter';
import { NotificationCenter as NostrNotificationCenter } from '../../nostr/notifications/components/NotificationCenter';

type Tab = 'activity' | 'nostr';

const UnifiedNotificationCenter: React.FC = () => {
  const { user, isAuthenticated } = useAuthStatus();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('activity');
  const panelRef = useRef<HTMLDivElement>(null);

  const { data: serverUnread } = useUnreadNotificationCount();
  const nostrUnread = useNostrUnreadCount();
  const totalUnread = (serverUnread ?? 0) + nostrUnread;

  // Wire Realtime subscription for current user
  useNotificationRealtime(user?.id);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  if (!isAuthenticated) return null;

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        type="button"
        aria-label={totalUnread > 0 ? `Notifications (${totalUnread} unread)` : 'Notifications'}
        aria-expanded={isOpen}
        className="relative p-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      >
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
          <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
        </svg>
        {totalUnread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center min-w-[1.1rem] h-[1.1rem] rounded-full bg-red-500 text-white text-[10px] font-bold px-0.5">
            {totalUnread > 99 ? '99+' : totalUnread}
          </span>
        )}
      </button>

      {/* Panel */}
      {isOpen && (
        <div
          className="absolute right-0 top-full mt-2 w-80 bg-white rounded-lg shadow-2xl border border-gray-200 z-50 overflow-hidden flex flex-col"
          style={{ maxHeight: '520px' }}
          role="dialog"
          aria-label="Notifications"
        >
          {/* Tabs */}
          <div className="flex border-b border-gray-200" role="tablist">
            <button
              role="tab"
              aria-selected={activeTab === 'activity'}
              onClick={() => setActiveTab('activity')}
              className={[
                'flex-1 py-2.5 text-sm font-medium transition-colors focus:outline-none',
                activeTab === 'activity'
                  ? 'text-indigo-600 border-b-2 border-indigo-600'
                  : 'text-gray-500 hover:text-gray-700',
              ].join(' ')}
              type="button"
            >
              Activity
              {(serverUnread ?? 0) > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center min-w-[1.1rem] h-[1.1rem] rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold px-0.5">
                  {serverUnread}
                </span>
              )}
            </button>
            <button
              role="tab"
              aria-selected={activeTab === 'nostr'}
              onClick={() => setActiveTab('nostr')}
              className={[
                'flex-1 py-2.5 text-sm font-medium transition-colors focus:outline-none',
                activeTab === 'nostr'
                  ? 'text-indigo-600 border-b-2 border-indigo-600'
                  : 'text-gray-500 hover:text-gray-700',
              ].join(' ')}
              type="button"
            >
              Nostr
              {nostrUnread > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center min-w-[1.1rem] h-[1.1rem] rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold px-0.5">
                  {nostrUnread}
                </span>
              )}
            </button>
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === 'activity' ? (
              <ServerNotificationCenter />
            ) : (
              <NostrNotificationCenter initialOpen={false} />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default UnifiedNotificationCenter;
