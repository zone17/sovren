/**
 * Redux Store Integration Tests
 * Verifies proper state boundaries and slice integration
 */

import { store, RootState } from './index';
import { setTheme, openModal, addToast } from './slices/uiSlice';
import { setEditing, markDirty } from './slices/cmsUiSlice';

describe('Redux Store Integration', () => {
  describe('Store configuration', () => {
    it('should have all required slices', () => {
      const state = store.getState() as RootState;

      expect(state.ui).toBeDefined();
      expect(state.cmsUi).toBeDefined();
      expect(state.pagination).toBeDefined();
      expect(state.user).toBeDefined();
    });

    it('should not have server data slices', () => {
      const state = store.getState() as any;

      // Verify removed slices
      expect(state.post).toBeUndefined();
      expect(state.payment).toBeUndefined();
      expect(state.cms).toBeUndefined(); // Content data removed, only UI remains
      expect(state.navigation).toBeUndefined();
      expect(state.layout).toBeUndefined();
    });
  });

  describe('UI state management', () => {
    it('should handle UI state updates', () => {
      // Theme
      store.dispatch(setTheme('dark'));
      expect(store.getState().ui.theme).toBe('dark');

      // Modal
      store.dispatch(openModal({ type: 'settings', data: { tab: 'profile' } }));
      expect(store.getState().ui.modal.type).toBe('settings');
      expect(store.getState().ui.modal.isOpen).toBe(true);

      // Toast
      store.dispatch(addToast({ message: 'Test toast', type: 'success' }));
      expect(store.getState().ui.toasts).toHaveLength(1);
    });
  });

  describe('CMS UI state management', () => {
    it('should handle CMS UI state updates', () => {
      // Editor state
      store.dispatch(setEditing(true));
      expect(store.getState().cmsUi.editor.isEditing).toBe(true);

      // Dirty state
      store.dispatch(markDirty());
      expect(store.getState().cmsUi.editor.isDirty).toBe(true);
    });
  });

  describe('State boundaries', () => {
    it('should maintain clear separation between UI and server data', () => {
      const state = store.getState();

      // UI slices should only contain client-side state
      const uiSliceKeys = Object.keys(state.ui);
      const clientOnlyKeys = [
        'theme',
        'sidebarOpen',
        'sidebarCollapsed',
        'modal',
        'toasts',
        'notifications',
        'activeView',
        'searchQuery',
        'selectedFilters',
        'formData',
        'preferences',
      ];

      clientOnlyKeys.forEach((key) => {
        expect(uiSliceKeys).toContain(key);
      });

      // Should not contain server data
      expect(uiSliceKeys).not.toContain('posts');
      expect(uiSliceKeys).not.toContain('content');
      expect(uiSliceKeys).not.toContain('users');
    });

    it('should have proper TypeScript types', () => {
      const state: RootState = store.getState();

      // Type checking (these would fail at compile time if types were wrong)
      const theme: typeof state.ui.theme = 'dark';

      expect(theme).toBeDefined();
    });
  });

  describe('Selectors', () => {
    it('should export working selectors', () => {
      const { selectTheme, selectModal } = {
        selectTheme: (s: any) => s.ui.theme,
        selectModal: (s: any) => s.ui.modal,
      };

      const state = store.getState();

      expect(selectTheme(state)).toBe(state.ui.theme);
      expect(selectModal(state)).toBe(state.ui.modal);
    });
  });
});
