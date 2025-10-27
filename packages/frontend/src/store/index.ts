/**
 * Redux Store Configuration - Refactored for proper state boundaries
 *
 * Redux now manages ONLY client-side UI state:
 * - Theme, modals, sidebars, notifications
 * - Form state for complex multi-step forms
 * - Editor UI state (CMS)
 * - User authentication state (session)
 *
 * All server data is managed by React Query
 */

import { configureStore } from '@reduxjs/toolkit';
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';

// Import UI-only reducers
import uiReducer from './slices/uiSlice';
import cmsUiReducer from './slices/cmsUiSlice';
import userReducer from './slices/userSlice'; // Keep for auth state only
import navigationReducer from './slices/navigationSlice';
import layoutReducer from './slices/layoutSlice';
import paginationReducer from './slices/paginationSlice';

// REMOVED: Server data slices
// - postReducer (moved to React Query)
// - paymentReducer (moved to React Query)
// - cmsReducer (content data moved to React Query, UI state in cmsUiReducer)

export const store = configureStore({
  reducer: {
    // UI State (stays in Redux)
    ui: uiReducer,
    cmsUi: cmsUiReducer,
    navigation: navigationReducer,
    layout: layoutReducer,
    pagination: paginationReducer,

    // Auth State (stays in Redux - it's client state)
    user: userReducer,

    // REMOVED: Server data slices
    // post: postReducer, // -> Use React Query hooks instead
    // payment: paymentReducer, // -> Use React Query hooks instead
    // cms: cmsReducer, // -> Content data in React Query, UI in cmsUi
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore these action types
        ignoredActions: [
          'persist/PERSIST',
          'ui/addToast',
          'ui/addNotification',
        ],
        // Ignore these field paths in all actions
        ignoredActionPaths: ['payload.timestamp', 'payload.createdAt'],
        // Ignore these paths in the state
        ignoredPaths: ['ui.toasts', 'ui.notifications'],
      },
    }),
});

// Infer types from store
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Typed hooks for use throughout the app
export const useAppDispatch = (): AppDispatch => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

// UI-specific selectors
export const selectTheme = (state: RootState) => state.ui.theme;
export const selectModal = (state: RootState) => state.ui.modal;
export const selectToasts = (state: RootState) => state.ui.toasts;
export const selectNotifications = (state: RootState) => state.ui.notifications;
export const selectSidebarOpen = (state: RootState) => state.ui.sidebarOpen;

// CMS UI selectors
export const selectEditorState = (state: RootState) => state.cmsUi.editor;
export const selectDrafts = (state: RootState) => state.cmsUi.drafts;
export const selectPreviewMode = (state: RootState) => state.cmsUi.previewMode;

// User/Auth selectors (client state)
export const selectCurrentUser = (state: RootState) => state.user.currentUser;
export const selectIsAuthenticated = (state: RootState) => !!state.user.currentUser;

// Navigation selectors
export const selectCurrentPath = (state: RootState) => state.navigation.currentPath;
export const selectBreadcrumbs = (state: RootState) => state.navigation.breadcrumbs;
export const selectNavigationTabs = (state: RootState) => state.navigation.tabs;
export const selectIsNavigating = (state: RootState) => state.navigation.isNavigating;

// Layout selectors
export const selectWorkspaceLayout = (state: RootState) => state.layout.workspaceLayout;
export const selectBreakpoint = (state: RootState) => state.layout.breakpoint;
export const selectPanels = (state: RootState) => state.layout.panels;
export const selectFocusMode = (state: RootState) => state.layout.focusModeEnabled;
export const selectZenMode = (state: RootState) => state.layout.zenModeEnabled;

/**
 * Middleware for auto-removing toasts after duration
 */
export const toastMiddleware = (store: any) => (next: any) => (action: any) => {
  const result = next(action);

  if (action.type === 'ui/addToast') {
    const toast = action.payload;
    const duration = toast.duration || 5000; // Default 5 seconds

    if (duration > 0) {
      setTimeout(() => {
        store.dispatch({
          type: 'ui/removeToast',
          payload: store.getState().ui.toasts.find((t: any) =>
            t.message === toast.message && t.type === toast.type
          )?.id,
        });
      }, duration);
    }
  }

  return result;
};

/**
 * Initialize store with localStorage data
 */
export const initializeStore = () => {
  // Hydrate UI preferences from localStorage
  store.dispatch({ type: 'ui/hydrateFromStorage' });

  // Note: User auth state should be hydrated from secure session storage
  // or validated with the backend on app load
};

export default store;