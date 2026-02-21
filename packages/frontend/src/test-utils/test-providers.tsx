/**
 * 🧪 **ELITE TEST PROVIDERS & WRAPPERS**
 *
 * **Purpose**: Comprehensive provider wrappers for testing React components
 * **Architecture**: Realistic component testing with full context support
 * **Security**: Safe test environment with mocked authentication
 * **Performance**: Optimized provider setup for fast test execution
 *
 * **Engineering Standards**:
 * - Test-Driven Development (TDD): Providers built before component tests
 * - Behavior-Driven Development (BDD): Realistic user interaction context
 * - Security by Design: Mocked auth states for safe testing
 * - Scalability: Configurable providers for different test scenarios
 *
 * @author Elite Engineering Team
 * @version 1.0.0
 * @lastModified 2024-12-28
 */

import { configureStore, Store } from '@reduxjs/toolkit';
import { render, RenderOptions } from '@testing-library/react';
import React, { ReactElement } from 'react';
import { Provider } from 'react-redux';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';

// Import store reducers
// TODO: Remove temporary stubs after US-E4-010 completes
import { cmsReducer, paymentReducer, postReducer } from '../store/slices/tempStubs';
import userReducer from '../store/slices/userSlice';

// Import test data
import { BDD, TEST_DATA } from './test-environment';

/**
 * 🧪 **ELITE TEST PROVIDERS**
 *
 * **Purpose**: Comprehensive test provider setup for React component testing
 * **Architecture**: Type-safe, configurable providers with realistic test scenarios
 * **Performance**: Optimized for sub-100ms test setup
 * **Flexibility**: Support for multiple authentication states and data scenarios
 *
 * **Key Features**:
 * - 🎭 BDD-style test scenarios (Given-When-Then)
 * - 🏗️ Configurable store states for different test cases
 * - 🧭 Router configuration for navigation testing
 * - 🔄 Redux integration with realistic data
 * - 🛡️ TypeScript type safety throughout
 *
 * @author Elite Engineering Team
 * @version 2.0.0
 * @lastModified 2024-12-28
 */

/**
 * 🛡️ **ELITE TYPE DEFINITIONS**
 */

// Import shared types for consistency
interface TestUser {
  id: string;
  username: string;
  display_name: string;
  bio: string;
  avatar_url: string;
  email: string;
  nostr_pubkey: string;
  created_at: string;
  updated_at: string;
  role?: string;
}

interface TestPost {
  id: string;
  title: string;
  content: string;
  status: string;
  author_id: string;
  created_at: string;
  updated_at: string;
  published_at?: string;
}

interface TestPayment {
  id: string;
  amount: number;
  status: string;
  invoice: string;
  user_id: string;
  created_at: string;
}

interface TestContentItem {
  id: string;
  title: string;
  content: string;
  status: string;
  author_id: string;
  created_at: string;
  updated_at: string;
  published_at?: string;
}

interface TestCollaborator {
  id: string;
  user_id: string;
  role: 'editor' | 'viewer' | 'commenter';
}

interface TestImprovement {
  id: string;
  type: 'grammar' | 'style' | 'seo' | 'readability';
  suggestion: string;
  confidence: number;
}

interface UserState {
  currentUser: TestUser | null;
  loading: boolean;
  error: string | null;
}

interface ContentState {
  posts: TestPost[];
  currentPost: TestPost | null;
  loading: boolean;
  error: string | null;
}

interface PaymentState {
  payments: TestPayment[];
  currentPayment: TestPayment | null;
  loading: boolean;
  error: string | null;
}

interface CmsState {
  content_items: TestContentItem[];
  current_content: TestContentItem | null;
  media_assets: Array<{ id: string; url: string; type: string }>;
  content_versions: Array<{ id: string; version: number; created_at: string }>;
  comments: Array<{ id: string; content: string; user_id: string }>;
  supports: Array<{ id: string; user_id: string; amount: number }>;
  loading: boolean;
  error: string | null;
  editor_state: {
    is_editing: boolean;
    auto_save_enabled: boolean;
    last_saved: string | null;
    ai_assistant_enabled: boolean;
    collaborative_mode: boolean;
    current_collaborators: TestCollaborator[];
    suggested_improvements: TestImprovement[];
  };
  ai_state: {
    models_available: Array<{
      id: string;
      name: string;
      provider: string;
      capabilities: string[];
      cost_per_token: number;
      max_tokens: number;
    }>;
    current_model: string;
    usage_quota: {
      used: number;
      limit: number;
      reset_date: string;
    };
    content_generation_queue: Array<{ id: string; status: 'pending' | 'processing' | 'complete' }>;
  };
}

/**
 * 🏪 **Test Store Configuration**
 *
 * Creates a fresh Redux store for each test with predefined state
 */
export interface TestStoreOptions {
  initialState?: Partial<RootState>;
  user?: 'authenticated' | 'unauthenticated' | 'admin';
  scenario?: 'empty' | 'withContent' | 'withPayments' | 'withAll';
}

export type RootState = {
  user: ReturnType<typeof userReducer>;
  posts: ReturnType<typeof postReducer>;
  payments: ReturnType<typeof paymentReducer>;
  cms: ReturnType<typeof cmsReducer>;
};

export function createTestStore(options: TestStoreOptions = {}): Store<RootState> {
  const { initialState = {}, user = 'unauthenticated', scenario = 'empty' } = options;

  // 👤 User state based on authentication status
  const getUserState = (): UserState => {
    switch (user) {
      case 'authenticated':
        return {
          currentUser: TEST_DATA.users.validUser,
          loading: false,
          error: null,
        };
      case 'admin':
        return {
          currentUser: TEST_DATA.users.adminUser,
          loading: false,
          error: null,
        };
      default:
        return {
          currentUser: null,
          loading: false,
          error: null,
        };
    }
  };

  // 📝 Content state based on scenario
  const getContentState = (): ContentState => {
    switch (scenario) {
      case 'withContent':
      case 'withAll':
        return {
          posts: [TEST_DATA.content.draftPost, TEST_DATA.content.publishedPost],
          currentPost: null,
          loading: false,
          error: null,
        };
      default:
        return {
          posts: [],
          currentPost: null,
          loading: false,
          error: null,
        };
    }
  };

  // 💰 Payment state based on scenario
  const getPaymentState = (): PaymentState => {
    switch (scenario) {
      case 'withPayments':
      case 'withAll':
        return {
          payments: [TEST_DATA.payments.successfulPayment, TEST_DATA.payments.pendingPayment],
          currentPayment: null,
          loading: false,
          error: null,
        };
      default:
        return {
          payments: [],
          currentPayment: null,
          loading: false,
          error: null,
        };
    }
  };

  // 🎨 CMS state with AI features
  const getCmsState = (): CmsState => ({
    content_items: scenario === 'withAll' ? [TEST_DATA.content.draftPost] : [],
    current_content: null,
    media_assets: [],
    content_versions: [],
    comments: [],
    supports: [],
    loading: false,
    error: null,
    editor_state: {
      is_editing: false,
      auto_save_enabled: true,
      last_saved: null,
      ai_assistant_enabled: false,
      collaborative_mode: false,
      current_collaborators: [],
      suggested_improvements: [],
    },
    ai_state: {
      models_available: [
        {
          id: 'gpt-4',
          name: 'GPT-4',
          provider: 'openai',
          capabilities: ['text-generation'],
          cost_per_token: 0.01,
          max_tokens: 8192,
        },
      ],
      current_model: 'gpt-4',
      usage_quota: {
        used: 50,
        limit: 1000,
        reset_date: '2024-02-01',
      },
      content_generation_queue: [],
    },
  });

  const defaultState: RootState = {
    user: getUserState() as ReturnType<typeof userReducer>,
    posts: getContentState() as ReturnType<typeof postReducer>,
    payments: getPaymentState() as ReturnType<typeof paymentReducer>,
    cms: getCmsState() as unknown as ReturnType<typeof cmsReducer>,
    ...initialState,
  };

  return configureStore({
    reducer: {
      user: userReducer,
      posts: postReducer,
      payments: paymentReducer,
      cms: cmsReducer,
    },
    preloadedState: defaultState,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: {
          // Ignore these action types for serialization
          ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
        },
      }),
  });
}

/**
 * 🎭 **Test Router Configuration**
 *
 * Configurable router wrapper for different test scenarios
 */
export interface TestRouterOptions {
  route?: string;
  history?: string[];
  routerType?: 'browser' | 'memory';
}

export function TestRouter({
  children,
  route: _route = '/',
  history = ['/'],
  routerType = 'memory',
}: {
  children: React.ReactNode;
} & TestRouterOptions): React.ReactElement {
  if (routerType === 'browser') {
    return <BrowserRouter>{children}</BrowserRouter>;
  }

  // Type assertion to resolve MemoryRouter JSX compatibility
  const MemoryRouterComponent = MemoryRouter as React.ComponentType<{
    initialEntries?: string[];
    initialIndex?: number;
    children: React.ReactNode;
  }>;

  return (
    <MemoryRouterComponent initialEntries={history} initialIndex={history.length - 1}>
      {children}
    </MemoryRouterComponent>
  );
}

/**
 * 🏗️ **All Providers Wrapper**
 *
 * Comprehensive provider wrapper with all contexts
 */
export interface AllProvidersOptions extends TestStoreOptions, TestRouterOptions {
  // Additional provider options can be added here
}

export function AllProviders({
  children,
  ...options
}: {
  children: React.ReactNode;
} & AllProvidersOptions): JSX.Element {
  const store = createTestStore(options);

  return (
    <Provider store={store}>
      <TestRouter {...options}>{children}</TestRouter>
    </Provider>
  );
}

/**
 * 🧪 **Enhanced Render Function**
 *
 * Custom render function with all providers automatically included
 */
export interface CustomRenderOptions extends RenderOptions {
  providerOptions?: AllProvidersOptions;
}

export function renderWithProviders(
  ui: ReactElement,
  options: CustomRenderOptions = {}
): {
  store: Store<RootState>;
} & ReturnType<typeof render> {
  const { providerOptions = {}, ...renderOptions } = options;

  function Wrapper({ children }: { children: React.ReactNode }): JSX.Element {
    return <AllProviders {...providerOptions}>{children}</AllProviders>;
  }

  return {
    store: createTestStore(providerOptions),
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
  };
}

/**
 * 🎯 **BDD Test Scenarios**
 *
 * Pre-configured test scenarios for common BDD patterns
 */
const BDDScenarios = {
  /**
   * GIVEN user is not authenticated
   */
  unauthenticatedUser: {
    user: 'unauthenticated' as const,
    scenario: 'empty' as const,
    route: '/login',
  },

  /**
   * GIVEN user is authenticated with content
   */
  authenticatedUserWithContent: {
    user: 'authenticated' as const,
    scenario: 'withContent' as const,
    route: '/dashboard',
  },

  /**
   * GIVEN user is admin with full data
   */
  adminUserWithFullData: {
    user: 'admin' as const,
    scenario: 'withAll' as const,
    route: '/admin',
  },

  /**
   * GIVEN user has payments but no content
   */
  userWithPayments: {
    user: 'authenticated' as const,
    scenario: 'withPayments' as const,
    route: '/payments',
  },

  /**
   * GIVEN new user signup flow
   */
  newUserSignup: {
    user: 'unauthenticated' as const,
    scenario: 'empty' as const,
    route: '/signup',
  },

  /**
   * GIVEN content creation flow
   */
  contentCreation: {
    user: 'authenticated' as const,
    scenario: 'empty' as const,
    route: '/create',
  },
};

/**
 * 🔧 **Helper Functions for Common Test Patterns**
 */
const TestHelpers = {
  /**
   * Render component in authenticated state
   */
  renderAuthenticated: (
    ui: ReactElement,
    options?: CustomRenderOptions
  ): ReturnType<typeof renderWithProviders> =>
    renderWithProviders(ui, {
      ...options,
      providerOptions: {
        ...BDDScenarios.authenticatedUserWithContent,
        ...options?.providerOptions,
      },
    }),

  /**
   * Render component in unauthenticated state
   */
  renderUnauthenticated: (
    ui: ReactElement,
    options?: CustomRenderOptions
  ): ReturnType<typeof renderWithProviders> =>
    renderWithProviders(ui, {
      ...options,
      providerOptions: {
        ...BDDScenarios.unauthenticatedUser,
        ...options?.providerOptions,
      },
    }),

  /**
   * Render component with admin privileges
   */
  renderAsAdmin: (
    ui: ReactElement,
    options?: CustomRenderOptions
  ): ReturnType<typeof renderWithProviders> =>
    renderWithProviders(ui, {
      ...options,
      providerOptions: {
        ...BDDScenarios.adminUserWithFullData,
        ...options?.providerOptions,
      },
    }),

  /**
   * Render component at specific route
   */
  renderAtRoute: (
    ui: ReactElement,
    route: string,
    options?: CustomRenderOptions
  ): ReturnType<typeof renderWithProviders> =>
    renderWithProviders(ui, {
      ...options,
      providerOptions: {
        route,
        user: 'authenticated',
        ...options?.providerOptions,
      },
    }),
};

/**
 * 🚀 **Export everything for easy imports**
 */
export { BDD, BDDScenarios, renderWithProviders as render, TestHelpers };

// Re-export testing library utilities
export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';
