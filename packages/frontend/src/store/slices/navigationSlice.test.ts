/**
 * Navigation Slice Tests
 * Following TDD principles and Elite Engineering Standards
 */

import navigationReducer, {
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
  type NavigationState,
  type Breadcrumb,
  type Tab,
} from './navigationSlice';

describe('navigationSlice', () => {
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

  describe('Navigation actions', () => {
    it('should handle navigateTo', () => {
      const state = navigationReducer(initialState, navigateTo('/dashboard'));

      expect(state.currentPath).toBe('/dashboard');
      expect(state.previousPath).toBe('/');
      expect(state.navigationHistory).toContain('/dashboard');
      expect(state.isNavigating).toBe(false);
    });

    it('should maintain max 10 items in navigation history', () => {
      let state = initialState;

      // Navigate to 12 different paths
      for (let i = 1; i <= 12; i++) {
        state = navigationReducer(state, navigateTo(`/page-${i}`));
      }

      expect(state.navigationHistory.length).toBe(10);
      expect(state.navigationHistory[0]).toBe('/page-12');
      expect(state.navigationHistory[9]).toBe('/page-3');
    });

    it('should handle startNavigating and finishNavigating', () => {
      let state = navigationReducer(initialState, startNavigating());
      expect(state.isNavigating).toBe(true);

      state = navigationReducer(state, finishNavigating());
      expect(state.isNavigating).toBe(false);
    });

    it('should handle goBack', () => {
      let state = navigationReducer(initialState, navigateTo('/page1'));
      state = navigationReducer(state, navigateTo('/page2'));

      state = navigationReducer(state, goBack());
      expect(state.currentPath).toBe('/page1');
      expect(state.previousPath).toBe('/page2');
    });
  });

  describe('Breadcrumb actions', () => {
    const breadcrumb1: Breadcrumb = { label: 'Home', path: '/' };
    const breadcrumb2: Breadcrumb = { label: 'Dashboard', path: '/dashboard', icon: 'dashboard' };
    const breadcrumb3: Breadcrumb = { label: 'Settings', path: '/settings' };

    it('should handle setBreadcrumbs', () => {
      const state = navigationReducer(initialState, setBreadcrumbs([breadcrumb1, breadcrumb2]));

      expect(state.breadcrumbs).toHaveLength(2);
      expect(state.breadcrumbs[0]).toEqual(breadcrumb1);
      expect(state.breadcrumbs[1]).toEqual(breadcrumb2);
    });

    it('should handle addBreadcrumb', () => {
      let state = navigationReducer(initialState, setBreadcrumbs([breadcrumb1]));
      state = navigationReducer(state, addBreadcrumb(breadcrumb2));

      expect(state.breadcrumbs).toHaveLength(2);
      expect(state.breadcrumbs[1]).toEqual(breadcrumb2);
    });

    it('should handle removeBreadcrumb', () => {
      let state = navigationReducer(
        initialState,
        setBreadcrumbs([breadcrumb1, breadcrumb2, breadcrumb3])
      );

      state = navigationReducer(state, removeBreadcrumb(1));
      expect(state.breadcrumbs).toHaveLength(2);
      expect(state.breadcrumbs).toEqual([breadcrumb1, breadcrumb2]);
    });

    it('should handle clearBreadcrumbs', () => {
      let state = navigationReducer(initialState, setBreadcrumbs([breadcrumb1, breadcrumb2]));

      state = navigationReducer(state, clearBreadcrumbs());
      expect(state.breadcrumbs).toHaveLength(0);
    });
  });

  describe('Tab actions', () => {
    const tab1: Omit<Tab, 'isDirty'> = {
      id: 'tab1',
      label: 'Dashboard',
      path: '/dashboard',
      closable: true,
    };

    const tab2: Omit<Tab, 'isDirty'> = {
      id: 'tab2',
      label: 'Settings',
      path: '/settings',
      closable: true,
    };

    it('should handle addTab', () => {
      const state = navigationReducer(initialState, addTab(tab1));

      expect(state.tabs).toHaveLength(1);
      expect(state.tabs[0]).toEqual({ ...tab1, isDirty: false });
      expect(state.activeTabId).toBe('tab1');
    });

    it('should not duplicate tabs with same id', () => {
      let state = navigationReducer(initialState, addTab(tab1));
      state = navigationReducer(state, addTab(tab1));

      expect(state.tabs).toHaveLength(1);
    });

    it('should handle removeTab and update activeTabId', () => {
      let state = navigationReducer(initialState, addTab(tab1));
      state = navigationReducer(state, addTab(tab2));
      state = navigationReducer(state, setActiveTab('tab1'));

      state = navigationReducer(state, removeTab('tab1'));

      expect(state.tabs).toHaveLength(1);
      expect(state.activeTabId).toBe('tab2');
    });

    it('should handle setActiveTab', () => {
      let state = navigationReducer(initialState, addTab(tab1));
      state = navigationReducer(state, addTab(tab2));

      state = navigationReducer(state, setActiveTab('tab2'));
      expect(state.activeTabId).toBe('tab2');
    });

    it('should handle updateTabDirtyState', () => {
      let state = navigationReducer(initialState, addTab(tab1));

      state = navigationReducer(state, updateTabDirtyState({ id: 'tab1', isDirty: true }));
      expect(state.tabs[0].isDirty).toBe(true);
    });

    it('should handle clearTabs', () => {
      let state = navigationReducer(initialState, addTab(tab1));
      state = navigationReducer(state, addTab(tab2));

      state = navigationReducer(state, clearTabs());

      expect(state.tabs).toHaveLength(0);
      expect(state.activeTabId).toBe(null);
    });
  });

  describe('Scroll position actions', () => {
    it('should handle saveScrollPosition', () => {
      const state = navigationReducer(
        initialState,
        saveScrollPosition({ path: '/dashboard', position: 150 })
      );

      expect(state.scrollPositions['/dashboard']).toBe(150);
    });

    it('should handle clearScrollPosition', () => {
      let state = navigationReducer(
        initialState,
        saveScrollPosition({ path: '/dashboard', position: 150 })
      );

      state = navigationReducer(state, clearScrollPosition('/dashboard'));
      expect(state.scrollPositions['/dashboard']).toBeUndefined();
    });
  });

  describe('History actions', () => {
    it('should handle clearNavigationHistory', () => {
      let state = navigationReducer(initialState, navigateTo('/page1'));
      state = navigationReducer(state, navigateTo('/page2'));

      state = navigationReducer(state, clearNavigationHistory());
      expect(state.navigationHistory).toHaveLength(0);
    });
  });
});
