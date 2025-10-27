/**
 * UI State Slice Tests
 * Following TDD principles and Elite Engineering Standards
 */

import uiReducer, {
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
  type UIState,
  type Theme,
  type Toast,
  type Notification,
} from './uiSlice';

describe('uiSlice', () => {
  const getInitialState = (): UIState => ({
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
  });

  describe('Theme actions', () => {
    it('should handle setTheme', () => {
      const state = uiReducer(getInitialState(), setTheme('dark'));
      expect(state.theme).toBe('dark');
    });

    it('should handle all theme values', () => {
      const themes: Theme[] = ['light', 'dark', 'system'];
      themes.forEach(theme => {
        const state = uiReducer(getInitialState(), setTheme(theme));
        expect(state.theme).toBe(theme);
      });
    });
  });

  describe('Sidebar actions', () => {
    it('should handle toggleSidebar', () => {
      let state = uiReducer(getInitialState(), toggleSidebar());
      expect(state.sidebarOpen).toBe(false);

      state = uiReducer(state, toggleSidebar());
      expect(state.sidebarOpen).toBe(true);
    });

    it('should handle setSidebarOpen', () => {
      const state = uiReducer(getInitialState(), setSidebarOpen(false));
      expect(state.sidebarOpen).toBe(false);
    });

    it('should handle setSidebarCollapsed', () => {
      const state = uiReducer(getInitialState(), setSidebarCollapsed(true));
      expect(state.sidebarCollapsed).toBe(true);
    });
  });

  describe('Modal actions', () => {
    it('should handle openModal', () => {
      const modalData = { id: '123', title: 'Test Modal' };
      const state = uiReducer(
        getInitialState(),
        openModal({ type: 'payment', data: modalData })
      );

      expect(state.modal.type).toBe('payment');
      expect(state.modal.data).toEqual(modalData);
      expect(state.modal.isOpen).toBe(true);
    });

    it('should handle closeModal', () => {
      let state = uiReducer(
        getInitialState(),
        openModal({ type: 'settings', data: null })
      );
      state = uiReducer(state, closeModal());

      expect(state.modal.type).toBe(null);
      expect(state.modal.data).toBe(null);
      expect(state.modal.isOpen).toBe(false);
    });
  });

  describe('Toast actions', () => {
    it('should handle addToast', () => {
      const toastData: Omit<Toast, 'id' | 'createdAt'> = {
        message: 'Test toast',
        type: 'success',
        duration: 3000,
      };

      const state = uiReducer(getInitialState(), addToast(toastData));

      expect(state.toasts).toHaveLength(1);
      expect(state.toasts[0].message).toBe('Test toast');
      expect(state.toasts[0].type).toBe('success');
      expect(state.toasts[0].id).toBeDefined();
      expect(state.toasts[0].createdAt).toBeDefined();
    });

    it('should handle removeToast', () => {
      let state = uiReducer(
        getInitialState(),
        addToast({ message: 'Toast 1', type: 'info' })
      );
      const toastId = state.toasts[0].id;

      state = uiReducer(state, removeToast(toastId));
      expect(state.toasts).toHaveLength(0);
    });

    it('should handle clearToasts', () => {
      let state = getInitialState();
      state = uiReducer(state, addToast({ message: 'Toast 1', type: 'info' }));
      state = uiReducer(state, addToast({ message: 'Toast 2', type: 'error' }));

      state = uiReducer(state, clearToasts());
      expect(state.toasts).toHaveLength(0);
    });
  });

  describe('Notification actions', () => {
    it('should handle addNotification', () => {
      const notifData: Omit<Notification, 'id' | 'createdAt' | 'read'> = {
        title: 'Test Notification',
        message: 'This is a test',
        type: 'info',
        actionUrl: '/action',
      };

      const state = uiReducer(getInitialState(), addNotification(notifData));

      expect(state.notifications).toHaveLength(1);
      expect(state.notifications[0].title).toBe('Test Notification');
      expect(state.notifications[0].read).toBe(false);
      expect(state.notifications[0].id).toBeDefined();
    });

    it('should handle markNotificationRead', () => {
      let state = uiReducer(
        getInitialState(),
        addNotification({ title: 'Test', message: 'Test', type: 'info' })
      );
      const notifId = state.notifications[0].id;

      state = uiReducer(state, markNotificationRead(notifId));
      expect(state.notifications[0].read).toBe(true);
    });

    it('should handle markAllNotificationsRead', () => {
      let state = getInitialState();
      state = uiReducer(
        state,
        addNotification({ title: 'Test 1', message: 'Test 1', type: 'info' })
      );
      state = uiReducer(
        state,
        addNotification({ title: 'Test 2', message: 'Test 2', type: 'warning' })
      );

      state = uiReducer(state, markAllNotificationsRead());
      expect(state.notifications.every(n => n.read)).toBe(true);
    });

    it('should handle removeNotification', () => {
      let state = uiReducer(
        getInitialState(),
        addNotification({ title: 'Test', message: 'Test', type: 'info' })
      );
      const notifId = state.notifications[0].id;

      state = uiReducer(state, removeNotification(notifId));
      expect(state.notifications).toHaveLength(0);
    });

    it('should handle clearNotifications', () => {
      let state = getInitialState();
      state = uiReducer(
        state,
        addNotification({ title: 'Test 1', message: 'Test 1', type: 'info' })
      );
      state = uiReducer(
        state,
        addNotification({ title: 'Test 2', message: 'Test 2', type: 'warning' })
      );

      state = uiReducer(state, clearNotifications());
      expect(state.notifications).toHaveLength(0);
    });
  });

  describe('View and filter actions', () => {
    it('should handle setActiveView', () => {
      const state = uiReducer(getInitialState(), setActiveView('analytics'));
      expect(state.activeView).toBe('analytics');
    });

    it('should handle setSearchQuery', () => {
      const state = uiReducer(getInitialState(), setSearchQuery('test search'));
      expect(state.searchQuery).toBe('test search');
    });

    it('should handle setFilter', () => {
      const state = uiReducer(
        getInitialState(),
        setFilter({ key: 'category', value: 'video' })
      );
      expect(state.selectedFilters.category).toBe('video');
    });

    it('should handle clearFilter', () => {
      let state = uiReducer(
        getInitialState(),
        setFilter({ key: 'category', value: 'video' })
      );
      state = uiReducer(state, setFilter({ key: 'status', value: 'published' }));

      state = uiReducer(state, clearFilter('category'));
      expect(state.selectedFilters.category).toBeUndefined();
      expect(state.selectedFilters.status).toBe('published');
    });

    it('should handle clearAllFilters', () => {
      let state = uiReducer(
        getInitialState(),
        setFilter({ key: 'category', value: 'video' })
      );
      state = uiReducer(state, setFilter({ key: 'status', value: 'published' }));

      state = uiReducer(state, clearAllFilters());
      expect(state.selectedFilters).toEqual({});
    });
  });

  describe('Form data actions', () => {
    it('should handle setFormData', () => {
      const formData = { name: 'Test', email: 'test@example.com' };
      const state = uiReducer(
        getInitialState(),
        setFormData({ formId: 'signup', data: formData })
      );

      expect(state.formData.signup).toEqual(formData);
    });

    it('should handle updateFormField', () => {
      let state = uiReducer(
        getInitialState(),
        setFormData({ formId: 'signup', data: { name: 'Test' } })
      );

      state = uiReducer(
        state,
        updateFormField({ formId: 'signup', field: 'email', value: 'test@example.com' })
      );

      expect(state.formData.signup.email).toBe('test@example.com');
      expect(state.formData.signup.name).toBe('Test');
    });

    it('should handle updateFormField for new form', () => {
      const state = uiReducer(
        getInitialState(),
        updateFormField({ formId: 'newForm', field: 'field1', value: 'value1' })
      );

      expect(state.formData.newForm).toEqual({ field1: 'value1' });
    });

    it('should handle clearFormData', () => {
      let state = uiReducer(
        getInitialState(),
        setFormData({ formId: 'signup', data: { name: 'Test' } })
      );
      state = uiReducer(
        state,
        setFormData({ formId: 'login', data: { email: 'test@example.com' } })
      );

      state = uiReducer(state, clearFormData('signup'));
      expect(state.formData.signup).toBeUndefined();
      expect(state.formData.login).toBeDefined();
    });
  });

  describe('Preferences actions', () => {
    it('should handle updatePreferences', () => {
      const state = uiReducer(
        getInitialState(),
        updatePreferences({ autoPlay: false, compactMode: true })
      );

      expect(state.preferences.autoPlay).toBe(false);
      expect(state.preferences.compactMode).toBe(true);
      expect(state.preferences.soundEnabled).toBe(true); // Unchanged
    });

    it('should handle partial preference updates', () => {
      const state = uiReducer(
        getInitialState(),
        updatePreferences({ notificationsEnabled: false })
      );

      expect(state.preferences.notificationsEnabled).toBe(false);
      expect(state.preferences.autoPlay).toBe(true); // Unchanged
      expect(state.preferences.soundEnabled).toBe(true); // Unchanged
      expect(state.preferences.compactMode).toBe(false); // Unchanged
    });
  });
});