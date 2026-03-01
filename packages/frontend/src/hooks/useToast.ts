/**
 * 🔔 **TOAST NOTIFICATION HOOK**
 *
 * Elite React Hook providing:
 * - Beautiful toast notifications
 * - Multiple variants and styles
 * - Auto-dismiss and manual control
 * - Accessibility compliance
 * - Animation support
 */

import { useCallback, useEffect, useState } from 'react';

// =====================================================
// TYPES
// =====================================================

export type ToastVariant = 'default' | 'success' | 'error' | 'warning' | 'info' | 'destructive';

export type ToastPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

export interface ToastAction {
  label: string;
  onClick: () => void;
  variant?: 'default' | 'outline';
}

export interface ToastOptions {
  title?: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number; // in milliseconds, 0 = never auto-dismiss
  action?: ToastAction;
  dismissible?: boolean;
  position?: ToastPosition;
  icon?: React.ReactNode;
  className?: string;
  onDismiss?: () => void;
  onAction?: () => void;
}

export interface Toast extends Required<Omit<ToastOptions, 'action' | 'onDismiss' | 'onAction'>> {
  id: string;
  createdAt: Date;
  action?: ToastAction;
  onDismiss?: () => void;
  onAction?: () => void;
}

export interface UseToastReturn {
  toast: (options: ToastOptions) => string;
  dismiss: (id: string) => void;
  dismissAll: () => void;
  toasts: Toast[];
  isVisible: (id: string) => boolean;
}

// =====================================================
// DEFAULT CONFIG
// =====================================================

const DEFAULT_TOAST_OPTIONS: Required<
  Omit<ToastOptions, 'title' | 'description' | 'action' | 'onDismiss' | 'onAction' | 'icon'>
> = {
  variant: 'default',
  duration: 5000,
  dismissible: true,
  position: 'bottom-right',
  className: '',
};

// =====================================================
// TOAST MANAGER
// =====================================================

class ToastManager {
  private toasts: Toast[] = [];
  private listeners: Set<(toasts: Toast[]) => void> = new Set();
  private timers: Map<string, NodeJS.Timeout> = new Map();

  private generateId(): string {
    return `toast_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener([...this.toasts]));
  }

  subscribe(listener: (toasts: Toast[]) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  addToast(options: ToastOptions): string {
    const id = this.generateId();

    const toast: Toast = {
      id,
      createdAt: new Date(),
      title: options.title || '',
      description: options.description || '',
      variant: options.variant || DEFAULT_TOAST_OPTIONS.variant,
      duration: options.duration ?? DEFAULT_TOAST_OPTIONS.duration,
      dismissible: options.dismissible ?? DEFAULT_TOAST_OPTIONS.dismissible,
      position: options.position || DEFAULT_TOAST_OPTIONS.position,
      className: options.className || DEFAULT_TOAST_OPTIONS.className,
      action: options.action,
      icon: options.icon as any,
      onDismiss: options.onDismiss,
      onAction: options.onAction,
    };

    // Add to beginning of array to show newest first
    this.toasts.unshift(toast);

    // Set up auto-dismiss timer
    if (toast.duration > 0) {
      const timer = setTimeout(() => {
        this.removeToast(id);
      }, toast.duration);

      this.timers.set(id, timer);
    }

    this.notifyListeners();
    return id;
  }

  removeToast(id: string): void {
    const toastIndex = this.toasts.findIndex((t) => t.id === id);

    if (toastIndex > -1) {
      const toast = this.toasts[toastIndex];

      // Clear timer if exists
      const timer = this.timers.get(id);
      if (timer) {
        clearTimeout(timer);
        this.timers.delete(id);
      }

      // Call onDismiss callback
      toast.onDismiss?.();

      // Remove from array
      this.toasts.splice(toastIndex, 1);
      this.notifyListeners();
    }
  }

  removeAllToasts(): void {
    // Clear all timers
    this.timers.forEach((timer) => clearTimeout(timer));
    this.timers.clear();

    // Call onDismiss for all toasts
    this.toasts.forEach((toast) => toast.onDismiss?.());

    // Clear toasts
    this.toasts = [];
    this.notifyListeners();
  }

  isToastVisible(id: string): boolean {
    return this.toasts.some((t) => t.id === id);
  }

  getToasts(): Toast[] {
    return [...this.toasts];
  }
}

// =====================================================
// GLOBAL TOAST MANAGER INSTANCE
// =====================================================

let toastManager: ToastManager | null = null;

const getToastManager = (): ToastManager => {
  if (!toastManager) {
    toastManager = new ToastManager();
  }
  return toastManager;
};

// =====================================================
// MAIN HOOK
// =====================================================

export const useToast = (): UseToastReturn => {
  const manager = getToastManager();
  const [toasts, setToasts] = useState<Toast[]>(manager.getToasts());

  // Subscribe to toast manager updates
  useEffect(() => {
    const unsubscribe = manager.subscribe(setToasts);
    return unsubscribe;
  }, [manager]);

  const toast = useCallback(
    (options: ToastOptions): string => {
      return manager.addToast(options);
    },
    [manager]
  );

  const dismiss = useCallback(
    (id: string): void => {
      manager.removeToast(id);
    },
    [manager]
  );

  const dismissAll = useCallback((): void => {
    manager.removeAllToasts();
  }, [manager]);

  const isVisible = useCallback(
    (id: string): boolean => {
      return manager.isToastVisible(id);
    },
    [manager]
  );

  return {
    toast,
    dismiss,
    dismissAll,
    toasts,
    isVisible,
  };
};

// =====================================================
// CONVENIENCE FUNCTIONS
// =====================================================

export const toast = {
  success: (
    title: string,
    description?: string,
    options?: Omit<ToastOptions, 'title' | 'description' | 'variant'>
  ) => {
    const manager = getToastManager();
    return manager.addToast({
      title,
      description,
      variant: 'success',
      ...options,
    });
  },

  error: (
    title: string,
    description?: string,
    options?: Omit<ToastOptions, 'title' | 'description' | 'variant'>
  ) => {
    const manager = getToastManager();
    return manager.addToast({
      title,
      description,
      variant: 'error',
      ...options,
    });
  },

  warning: (
    title: string,
    description?: string,
    options?: Omit<ToastOptions, 'title' | 'description' | 'variant'>
  ) => {
    const manager = getToastManager();
    return manager.addToast({
      title,
      description,
      variant: 'warning',
      ...options,
    });
  },

  info: (
    title: string,
    description?: string,
    options?: Omit<ToastOptions, 'title' | 'description' | 'variant'>
  ) => {
    const manager = getToastManager();
    return manager.addToast({
      title,
      description,
      variant: 'info',
      ...options,
    });
  },

  default: (
    title: string,
    description?: string,
    options?: Omit<ToastOptions, 'title' | 'description' | 'variant'>
  ) => {
    const manager = getToastManager();
    return manager.addToast({
      title,
      description,
      variant: 'default',
      ...options,
    });
  },

  dismiss: (id: string) => {
    const manager = getToastManager();
    manager.removeToast(id);
  },

  dismissAll: () => {
    const manager = getToastManager();
    manager.removeAllToasts();
  },
};

export default useToast;
