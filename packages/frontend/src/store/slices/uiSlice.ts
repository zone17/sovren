/**
 * UI State Slice - Client-side state management
 * Following Elite Engineering Standards
 *
 * This slice manages all UI-only state that belongs in Redux:
 * - Theme preferences
 * - Modal state
 * - Sidebar state
 * - Notifications
 * - Toast messages
 * - Form state for complex multi-step forms
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type Theme = 'light' | 'dark' | 'system';
export type ModalType = 'payment' | 'creator' | 'content' | 'settings' | 'confirmation' | null;

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
  createdAt: number;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  createdAt: number;
  actionUrl?: string;
}

export interface ModalState {
  type: ModalType;
  data?: any;
  isOpen: boolean;
}

export interface UIState {
  theme: Theme;
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  modal: ModalState;
  toasts: Toast[];
  notifications: Notification[];
  activeView: string;
  searchQuery: string;
  selectedFilters: Record<string, any>;
  formData: Record<string, any>; // For multi-step forms
  preferences: {
    autoPlay: boolean;
    soundEnabled: boolean;
    notificationsEnabled: boolean;
    compactMode: boolean;
  };
}

const initialState: UIState = {
  theme: 'system',
  sidebarOpen: true,
  sidebarCollapsed: false,
  modal: {
    type: null,
    data: null,
    isOpen: false,
  },
  toasts: [],
  notifications: [],
  activeView: 'dashboard',
  searchQuery: '',
  selectedFilters: {},
  formData: {},
  preferences: {
    autoPlay: true,
    soundEnabled: true,
    notificationsEnabled: true,
    compactMode: false,
  },
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    // Theme actions
    setTheme: (state, action: PayloadAction<Theme>) => {
      state.theme = action.payload;
      // Persist to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('theme', action.payload);
      }
    },

    // Sidebar actions
    toggleSidebar: (state) => {
      state.sidebarOpen = !state.sidebarOpen;
    },
    setSidebarOpen: (state, action: PayloadAction<boolean>) => {
      state.sidebarOpen = action.payload;
    },
    setSidebarCollapsed: (state, action: PayloadAction<boolean>) => {
      state.sidebarCollapsed = action.payload;
    },

    // Modal actions
    openModal: (state, action: PayloadAction<{ type: ModalType; data?: any }>) => {
      state.modal = {
        type: action.payload.type,
        data: action.payload.data,
        isOpen: true,
      };
    },
    closeModal: (state) => {
      state.modal = {
        type: null,
        data: null,
        isOpen: false,
      };
    },

    // Toast actions
    addToast: (state, action: PayloadAction<Omit<Toast, 'id' | 'createdAt'>>) => {
      const toast: Toast = {
        ...action.payload,
        id: `toast-${Date.now()}-${Math.random()}`,
        createdAt: Date.now(),
      };
      state.toasts.push(toast);

      // Auto-remove after duration (handled by middleware)
    },
    removeToast: (state, action: PayloadAction<string>) => {
      state.toasts = state.toasts.filter((toast) => toast.id !== action.payload);
    },
    clearToasts: (state) => {
      state.toasts = [];
    },

    // Notification actions
    addNotification: (
      state,
      action: PayloadAction<Omit<Notification, 'id' | 'createdAt' | 'read'>>
    ) => {
      const notification: Notification = {
        ...action.payload,
        id: `notif-${Date.now()}-${Math.random()}`,
        createdAt: Date.now(),
        read: false,
      };
      state.notifications.unshift(notification);
    },
    markNotificationRead: (state, action: PayloadAction<string>) => {
      const notification = state.notifications.find((n) => n.id === action.payload);
      if (notification) {
        notification.read = true;
      }
    },
    markAllNotificationsRead: (state) => {
      state.notifications.forEach((n) => {
        n.read = true;
      });
    },
    removeNotification: (state, action: PayloadAction<string>) => {
      state.notifications = state.notifications.filter((n) => n.id !== action.payload);
    },
    clearNotifications: (state) => {
      state.notifications = [];
    },

    // View and filter actions
    setActiveView: (state, action: PayloadAction<string>) => {
      state.activeView = action.payload;
    },
    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload;
    },
    setFilter: (state, action: PayloadAction<{ key: string; value: any }>) => {
      state.selectedFilters[action.payload.key] = action.payload.value;
    },
    clearFilter: (state, action: PayloadAction<string>) => {
      delete state.selectedFilters[action.payload];
    },
    clearAllFilters: (state) => {
      state.selectedFilters = {};
    },

    // Form data actions (for complex multi-step forms)
    setFormData: (state, action: PayloadAction<{ formId: string; data: any }>) => {
      state.formData[action.payload.formId] = action.payload.data;
    },
    updateFormField: (
      state,
      action: PayloadAction<{ formId: string; field: string; value: any }>
    ) => {
      if (!state.formData[action.payload.formId]) {
        state.formData[action.payload.formId] = {};
      }
      state.formData[action.payload.formId][action.payload.field] = action.payload.value;
    },
    clearFormData: (state, action: PayloadAction<string>) => {
      delete state.formData[action.payload];
    },

    // Preferences actions
    updatePreferences: (state, action: PayloadAction<Partial<UIState['preferences']>>) => {
      state.preferences = {
        ...state.preferences,
        ...action.payload,
      };
      // Persist to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('ui-preferences', JSON.stringify(state.preferences));
      }
    },

    // Hydrate from localStorage
    hydrateFromStorage: (state) => {
      if (typeof window === 'undefined') return;

      const theme = localStorage.getItem('theme') as Theme;
      if (theme) {
        state.theme = theme;
      }

      const preferences = localStorage.getItem('ui-preferences');
      if (preferences) {
        try {
          state.preferences = JSON.parse(preferences);
        } catch (e) {
          console.error('Failed to parse UI preferences from localStorage');
        }
      }
    },
  },
});

export const {
  setTheme,
  toggleSidebar,
  setSidebarOpen,
  setSidebarCollapsed,
  openModal,
  closeModal,
  addToast,
  removeToast,
  clearToasts,
  addNotification,
  markNotificationRead,
  markAllNotificationsRead,
  removeNotification,
  clearNotifications,
  setActiveView,
  setSearchQuery,
  setFilter,
  clearFilter,
  clearAllFilters,
  setFormData,
  updateFormField,
  clearFormData,
  updatePreferences,
  hydrateFromStorage,
} = uiSlice.actions;

export default uiSlice.reducer;
