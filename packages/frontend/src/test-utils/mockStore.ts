/**
 * 🧪 **MOCK STORE UTILITY**
 *
 * Elite Engineering Standards:
 * ✅ Configurable Redux store for testing
 * ✅ Type-safe mock implementations
 * ✅ Realistic state structures
 * ✅ Action dispatch tracking
 */

import type { DeepPartial } from '@reduxjs/toolkit';
import { configureStore } from '@reduxjs/toolkit';

// Mock slice reducers
const mockUnifiedCmsSlice = {
  name: 'unifiedCms',
  reducer: (state: any = {}, action: any) => state,
  actions: {},
};

const mockUserSlice = {
  name: 'user',
  reducer: (state: any = {}, action: any) => state,
  actions: {},
};

const mockPostSlice = {
  name: 'post',
  reducer: (state: any = {}, action: any) => state,
  actions: {},
};

const mockPaymentSlice = {
  name: 'payment',
  reducer: (state: any = {}, action: any) => state,
  actions: {},
};

const mockCmsSlice = {
  name: 'cms',
  reducer: (state: any = {}, action: any) => state,
  actions: {},
};

// Default state structure
const defaultState = {
  unifiedCms: {
    contentItems: [],
    collections: [],
    series: [],
    analytics: {
      totalViews: 0,
      totalLikes: 0,
      totalComments: 0,
      engagement_rate: 0,
    },
    searchResults: [],
    isLoading: false,
    error: null,
    filters: {
      type: 'all',
      status: 'all',
      tags: [],
      dateRange: null,
    },
    editorState: {
      mode: 'view' as const,
      current_content: null,
      is_dirty: false,
      auto_save_enabled: true,
      auto_save_interval: 30000,
      last_saved: null,
      collaborative_mode: false,
      collaborators: [],
      suggested_improvements: [],
    },
    autoSaveStatus: 'idle' as const,
  },
  user: {
    currentUser: null,
    isAuthenticated: false,
    loading: false,
    error: null,
  },
  post: {
    posts: [],
    loading: false,
    error: null,
  },
  payment: {
    transactions: [],
    loading: false,
    error: null,
  },
  cms: {
    current_content: null,
    editor_state: {
      mode: 'view' as const,
      current_content: null,
      is_dirty: false,
      auto_save_enabled: true,
      auto_save_interval: 30000,
      last_saved: null,
      collaborative_mode: false,
      collaborators: [],
      suggested_improvements: [],
    },
  },
};

export type MockStoreState = typeof defaultState;

export function createMockStore(initialState: DeepPartial<MockStoreState> = {}) {
  const mergedState = {
    ...defaultState,
    ...initialState,
    unifiedCms: {
      ...defaultState.unifiedCms,
      ...initialState.unifiedCms,
    },
    user: {
      ...defaultState.user,
      ...initialState.user,
    },
    post: {
      ...defaultState.post,
      ...initialState.post,
    },
    payment: {
      ...defaultState.payment,
      ...initialState.payment,
    },
    cms: {
      ...defaultState.cms,
      ...initialState.cms,
    },
  };

  const mockDispatch = jest.fn().mockImplementation((action) => {
    // For async thunks, return a promise-like object
    if (typeof action === 'function') {
      return action(mockDispatch, () => mergedState, undefined);
    }

    // For regular actions, return the action with additional promise methods
    return {
      ...action,
      unwrap: jest.fn().mockResolvedValue(action.payload || {}),
      abort: jest.fn(),
      requestId: 'mock-request-id',
      meta: {
        requestId: 'mock-request-id',
        requestStatus: 'fulfilled',
      },
    };
  });

  const store = configureStore({
    reducer: {
      unifiedCms: mockUnifiedCmsSlice.reducer,
      user: mockUserSlice.reducer,
      post: mockPostSlice.reducer,
      payment: mockPaymentSlice.reducer,
      cms: mockCmsSlice.reducer,
    },
    preloadedState: mergedState as any,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: false,
        immutableCheck: false,
      }),
  });

  // Override dispatch with our mock
  store.dispatch = mockDispatch;

  return store;
}
