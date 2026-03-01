/**
 * Layout Slice Tests
 * Following TDD principles and Elite Engineering Standards
 */

import layoutReducer, {
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
  resetLayout,
  type LayoutState,
} from './layoutSlice';

describe('layoutSlice', () => {
  const getInitialState = (): LayoutState => ({
    workspaceLayout: 'default',
    panels: {
      sidebar: {
        id: 'sidebar',
        size: 260,
        minSize: 150,
        maxSize: 500,
        isCollapsed: false,
        isResizable: true,
        position: 'left',
      },
      rightPanel: {
        id: 'rightPanel',
        size: 320,
        minSize: 150,
        maxSize: 500,
        isCollapsed: true,
        isResizable: true,
        position: 'right',
      },
      bottomPanel: {
        id: 'bottomPanel',
        size: 200,
        minSize: 150,
        maxSize: 500,
        isCollapsed: true,
        isResizable: true,
        position: 'bottom',
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
  });

  describe('Workspace layout actions', () => {
    it('should handle setWorkspaceLayout to focus mode', () => {
      const state = layoutReducer(getInitialState(), setWorkspaceLayout('focus'));

      expect(state.workspaceLayout).toBe('focus');
      expect(state.panels.sidebar.isCollapsed).toBe(true);
      expect(state.panels.rightPanel.isCollapsed).toBe(true);
      expect(state.focusModeEnabled).toBe(true);
    });

    it('should handle setWorkspaceLayout to wide mode', () => {
      const state = layoutReducer(getInitialState(), setWorkspaceLayout('wide'));

      expect(state.workspaceLayout).toBe('wide');
      expect(state.panels.rightPanel.isCollapsed).toBe(true);
      expect(state.panels.sidebar.size).toBe(200);
    });

    it('should handle setWorkspaceLayout to split mode', () => {
      const state = layoutReducer(getInitialState(), setWorkspaceLayout('split'));

      expect(state.workspaceLayout).toBe('split');
      expect(state.splitOrientation).toBe('vertical');
      expect(state.splitRatio).toBe(50);
    });
  });

  describe('Panel actions', () => {
    it('should handle resizePanel within bounds', () => {
      const state = layoutReducer(getInitialState(), resizePanel({ id: 'sidebar', size: 300 }));

      expect(state.panels.sidebar.size).toBe(300);
    });

    it('should clamp panel size to min/max bounds', () => {
      let state = layoutReducer(getInitialState(), resizePanel({ id: 'sidebar', size: 100 }));
      expect(state.panels.sidebar.size).toBe(150); // minSize

      state = layoutReducer(getInitialState(), resizePanel({ id: 'sidebar', size: 600 }));
      expect(state.panels.sidebar.size).toBe(500); // maxSize
    });

    it('should handle togglePanel', () => {
      const initialState = getInitialState();
      const state = layoutReducer(initialState, togglePanel('sidebar'));

      expect(state.panels.sidebar.isCollapsed).toBe(true);
    });

    it('should handle setPanelCollapsed', () => {
      const state = layoutReducer(
        getInitialState(),
        setPanelCollapsed({ id: 'sidebar', collapsed: true })
      );

      expect(state.panels.sidebar.isCollapsed).toBe(true);
    });

    it('should handle floatPanel', () => {
      const state = layoutReducer(getInitialState(), floatPanel('sidebar'));

      expect(state.floatingPanels).toContain('sidebar');
      expect(state.dockedPanels).not.toContain('sidebar');
    });

    it('should handle dockPanel', () => {
      let state = layoutReducer(getInitialState(), floatPanel('sidebar'));
      state = layoutReducer(state, dockPanel('sidebar'));

      expect(state.dockedPanels).toContain('sidebar');
      expect(state.floatingPanels).not.toContain('sidebar');
    });
  });

  describe('View mode actions', () => {
    it('should handle setViewMode', () => {
      const state = layoutReducer(
        getInitialState(),
        setViewMode({ section: 'content', mode: 'list' })
      );

      expect(state.viewModes.content).toBe('list');
    });

    it('should handle setGridColumns', () => {
      const state = layoutReducer(
        getInitialState(),
        setGridColumns({ section: 'content', columns: 5 })
      );

      expect(state.gridColumns.content).toBe(5);
    });

    it('should handle setItemsPerPage', () => {
      const state = layoutReducer(
        getInitialState(),
        setItemsPerPage({ section: 'content', count: 24 })
      );

      expect(state.itemsPerPage.content).toBe(24);
    });
  });

  describe('Responsive actions', () => {
    it('should handle setBreakpoint to mobile', () => {
      const state = layoutReducer(getInitialState(), setBreakpoint('mobile'));

      expect(state.breakpoint).toBe('mobile');
      // All panels should be collapsed on mobile
      expect(state.panels.sidebar.isCollapsed).toBe(true);
      expect(state.panels.rightPanel.isCollapsed).toBe(true);
      expect(state.panels.bottomPanel.isCollapsed).toBe(true);
      expect(state.isMobileMenuOpen).toBe(false);
    });

    it('should handle toggleMobileMenu', () => {
      let state = layoutReducer(getInitialState(), setBreakpoint('mobile'));
      state = layoutReducer(state, toggleMobileMenu());

      expect(state.isMobileMenuOpen).toBe(true);

      state = layoutReducer(state, toggleMobileMenu());
      expect(state.isMobileMenuOpen).toBe(false);
    });

    it('should handle setMobileMenuOpen', () => {
      const state = layoutReducer(getInitialState(), setMobileMenuOpen(true));

      expect(state.isMobileMenuOpen).toBe(true);
    });
  });

  describe('Split view actions', () => {
    it('should handle setSplitRatio', () => {
      const state = layoutReducer(getInitialState(), setSplitRatio(75));

      expect(state.splitRatio).toBe(75);
    });

    it('should clamp split ratio to 10-90', () => {
      let state = layoutReducer(getInitialState(), setSplitRatio(5));
      expect(state.splitRatio).toBe(10);

      state = layoutReducer(getInitialState(), setSplitRatio(95));
      expect(state.splitRatio).toBe(90);
    });

    it('should handle setSplitOrientation', () => {
      const state = layoutReducer(getInitialState(), setSplitOrientation('horizontal'));

      expect(state.splitOrientation).toBe('horizontal');
    });
  });

  describe('Focus mode actions', () => {
    it('should handle toggleFocusMode', () => {
      let state = layoutReducer(getInitialState(), toggleFocusMode());

      expect(state.focusModeEnabled).toBe(true);
      // All panels should be collapsed
      expect(state.panels.sidebar.isCollapsed).toBe(true);
      expect(state.panels.rightPanel.isCollapsed).toBe(true);

      state = layoutReducer(state, toggleFocusMode());
      expect(state.focusModeEnabled).toBe(false);
    });

    it('should handle toggleZenMode', () => {
      let state = layoutReducer(getInitialState(), toggleZenMode());

      expect(state.zenModeEnabled).toBe(true);
      expect(state.focusModeEnabled).toBe(true);
      // All panels should be collapsed
      expect(state.panels.sidebar.isCollapsed).toBe(true);
      expect(state.panels.rightPanel.isCollapsed).toBe(true);
      expect(state.panels.bottomPanel.isCollapsed).toBe(true);

      state = layoutReducer(state, toggleZenMode());
      expect(state.zenModeEnabled).toBe(false);
    });
  });

  describe('Reset actions', () => {
    it('should handle resetLayout', () => {
      let state = layoutReducer(getInitialState(), setWorkspaceLayout('split'));
      state = layoutReducer(state, toggleFocusMode());
      state = layoutReducer(state, setViewMode({ section: 'content', mode: 'list' }));

      state = layoutReducer(state, resetLayout());

      expect(state.workspaceLayout).toBe('default');
      expect(state.focusModeEnabled).toBe(false);
      expect(state.viewModes.content).toBe('grid');
    });
  });
});
