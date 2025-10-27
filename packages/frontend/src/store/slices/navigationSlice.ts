/**
 * Navigation State Slice - Client-side navigation state
 * Following Elite Engineering Standards
 *
 * This slice manages navigation-related UI state:
 * - Breadcrumbs
 * - Active routes
 * - Navigation history
 * - Tab state
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface Breadcrumb {
  label: string;
  path: string;
  icon?: string;
}

export interface Tab {
  id: string;
  label: string;
  path: string;
  closable: boolean;
  isDirty?: boolean;
}

export interface NavigationState {
  currentPath: string;
  previousPath: string | null;
  breadcrumbs: Breadcrumb[];
  navigationHistory: string[]; // Last 10 navigations
  tabs: Tab[];
  activeTabId: string | null;
  isNavigating: boolean;
  scrollPositions: Record<string, number>; // Preserve scroll position per route
}

const initialState: NavigationState = {
  currentPath: '/',
  previousPath: null,
  breadcrumbs: [],
  navigationHistory: [],
  tabs: [],
  activeTabId: null,
  isNavigating: false,
  scrollPositions: {},
};

const navigationSlice = createSlice({
  name: 'navigation',
  initialState,
  reducers: {
    // Navigation actions
    navigateTo: (state, action: PayloadAction<string>) => {
      state.previousPath = state.currentPath;
      state.currentPath = action.payload;

      // Add to history (max 10 items)
      state.navigationHistory = [
        action.payload,
        ...state.navigationHistory.filter(path => path !== action.payload)
      ].slice(0, 10);

      state.isNavigating = false;
    },

    startNavigating: (state) => {
      state.isNavigating = true;
    },

    finishNavigating: (state) => {
      state.isNavigating = false;
    },

    // Breadcrumb actions
    setBreadcrumbs: (state, action: PayloadAction<Breadcrumb[]>) => {
      state.breadcrumbs = action.payload;
    },

    addBreadcrumb: (state, action: PayloadAction<Breadcrumb>) => {
      state.breadcrumbs.push(action.payload);
    },

    removeBreadcrumb: (state, action: PayloadAction<number>) => {
      state.breadcrumbs = state.breadcrumbs.slice(0, action.payload + 1);
    },

    clearBreadcrumbs: (state) => {
      state.breadcrumbs = [];
    },

    // Tab actions
    addTab: (state, action: PayloadAction<Omit<Tab, 'isDirty'>>) => {
      const existingTab = state.tabs.find(tab => tab.id === action.payload.id);
      if (!existingTab) {
        state.tabs.push({
          ...action.payload,
          isDirty: false,
        });
      }
      state.activeTabId = action.payload.id;
    },

    removeTab: (state, action: PayloadAction<string>) => {
      const index = state.tabs.findIndex(tab => tab.id === action.payload);
      if (index !== -1) {
        state.tabs.splice(index, 1);

        // If active tab was removed, activate the next or previous tab
        if (state.activeTabId === action.payload) {
          if (state.tabs.length > 0) {
            const newIndex = Math.min(index, state.tabs.length - 1);
            state.activeTabId = state.tabs[newIndex].id;
          } else {
            state.activeTabId = null;
          }
        }
      }
    },

    setActiveTab: (state, action: PayloadAction<string>) => {
      if (state.tabs.some(tab => tab.id === action.payload)) {
        state.activeTabId = action.payload;
      }
    },

    updateTabDirtyState: (state, action: PayloadAction<{ id: string; isDirty: boolean }>) => {
      const tab = state.tabs.find(t => t.id === action.payload.id);
      if (tab) {
        tab.isDirty = action.payload.isDirty;
      }
    },

    clearTabs: (state) => {
      state.tabs = [];
      state.activeTabId = null;
    },

    // Scroll position actions
    saveScrollPosition: (state, action: PayloadAction<{ path: string; position: number }>) => {
      state.scrollPositions[action.payload.path] = action.payload.position;
    },

    clearScrollPosition: (state, action: PayloadAction<string>) => {
      delete state.scrollPositions[action.payload];
    },

    // History actions
    clearNavigationHistory: (state) => {
      state.navigationHistory = [];
    },

    goBack: (state) => {
      if (state.previousPath) {
        const temp = state.currentPath;
        state.currentPath = state.previousPath;
        state.previousPath = temp;
      }
    },
  },
});

// Export actions
export const {
  navigateTo,
  startNavigating,
  finishNavigating,
  setBreadcrumbs,
  addBreadcrumb,
  removeBreadcrumb,
  clearBreadcrumbs,
  addTab,
  removeTab,
  setActiveTab,
  updateTabDirtyState,
  clearTabs,
  saveScrollPosition,
  clearScrollPosition,
  clearNavigationHistory,
  goBack,
} = navigationSlice.actions;

// Selectors
export const selectCurrentPath = (state: { navigation: NavigationState }) =>
  state.navigation.currentPath;

export const selectBreadcrumbs = (state: { navigation: NavigationState }) =>
  state.navigation.breadcrumbs;

export const selectTabs = (state: { navigation: NavigationState }) =>
  state.navigation.tabs;

export const selectActiveTab = (state: { navigation: NavigationState }) =>
  state.navigation.tabs.find(tab => tab.id === state.navigation.activeTabId);

export const selectIsNavigating = (state: { navigation: NavigationState }) =>
  state.navigation.isNavigating;

export const selectScrollPosition = (path: string) =>
  (state: { navigation: NavigationState }) => state.navigation.scrollPositions[path] || 0;

export default navigationSlice.reducer;