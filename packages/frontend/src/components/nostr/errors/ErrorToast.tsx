/**
 * 🔔 ELITE COMPONENT: Error Toast System
 *
 * US-319: Implement Error Handling UI
 * Epic 003: NOSTR Consolidation
 *
 * Toast notification system for errors:
 * - Beautiful animated toasts
 * - Multiple severity levels
 * - Auto-dismiss with configurable timeout
 * - Manual dismiss
 * - Retry mechanism
 * - Stack multiple toasts
 * - Accessible
 */

import React, { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { ErrorToast as ErrorToastType, ErrorToastOptions, NostrErrorMetadata } from './types';
import { ErrorSeverity, getAutoDismissDuration } from './types';

// ============================================
// TOAST MANAGER CLASS
// ============================================

class ErrorToastManager {
  private static instance: ErrorToastManager | null = null;
  private toasts: ErrorToastType[] = [];
  private listeners: Set<(toasts: ErrorToastType[]) => void> = new Set();

  private constructor() {}

  static getInstance(): ErrorToastManager {
    if (!ErrorToastManager.instance) {
      ErrorToastManager.instance = new ErrorToastManager();
    }
    return ErrorToastManager.instance;
  }

  private generateId(): string {
    return `error_toast_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener([...this.toasts]));
  }

  subscribe(listener: (toasts: ErrorToastType[]) => void): () => void {
    this.listeners.add(listener);
    listener([...this.toasts]); // Initial call
    return () => {
      this.listeners.delete(listener);
    };
  }

  showError(options: ErrorToastOptions): string {
    const id = this.generateId();
    const duration = options.duration ?? getAutoDismissDuration(options.error.severity);

    const toast: ErrorToastType = {
      ...options,
      id,
      createdAt: Date.now(),
      duration,
      isRetrying: false,
      retryAttempt: 0,
    };

    // Add to beginning (newest first)
    this.toasts.unshift(toast);

    // Limit to max 5 toasts
    if (this.toasts.length > 5) {
      this.toasts = this.toasts.slice(0, 5);
    }

    this.notifyListeners();

    // Auto-dismiss if duration > 0
    if (duration > 0) {
      setTimeout(() => {
        this.dismiss(id);
      }, duration);
    }

    return id;
  }

  dismiss(id: string): void {
    const index = this.toasts.findIndex((t) => t.id === id);
    if (index > -1) {
      const toast = this.toasts[index];
      toast.onDismiss?.();
      this.toasts.splice(index, 1);
      this.notifyListeners();
    }
  }

  updateToast(id: string, updates: Partial<ErrorToastType>): void {
    const index = this.toasts.findIndex((t) => t.id === id);
    if (index > -1) {
      this.toasts[index] = { ...this.toasts[index], ...updates };
      this.notifyListeners();
    }
  }

  dismissAll(): void {
    this.toasts.forEach((toast) => toast.onDismiss?.());
    this.toasts = [];
    this.notifyListeners();
  }

  getToasts(): ErrorToastType[] {
    return [...this.toasts];
  }
}

// ============================================
// SINGLE TOAST COMPONENT
// ============================================

interface ToastItemProps {
  toast: ErrorToastType;
  onDismiss: (id: string) => void;
  onRetry: (id: string) => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onDismiss, onRetry }) => {
  const [isExiting, setIsExiting] = useState(false);

  const getSeverityClasses = (): string => {
    switch (toast.error.severity) {
      case ErrorSeverity.INFO:
        return 'bg-blue-600 border-blue-700';
      case ErrorSeverity.WARNING:
        return 'bg-yellow-600 border-yellow-700';
      case ErrorSeverity.ERROR:
        return 'bg-red-600 border-red-700';
      case ErrorSeverity.CRITICAL:
        return 'bg-red-700 border-red-800';
    }
  };

  const handleDismiss = (): void => {
    setIsExiting(true);
    setTimeout(() => {
      onDismiss(toast.id);
    }, 300); // Match animation duration
  };

  const handleRetry = (): void => {
    onRetry(toast.id);
  };

  return (
    <div
      className={`
        ${getSeverityClasses()}
        border rounded-lg shadow-lg
        p-4 mb-3 max-w-md w-full
        transform transition-all duration-300 ease-in-out
        ${isExiting ? 'translate-x-full opacity-0' : 'translate-x-0 opacity-100'}
      `}
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
    >
      <div className="flex items-start">
        {/* Icon */}
        <div className="flex-shrink-0">
          {toast.icon || (
            <svg
              className="w-5 h-5 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          )}
        </div>

        {/* Content */}
        <div className="ml-3 flex-1">
          {/* Title */}
          <h3 className="text-sm font-semibold text-white">{toast.error.title}</h3>

          {/* Message */}
          <p className="mt-1 text-xs text-white/90">{toast.error.message}</p>

          {/* Error Code */}
          <p className="mt-1 text-xs text-white/70 font-mono">{toast.error.code}</p>

          {/* Actions */}
          <div className="mt-3 flex items-center gap-2">
            {toast.retryable && toast.onRetry && (
              <button
                onClick={handleRetry}
                disabled={toast.isRetrying}
                className="px-3 py-1 text-xs font-medium bg-white/20 hover:bg-white/30 disabled:bg-white/10 text-white rounded transition-colors focus:outline-none focus:ring-2 focus:ring-white/50"
                aria-label="Retry operation"
              >
                {toast.isRetrying ? 'Retrying...' : 'Retry'}
              </button>
            )}

            {toast.action && (
              <button
                onClick={toast.action.onClick}
                className="px-3 py-1 text-xs font-medium bg-white/20 hover:bg-white/30 text-white rounded transition-colors focus:outline-none focus:ring-2 focus:ring-white/50"
                aria-label={toast.action.label}
              >
                {toast.action.label}
              </button>
            )}

            {toast.dismissible !== false && (
              <button
                onClick={handleDismiss}
                className="ml-auto p-1 text-white/70 hover:text-white rounded transition-colors focus:outline-none focus:ring-2 focus:ring-white/50"
                aria-label="Dismiss"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
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
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================
// TOAST CONTAINER COMPONENT
// ============================================

export const ErrorToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<ErrorToastType[]>([]);
  const manager = ErrorToastManager.getInstance();

  useEffect(() => {
    const unsubscribe = manager.subscribe(setToasts);
    return unsubscribe;
  }, [manager]);

  const handleDismiss = useCallback(
    (id: string): void => {
      manager.dismiss(id);
    },
    [manager]
  );

  const handleRetry = useCallback(
    async (id: string): Promise<void> => {
      const toast = toasts.find((t) => t.id === id);
      if (!toast || !toast.onRetry) return;

      manager.updateToast(id, {
        isRetrying: true,
        retryAttempt: (toast.retryAttempt || 0) + 1,
      });

      try {
        await toast.onRetry();
        manager.dismiss(id);
      } catch (error) {
        console.error('[ErrorToast] Retry failed:', error);
        manager.updateToast(id, { isRetrying: false });
      }
    },
    [toasts, manager]
  );

  if (toasts.length === 0) {
    return null;
  }

  return createPortal(
    <div
      className="fixed top-4 right-4 z-50 pointer-events-none"
      aria-live="polite"
      aria-atomic="false"
    >
      <div className="flex flex-col pointer-events-auto">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={handleDismiss} onRetry={handleRetry} />
        ))}
      </div>
    </div>,
    document.body
  );
};

// ============================================
// HOOK FOR ERROR TOASTS
// ============================================

export interface UseErrorToastReturn {
  showError: (options: ErrorToastOptions) => string;
  dismiss: (id: string) => void;
  dismissAll: () => void;
  toasts: ErrorToastType[];
}

export const useErrorToast = (): UseErrorToastReturn => {
  const manager = ErrorToastManager.getInstance();
  const [toasts, setToasts] = useState<ErrorToastType[]>(manager.getToasts());

  useEffect(() => {
    const unsubscribe = manager.subscribe(setToasts);
    return unsubscribe;
  }, [manager]);

  const showError = useCallback(
    (options: ErrorToastOptions): string => {
      return manager.showError(options);
    },
    [manager]
  );

  const dismiss = useCallback(
    (id: string): void => {
      manager.dismiss(id);
    },
    [manager]
  );

  const dismissAll = useCallback((): void => {
    manager.dismissAll();
  }, [manager]);

  return {
    showError,
    dismiss,
    dismissAll,
    toasts,
  };
};

// ============================================
// CONVENIENCE FUNCTIONS
// ============================================

export const errorToast = {
  show: (error: NostrErrorMetadata, options?: Omit<ErrorToastOptions, 'error'>): string => {
    const manager = ErrorToastManager.getInstance();
    return manager.showError({
      error,
      ...options,
    });
  },

  dismiss: (id: string): void => {
    const manager = ErrorToastManager.getInstance();
    manager.dismiss(id);
  },

  dismissAll: (): void => {
    const manager = ErrorToastManager.getInstance();
    manager.dismissAll();
  },
};

export default ErrorToastContainer;
