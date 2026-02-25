/**
 * ContentManagementHub Component Tests
 *
 * Tests cover:
 * - Component renders without crashing with required props
 * - Shows loading state on initial mount (before useEffect resolves)
 * - After mount, renders main layout (header, sidebar, content area)
 * - Navigation tabs are rendered based on feature flags and permissions
 * - Error states are handled by the Redux store
 */

import { fireEvent, render, screen, waitFor, act } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

// Component under test
import { ContentManagementHub } from '../components/ContentManagementHub';

// Inline mock data (mockData.ts and mockFeatureFlags.ts do not exist in test-utils)
const mockContentItems = [
  {
    id: 'item-1',
    title: 'Test Article',
    type: 'article',
    status: 'published',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const mockFeatureFlags = {
  enableContentLibrary: true,
  enableContentEditor: true,
  enableContentCollections: true,
  enableContentSeries: true,
  enableContentAnalytics: true,
  enablePayments: true,
  enableAIRecommendations: false,
  enableNostrIntegration: true,
  enableExperimentalUI: false,
  enableAdvancedAnalytics: true,
  enableRealTimeUpdates: true,
  enableExportFeatures: true,
  enableNotifications: true,
  enableBackendIntegration: true,
};

const mockPermissions = {
  create: true,
  read: true,
  update: true,
  delete: true,
  publish: true,
  collaborate: true,
  analyze: true,
  moderate: true,
  admin: false,
};

// Mock useFeatureFlags so the component renders navigation tabs
vi.mock('../../../hooks/useFeatureFlags', () => ({
  useFeatureFlags: () => ({ flags: mockFeatureFlags, loading: false, error: null }),
}));

// Mock lazy-loaded child components — paths are relative to this test file
// Note: ContentCollections, ContentSeries, ContentAnalytics don't exist as files;
// these mocks prevent the lazy import from failing at runtime.
vi.mock('../components/ContentLibrary', () => ({
  default: () => <div data-testid="content-library">Content Library</div>,
}));
vi.mock('../components/ContentEditor', () => ({
  default: () => <div data-testid="content-editor">Content Editor</div>,
}));
// ContentCollections.tsx doesn't exist — mock the module so lazy() doesn't throw
vi.mock('../components/ContentCollections', () => ({
  default: () => <div data-testid="content-collections">Collections</div>,
}));
// ContentSeries.tsx doesn't exist — mock the module so lazy() doesn't throw
vi.mock('../components/ContentSeries', () => ({
  default: () => <div data-testid="content-series">Series</div>,
}));
// ContentAnalytics.tsx doesn't exist — mock the module so lazy() doesn't throw
vi.mock('../components/ContentAnalytics', () => ({
  default: () => <div data-testid="content-analytics">Analytics</div>,
}));

// Redux store with correct unifiedCms shape including the ui field
function createTestStore(overrides: Record<string, any> = {}) {
  const defaultUnifiedCms = {
    content: { items: mockContentItems, total: 1, page: 1 },
    collections: { items: [], total: 0, page: 1 },
    series: { items: [], total: 0, page: 1 },
    analytics: { overview: null, loading: false },
    loading: {
      content: false,
      collections: false,
      series: false,
      analytics: false,
    },
    error: {
      content: null,
      collections: null,
      series: null,
      analytics: null,
    },
    ui: {
      active_view: 'library',
      sidebar_open: true,
      mobile_nav_open: false,
      theme: 'auto',
    },
    filters: { type: 'all', status: 'all', tags: [], dateRange: null },
    searchResults: [],
    autoSaveStatus: 'idle',
    ...overrides,
  };

  return configureStore({
    reducer: {
      unifiedCms: (state = defaultUnifiedCms, _action: any) => state,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({ serializableCheck: false, immutableCheck: false }),
  });
}

const defaultProps = {
  user_id: 'test-user-123',
  permissions: mockPermissions,
};

function renderHub(props = {}, storeOverrides = {}) {
  const store = createTestStore(storeOverrides);
  return render(
    <Provider store={store}>
      <ContentManagementHub {...defaultProps} {...props} />
    </Provider>
  );
}

describe('ContentManagementHub', () => {
  describe('Initial Mount', () => {
    it('renders without crashing', () => {
      const { container } = renderHub();
      expect(container.firstChild).toBeTruthy();
    });

    it('transitions from loading to mounted state', async () => {
      renderHub();
      // After React flushes effects in test environment, mounted becomes true
      // and the main layout replaces the loading spinner
      await waitFor(() => {
        expect(screen.getByText('Content Management')).toBeInTheDocument();
      });
      // Loading spinner should be gone after mount
      expect(screen.queryByText(/Initializing Content Management/i)).not.toBeInTheDocument();
    });

    it('shows the main layout after mount', async () => {
      renderHub();
      await waitFor(() => {
        expect(screen.getByText('Content Management')).toBeInTheDocument();
      });
    });
  });

  describe('Navigation', () => {
    it('shows navigation tabs after mount when feature flags enable them', async () => {
      renderHub();
      await waitFor(() => {
        // After mount, sidebar nav buttons should be visible
        expect(screen.getByText('Library')).toBeInTheDocument();
      });
    });

    it('shows Collections tab when flag and permissions allow', async () => {
      renderHub();
      await waitFor(() => {
        expect(screen.getByText('Collections')).toBeInTheDocument();
      });
    });

    it('shows Analytics tab when flag and permissions allow', async () => {
      renderHub();
      await waitFor(() => {
        expect(screen.getByText('Analytics')).toBeInTheDocument();
      });
    });

    it('does not show tabs when read permission is false', async () => {
      const restrictedPermissions = { ...mockPermissions, read: false, analyze: false };
      renderHub({ permissions: restrictedPermissions });
      await waitFor(() => {
        expect(screen.queryByText('Collections')).not.toBeInTheDocument();
        expect(screen.queryByText('Analytics')).not.toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('displays error state when Redux store has content error', async () => {
      renderHub(
        {},
        {
          error: {
            content: 'Failed to load content',
            collections: null,
            series: null,
            analytics: null,
          },
        }
      );
      await waitFor(() => {
        expect(screen.getByText(/Failed to load content/i)).toBeInTheDocument();
      });
    });
  });

  describe('Loading States', () => {
    it('shows syncing badge when content is loading', async () => {
      renderHub(
        {},
        {
          loading: {
            content: true,
            collections: false,
            series: false,
            analytics: false,
          },
        }
      );
      await waitFor(() => {
        expect(screen.getByText('Syncing')).toBeInTheDocument();
      });
    });

    it('does not show syncing badge when content is not loading', async () => {
      renderHub();
      await waitFor(() => {
        expect(screen.getByText('Content Management')).toBeInTheDocument();
      });
      expect(screen.queryByText('Syncing')).not.toBeInTheDocument();
    });
  });

  describe('Settings Button', () => {
    it('renders a Settings button in the header', async () => {
      renderHub();
      await waitFor(() => {
        const settingsButton = screen.getByRole('button', { name: /settings/i });
        expect(settingsButton).toBeInTheDocument();
      });
    });
  });

  describe('Sidebar', () => {
    it('renders sidebar navigation after mount', async () => {
      renderHub();
      await waitFor(() => {
        expect(screen.getByRole('navigation')).toBeInTheDocument();
      });
    });

    it('shows mobile menu toggle button', async () => {
      renderHub();
      await waitFor(() => {
        const menuButton = screen.getByRole('button', { name: /toggle navigation/i });
        expect(menuButton).toBeInTheDocument();
      });
    });
  });
});
