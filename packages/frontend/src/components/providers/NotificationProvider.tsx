/**
 * Notification Provider Component
 * Centralized notification management using Redux
 * Following Elite Engineering Standards
 */

import React, { useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAppSelector, useAppDispatch } from '@/store';
import { selectToasts, selectNotifications } from '@/store';
import {
  removeToast,
  removeNotification,
  markNotificationRead,
  type Toast,
  type Notification,
} from '@/store/slices/uiSlice';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle as CheckCircleIcon,
  XCircle as XCircleIcon,
  AlertTriangle as ExclamationTriangleIcon,
  Info as InformationCircleIcon,
  X as XMarkIcon,
  Bell as BellIcon,
} from 'lucide-react';

interface NotificationProviderProps {
  children: React.ReactNode;
  toastContainerId?: string;
  notificationContainerId?: string;
  maxToasts?: number;
  maxNotifications?: number;
}

// Toast component
const ToastItem: React.FC<{ toast: Toast; onDismiss: () => void }> = ({ toast, onDismiss }) => {
  const icons = {
    success: <CheckCircleIcon className="w-5 h-5 text-green-500" />,
    error: <XCircleIcon className="w-5 h-5 text-red-500" />,
    warning: <ExclamationTriangleIcon className="w-5 h-5 text-yellow-500" />,
    info: <InformationCircleIcon className="w-5 h-5 text-blue-500" />,
  };

  const bgColors = {
    success: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
    error: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
    warning: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
    info: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
  };

  // Auto-dismiss timer
  useEffect(() => {
    if (toast.duration && toast.duration > 0) {
      const timer = setTimeout(onDismiss, toast.duration);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [toast.duration, onDismiss]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className={`
        flex items-start gap-3 p-4 rounded-lg border shadow-lg
        ${bgColors[toast.type]}
        backdrop-blur-sm
      `}
      role="alert"
      aria-live="polite"
    >
      {icons[toast.type]}
      <p className="flex-1 text-sm text-gray-900 dark:text-gray-100">{toast.message}</p>
      <button
        onClick={onDismiss}
        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        aria-label="Dismiss notification"
      >
        <XMarkIcon className="w-4 h-4" />
      </button>
    </motion.div>
  );
};

// Notification item component
const NotificationItem: React.FC<{
  notification: Notification;
  onDismiss: () => void;
  onRead: () => void;
}> = ({ notification, onDismiss, onRead }) => {
  const bgColors = {
    success: 'bg-green-50 dark:bg-green-900/10',
    error: 'bg-red-50 dark:bg-red-900/10',
    warning: 'bg-yellow-50 dark:bg-yellow-900/10',
    info: 'bg-white dark:bg-gray-800',
  };

  useEffect(() => {
    // Mark as read after 2 seconds of being visible
    const timer = setTimeout(onRead, 2000);
    return () => clearTimeout(timer);
  }, [onRead]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 300 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 300 }}
      transition={{ duration: 0.3 }}
      className={`
        relative p-4 rounded-lg border shadow-lg
        ${bgColors[notification.type]}
        ${!notification.read ? 'border-blue-400' : 'border-gray-200 dark:border-gray-700'}
      `}
      role="alert"
      aria-live={notification.type === 'error' ? 'assertive' : 'polite'}
    >
      {/* Unread indicator */}
      {!notification.read && (
        <div className="absolute top-2 right-2 w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
      )}

      <div className="flex items-start gap-3">
        <BellIcon className="w-5 h-5 text-gray-500 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">{notification.title}</h3>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{notification.message}</p>
          {notification.actionUrl && (
            <a
              href={notification.actionUrl}
              className="inline-block mt-2 text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
            >
              View details →
            </a>
          )}
        </div>
        <button
          onClick={onDismiss}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          aria-label="Dismiss notification"
        >
          <XMarkIcon className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
};

export const NotificationProvider: React.FC<NotificationProviderProps> = ({
  children,
  toastContainerId = 'toast-root',
  notificationContainerId = 'notification-root',
  maxToasts = 5,
  maxNotifications = 3,
}) => {
  const toasts = useAppSelector(selectToasts);
  const notifications = useAppSelector(selectNotifications);
  const dispatch = useAppDispatch();

  // Handle toast dismissal
  const handleToastDismiss = useCallback(
    (toastId: string) => {
      dispatch(removeToast(toastId));
    },
    [dispatch]
  );

  // Handle notification dismissal
  const handleNotificationDismiss = useCallback(
    (notificationId: string) => {
      dispatch(removeNotification(notificationId));
    },
    [dispatch]
  );

  // Handle notification read
  const handleNotificationRead = useCallback(
    (notificationId: string) => {
      dispatch(markNotificationRead(notificationId));
    },
    [dispatch]
  );

  // Get container elements
  const toastContainer = document.getElementById(toastContainerId);
  const notificationContainer = document.getElementById(notificationContainerId);

  // Create containers if they don't exist
  useEffect(() => {
    if (!document.getElementById(toastContainerId)) {
      const container = document.createElement('div');
      container.id = toastContainerId;
      document.body.appendChild(container);
    }

    if (!document.getElementById(notificationContainerId)) {
      const container = document.createElement('div');
      container.id = notificationContainerId;
      document.body.appendChild(container);
    }
  }, [toastContainerId, notificationContainerId]);

  return (
    <>
      {children}

      {/* Toast notifications */}
      {toastContainer &&
        createPortal(
          <div
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 space-y-2 pointer-events-none"
            aria-live="polite"
            aria-label="Toast notifications"
          >
            <AnimatePresence mode="popLayout">
              {toasts.slice(0, maxToasts).map((toast) => (
                <div key={toast.id} className="pointer-events-auto">
                  <ToastItem toast={toast} onDismiss={() => handleToastDismiss(toast.id)} />
                </div>
              ))}
            </AnimatePresence>
          </div>,
          toastContainer
        )}

      {/* Persistent notifications */}
      {notificationContainer &&
        createPortal(
          <div
            className="fixed top-20 right-4 z-40 space-y-2 max-w-sm"
            aria-live="polite"
            aria-label="Notifications"
          >
            <AnimatePresence>
              {notifications
                .filter((n) => !n.read)
                .slice(0, maxNotifications)
                .map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onDismiss={() => handleNotificationDismiss(notification.id)}
                    onRead={() => handleNotificationRead(notification.id)}
                  />
                ))}
            </AnimatePresence>
          </div>,
          notificationContainer
        )}
    </>
  );
};

// Hooks for using notifications
export const useToast = () => {
  const dispatch = useAppDispatch();

  const showToast = useCallback(
    (message: string, type: Toast['type'] = 'info', duration = 5000) => {
      dispatch({
        type: 'ui/addToast',
        payload: { message, type, duration },
      });
    },
    [dispatch]
  );

  const success = useCallback(
    (message: string, duration?: number) => showToast(message, 'success', duration),
    [showToast]
  );

  const error = useCallback(
    (message: string, duration?: number) => showToast(message, 'error', duration),
    [showToast]
  );

  const warning = useCallback(
    (message: string, duration?: number) => showToast(message, 'warning', duration),
    [showToast]
  );

  const info = useCallback(
    (message: string, duration?: number) => showToast(message, 'info', duration),
    [showToast]
  );

  return { showToast, success, error, warning, info };
};

export const useNotification = () => {
  const dispatch = useAppDispatch();
  const notifications = useAppSelector(selectNotifications);

  const showNotification = useCallback(
    (title: string, message: string, type: Notification['type'] = 'info', actionUrl?: string) => {
      dispatch({
        type: 'ui/addNotification',
        payload: { title, message, type, actionUrl },
      });
    },
    [dispatch]
  );

  const clearAll = useCallback(() => {
    dispatch({ type: 'ui/clearNotifications' });
  }, [dispatch]);

  const markAllRead = useCallback(() => {
    dispatch({ type: 'ui/markAllNotificationsRead' });
  }, [dispatch]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return {
    notifications,
    unreadCount,
    showNotification,
    clearAll,
    markAllRead,
  };
};
