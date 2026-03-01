/**
 * Layout State Slice - Client-side layout preferences
 * Following Elite Engineering Standards
 *
 * This slice manages layout-related UI state:
 * - Panel sizes and positions
 * - Workspace layouts
 * - Grid and list view preferences
 * - Responsive breakpoint state
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type ViewMode = 'grid' | 'list' | 'card' | 'compact';
export type PanelPosition = 'left' | 'right' | 'top' | 'bottom';
export type WorkspaceLayout = 'default' | 'focus' | 'wide' | 'split';

export interface PanelConfig {
  id: string;
  size: number; // Percentage or pixels
  minSize: number;
  maxSize: number;
  isCollapsed: boolean;
  isResizable: boolean;
  position: PanelPosition;
}

export interface LayoutState {
  // Workspace configuration
  workspaceLayout: WorkspaceLayout;

  // Panel configurations
  panels: Record<string, PanelConfig>;

  // View preferences per section
  viewModes: Record<string, ViewMode>;

  // Grid configuration
  gridColumns: Record<string, number>; // Number of columns per section
  itemsPerPage: Record<string, number>; // Items per page per section

  // Responsive state
  breakpoint: 'mobile' | 'tablet' | 'desktop' | 'wide';
  isMobileMenuOpen: boolean;

  // Split view configuration
  splitRatio: number; // 0-100, percentage for first panel
  splitOrientation: 'horizontal' | 'vertical';

  // Focus mode
  focusModeEnabled: boolean;
  zenModeEnabled: boolean; // Ultra minimal UI

  // Dock/Float states
  floatingPanels: string[]; // IDs of panels that are floating
  dockedPanels: string[]; // IDs of panels that are docked
}

const defaultPanelConfig: PanelConfig = {
  id: '',
  size: 250,
  minSize: 150,
  maxSize: 500,
  isCollapsed: false,
  isResizable: true,
  position: 'left',
};

const initialState: LayoutState = {
  workspaceLayout: 'default',
  panels: {
    sidebar: {
      ...defaultPanelConfig,
      id: 'sidebar',
      size: 260,
      position: 'left',
    },
    rightPanel: {
      ...defaultPanelConfig,
      id: 'rightPanel',
      size: 320,
      position: 'right',
      isCollapsed: true,
    },
    bottomPanel: {
      ...defaultPanelConfig,
      id: 'bottomPanel',
      size: 200,
      position: 'bottom',
      isCollapsed: true,
    },
  },
  viewModes: {
    content: 'grid',
    creators: 'card',
    analytics: 'list',
    media: 'grid',
  },
  gridColumns: {
    content: 3,
    media: 4,
    creators: 4,
  },
  itemsPerPage: {
    content: 12,
    creators: 20,
    analytics: 25,
    media: 16,
  },
  breakpoint: 'desktop',
  isMobileMenuOpen: false,
  splitRatio: 50,
  splitOrientation: 'vertical',
  focusModeEnabled: false,
  zenModeEnabled: false,
  floatingPanels: [],
  dockedPanels: ['sidebar', 'rightPanel', 'bottomPanel'],
};

const layoutSlice = createSlice({
  name: 'layout',
  initialState,
  reducers: {
    // Workspace layout actions
    setWorkspaceLayout: (state, action: PayloadAction<WorkspaceLayout>) => {
      state.workspaceLayout = action.payload;

      // Adjust panels based on workspace layout
      switch (action.payload) {
        case 'focus':
          state.panels.sidebar.isCollapsed = true;
          state.panels.rightPanel.isCollapsed = true;
          state.focusModeEnabled = true;
          break;
        case 'wide':
          state.panels.rightPanel.isCollapsed = true;
          state.panels.sidebar.size = 200;
          break;
        case 'split':
          state.splitOrientation = 'vertical';
          state.splitRatio = 50;
          break;
        default:
          state.focusModeEnabled = false;
          break;
      }
    },

    // Panel actions
    resizePanel: (state, action: PayloadAction<{ id: string; size: number }>) => {
      const panel = state.panels[action.payload.id];
      if (panel) {
        panel.size = Math.max(panel.minSize, Math.min(panel.maxSize, action.payload.size));
      }
    },

    togglePanel: (state, action: PayloadAction<string>) => {
      const panel = state.panels[action.payload];
      if (panel) {
        panel.isCollapsed = !panel.isCollapsed;
      }
    },

    setPanelCollapsed: (state, action: PayloadAction<{ id: string; collapsed: boolean }>) => {
      const panel = state.panels[action.payload.id];
      if (panel) {
        panel.isCollapsed = action.payload.collapsed;
      }
    },

    floatPanel: (state, action: PayloadAction<string>) => {
      if (!state.floatingPanels.includes(action.payload)) {
        state.floatingPanels.push(action.payload);
        state.dockedPanels = state.dockedPanels.filter((id) => id !== action.payload);
      }
    },

    dockPanel: (state, action: PayloadAction<string>) => {
      if (!state.dockedPanels.includes(action.payload)) {
        state.dockedPanels.push(action.payload);
        state.floatingPanels = state.floatingPanels.filter((id) => id !== action.payload);
      }
    },

    // View mode actions
    setViewMode: (state, action: PayloadAction<{ section: string; mode: ViewMode }>) => {
      state.viewModes[action.payload.section] = action.payload.mode;
    },

    setGridColumns: (state, action: PayloadAction<{ section: string; columns: number }>) => {
      state.gridColumns[action.payload.section] = action.payload.columns;
    },

    setItemsPerPage: (state, action: PayloadAction<{ section: string; count: number }>) => {
      state.itemsPerPage[action.payload.section] = action.payload.count;
    },

    // Responsive actions
    setBreakpoint: (state, action: PayloadAction<LayoutState['breakpoint']>) => {
      state.breakpoint = action.payload;

      // Auto-collapse panels on mobile
      if (action.payload === 'mobile') {
        Object.keys(state.panels).forEach((key) => {
          state.panels[key].isCollapsed = true;
        });
        state.isMobileMenuOpen = false;
      }
    },

    toggleMobileMenu: (state) => {
      state.isMobileMenuOpen = !state.isMobileMenuOpen;
    },

    setMobileMenuOpen: (state, action: PayloadAction<boolean>) => {
      state.isMobileMenuOpen = action.payload;
    },

    // Split view actions
    setSplitRatio: (state, action: PayloadAction<number>) => {
      state.splitRatio = Math.max(10, Math.min(90, action.payload));
    },

    setSplitOrientation: (state, action: PayloadAction<'horizontal' | 'vertical'>) => {
      state.splitOrientation = action.payload;
    },

    // Focus mode actions
    toggleFocusMode: (state) => {
      state.focusModeEnabled = !state.focusModeEnabled;
      if (state.focusModeEnabled) {
        // Collapse all panels in focus mode
        Object.keys(state.panels).forEach((key) => {
          state.panels[key].isCollapsed = true;
        });
      }
    },

    toggleZenMode: (state) => {
      state.zenModeEnabled = !state.zenModeEnabled;
      if (state.zenModeEnabled) {
        state.focusModeEnabled = true;
        // Hide everything except content
        Object.keys(state.panels).forEach((key) => {
          state.panels[key].isCollapsed = true;
        });
      }
    },

    // Persistence actions
    saveLayoutToStorage: (state) => {
      if (typeof window !== 'undefined') {
        const layoutData = {
          workspaceLayout: state.workspaceLayout,
          panels: state.panels,
          viewModes: state.viewModes,
          gridColumns: state.gridColumns,
          itemsPerPage: state.itemsPerPage,
          splitRatio: state.splitRatio,
          splitOrientation: state.splitOrientation,
        };
        localStorage.setItem('layout-preferences', JSON.stringify(layoutData));
      }
    },

    loadLayoutFromStorage: (state) => {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('layout-preferences');
        if (saved) {
          try {
            const layoutData = JSON.parse(saved);
            Object.assign(state, layoutData);
          } catch (e) {
            console.error('Failed to load layout preferences');
          }
        }
      }
    },

    resetLayout: (state) => {
      Object.assign(state, initialState);
    },
  },
});

// Export actions
export const {
  setWorkspaceLayout,
  resizePanel,
  togglePanel,
  setPanelCollapsed,
  floatPanel,
  dockPanel,
  setViewMode,
  setGridColumns,
  setItemsPerPage,
  setBreakpoint,
  toggleMobileMenu,
  setMobileMenuOpen,
  setSplitRatio,
  setSplitOrientation,
  toggleFocusMode,
  toggleZenMode,
  saveLayoutToStorage,
  loadLayoutFromStorage,
  resetLayout,
} = layoutSlice.actions;

// Selectors
export const selectWorkspaceLayout = (state: { layout: LayoutState }) =>
  state.layout.workspaceLayout;

export const selectPanel = (id: string) => (state: { layout: LayoutState }) =>
  state.layout.panels[id];

export const selectViewMode = (section: string) => (state: { layout: LayoutState }) =>
  state.layout.viewModes[section] || 'list';

export const selectBreakpoint = (state: { layout: LayoutState }) => state.layout.breakpoint;

export const selectIsMobile = (state: { layout: LayoutState }) =>
  state.layout.breakpoint === 'mobile';

export const selectIsTablet = (state: { layout: LayoutState }) =>
  state.layout.breakpoint === 'tablet';

export const selectFocusMode = (state: { layout: LayoutState }) => state.layout.focusModeEnabled;

export const selectZenMode = (state: { layout: LayoutState }) => state.layout.zenModeEnabled;

export default layoutSlice.reducer;
