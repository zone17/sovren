import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import OfflineCapabilities, {
  CacheManager,
  ServiceWorkerManager,
  SyncManager,
  useOfflineErrorHandler,
  useOfflineState,
} from '../OfflineCapabilities';

// Mock feature flags
const mockUseFeatureFlags = vi.fn(() => ({
  flags: {
    enableOfflineCapabilities: true,
    enableContentCaching: true,
    enableOfflineReading: true,
    enableBackgroundSync: true,
  },
}));

vi.mock('../../../hooks/useFeatureFlags', () => ({
  useFeatureFlags: () => mockUseFeatureFlags(),
}));

// Mock Service Worker API
const mockServiceWorker = {
  register: vi.fn(),
  ready: Promise.resolve({
    active: {
      state: 'activated',
      scriptURL: '/sw.js',
    },
    waiting: null,
    installing: null,
    scope: '/',
    update: vi.fn(),
    addEventListener: vi.fn(),
  }),
  addEventListener: vi.fn(),
  controller: null,
};

const mockRegistration = {
  active: {
    state: 'activated',
    scriptURL: '/sw.js',
    addEventListener: vi.fn(),
    postMessage: vi.fn(),
  },
  waiting: null,
  installing: null,
  scope: '/',
  update: vi.fn(),
  addEventListener: vi.fn(),
};

// Mock Cache API
const mockCache = {
  match: vi.fn(),
  add: vi.fn(),
  addAll: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  keys: vi.fn(() => Promise.resolve([])),
};

const mockCaches = {
  open: vi.fn(() => Promise.resolve(mockCache)),
  match: vi.fn(),
  has: vi.fn(),
  delete: vi.fn(),
  keys: vi.fn(() => Promise.resolve(['test-cache-v1'])),
};

// Mock IndexedDB
const mockIndexedDB = {
  open: vi.fn(() => ({
    result: {
      objectStoreNames: {
        contains: vi.fn(() => false),
      },
      createObjectStore: vi.fn(() => ({
        createIndex: vi.fn(),
      })),
      transaction: vi.fn(() => ({
        objectStore: vi.fn(() => ({
          getAll: vi.fn(() => ({ onsuccess: null, onerror: null })),
          put: vi.fn(() => ({ onsuccess: null, onerror: null })),
          delete: vi.fn(() => ({ onsuccess: null, onerror: null })),
          get: vi.fn(() => ({ onsuccess: null, onerror: null })),
        })),
      })),
    },
    onsuccess: null,
    onerror: null,
    onupgradeneeded: null,
  })),
};

// Setup global mocks
beforeEach(() => {
  // Restore the default mock implementation before clearing other mocks
  mockUseFeatureFlags.mockReturnValue({
    flags: {
      enableOfflineCapabilities: true,
      enableContentCaching: true,
      enableOfflineReading: true,
      enableBackgroundSync: true,
    },
  });

  // Mock navigator
  Object.defineProperty(global.navigator, 'serviceWorker', {
    value: mockServiceWorker,
    writable: true,
  });

  Object.defineProperty(global.navigator, 'onLine', {
    value: true,
    writable: true,
  });

  // Mock caches
  Object.defineProperty(global, 'caches', {
    value: mockCaches,
    writable: true,
  });

  // Mock IndexedDB
  Object.defineProperty(global, 'indexedDB', {
    value: mockIndexedDB,
    writable: true,
  });

  // Mock connection API
  Object.defineProperty(global.navigator, 'connection', {
    value: {
      effectiveType: '4g',
      type: 'wifi',
      downlink: 10,
      rtt: 50,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
    writable: true,
  });

  // Mock performance API
  Object.defineProperty(global, 'performance', {
    value: {
      now: vi.fn(() => Date.now()),
    },
    writable: true,
  });

  // Clear call history (not implementations) for vi.fn() mocks
  vi.clearAllMocks();

  // Re-apply default implementation after clearAllMocks
  mockUseFeatureFlags.mockReturnValue({
    flags: {
      enableOfflineCapabilities: true,
      enableContentCaching: true,
      enableOfflineReading: true,
      enableBackgroundSync: true,
    },
  });
});

afterEach(() => {
  vi.clearAllMocks();
  // Clear the SyncManager singleton queue between tests to prevent state bleed
  try {
    SyncManager.getInstance().clearQueue();
  } catch (_) {
    // ignore if not available
  }
});

// ===================================================================
// SERVICE WORKER MANAGER TESTS (US-091)
// ===================================================================

describe('ServiceWorkerManager', () => {
  test('should register service worker successfully', async () => {
    const manager = ServiceWorkerManager.getInstance();
    mockServiceWorker.register.mockResolvedValue(mockRegistration);

    const registration = await manager.register('/sw.js');

    expect(mockServiceWorker.register).toHaveBeenCalledWith('/sw.js', {
      scope: '/',
      updateViaCache: 'none',
    });
    expect(registration).toBe(mockRegistration);
  });

  test('should handle service worker registration failure', async () => {
    const manager = ServiceWorkerManager.getInstance();
    const error = new Error('Registration failed');
    mockServiceWorker.register.mockRejectedValue(error);

    await expect(manager.register('/sw.js')).rejects.toThrow('Registration failed');
  });

  test('should notify listeners of status changes', async () => {
    const manager = ServiceWorkerManager.getInstance();
    const listener = vi.fn();

    manager.addListener(listener);
    mockServiceWorker.register.mockResolvedValue(mockRegistration);

    await manager.register('/sw.js');

    expect(listener).toHaveBeenCalledWith({
      state: 'activated',
      scope: '/',
      scriptURL: '/sw.js',
      updateAvailable: false,
    });
  });

  test('should handle service worker updates', async () => {
    const manager = ServiceWorkerManager.getInstance();
    const mockWaiting = { postMessage: vi.fn() };
    const registrationWithWaiting = {
      ...mockRegistration,
      waiting: mockWaiting,
    };
    mockServiceWorker.register.mockResolvedValue(registrationWithWaiting);

    await manager.register('/sw.js');
    await manager.skipWaiting();

    expect(mockWaiting.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
  });
});

// ===================================================================
// CACHE MANAGER TESTS (US-092)
// ===================================================================

describe('CacheManager', () => {
  test('should cache resources successfully', async () => {
    const manager = CacheManager.getInstance();
    const response = new Response('test content');

    await manager.cacheResource('/test-url', response, 'dynamic');

    expect(mockCaches.open).toHaveBeenCalledWith('sovren-dynamic-v1');
    expect(mockCache.put).toHaveBeenCalledWith('/test-url', expect.any(Response));
  });

  test('should retrieve cached resources', async () => {
    const manager = CacheManager.getInstance();
    const mockResponse = new Response('cached content');
    mockCache.match.mockResolvedValue(mockResponse);

    const result = await manager.getCachedResource('/test-url');

    expect(result).toBe(mockResponse);
    expect(mockCache.match).toHaveBeenCalledWith('/test-url');
  });

  test('should get cache status', async () => {
    const manager = CacheManager.getInstance();
    const mockKeys = [new Request('http://localhost/test1'), new Request('http://localhost/test2')];
    const mockResponse = new Response('test', {
      headers: { 'content-length': '1000' },
    });

    mockCache.keys.mockResolvedValue(mockKeys);
    mockCache.match.mockResolvedValue(mockResponse);

    // Mock blob size
    const blob = { size: 1000 };
    vi.spyOn(mockResponse, 'blob').mockResolvedValue(blob as Blob);

    const status = await manager.getCacheStatus();

    expect(status).toHaveLength(4); // Four cache types
    expect(status[0]).toMatchObject({
      name: 'static',
      itemCount: 2,
      size: 2000,
    });
  });

  test('should clear specific cache', async () => {
    const manager = CacheManager.getInstance();

    await manager.clearCache('static');

    expect(mockCaches.delete).toHaveBeenCalledWith('sovren-static-v1');
  });

  test('should clear all caches', async () => {
    const manager = CacheManager.getInstance();

    await manager.clearCache();

    expect(mockCaches.delete).toHaveBeenCalledTimes(4);
  });
});

// ===================================================================
// SYNC MANAGER TESTS (US-094)
// ===================================================================

describe('SyncManager', () => {
  test('should add items to sync queue', () => {
    const manager = SyncManager.getInstance();
    const listener = vi.fn();
    manager.addListener(listener);

    manager.addToQueue({
      action: 'test_action',
      data: { test: 'data' },
      retryCount: 0,
      maxRetries: 3,
      priority: 'normal',
    });

    const queue = manager.getQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({
      action: 'test_action',
      data: { test: 'data' },
      priority: 'normal',
    });
    expect(listener).toHaveBeenCalledWith(queue);
  });

  test('should prioritize sync items correctly', () => {
    const manager = SyncManager.getInstance();

    // Add items with different priorities
    manager.addToQueue({
      action: 'low_priority',
      data: {},
      retryCount: 0,
      maxRetries: 3,
      priority: 'low',
    });

    manager.addToQueue({
      action: 'critical_priority',
      data: {},
      retryCount: 0,
      maxRetries: 3,
      priority: 'critical',
    });

    manager.addToQueue({
      action: 'high_priority',
      data: {},
      retryCount: 0,
      maxRetries: 3,
      priority: 'high',
    });

    const queue = manager.getQueue();
    expect(queue[0].priority).toBe('critical');
    expect(queue[1].priority).toBe('high');
    expect(queue[2].priority).toBe('low');
  });

  test('should clear sync queue', () => {
    const manager = SyncManager.getInstance();

    manager.addToQueue({
      action: 'test',
      data: {},
      retryCount: 0,
      maxRetries: 3,
      priority: 'normal',
    });

    expect(manager.getQueue()).toHaveLength(1);

    manager.clearQueue();
    expect(manager.getQueue()).toHaveLength(0);
  });
});

// ===================================================================
// OFFLINE STATE HOOK TESTS
// ===================================================================

describe('useOfflineState', () => {
  test('should track online status', () => {
    const TestComponent = () => {
      const offlineState = useOfflineState();
      return (
        <div>
          <span data-testid="online-status">{offlineState.isOnline ? 'online' : 'offline'}</span>
          <span data-testid="connection-type">{offlineState.connectionType}</span>
        </div>
      );
    };

    render(<TestComponent />);

    expect(screen.getByTestId('online-status')).toHaveTextContent('online');
    expect(screen.getByTestId('connection-type')).toHaveTextContent('wifi');
  });

  test('should handle offline status changes', async () => {
    const TestComponent = () => {
      const offlineState = useOfflineState();
      return <span data-testid="status">{offlineState.isOnline ? 'online' : 'offline'}</span>;
    };

    render(<TestComponent />);

    expect(screen.getByTestId('status')).toHaveTextContent('online');

    // Simulate going offline
    Object.defineProperty(navigator, 'onLine', { value: false, writable: true });
    fireEvent(window, new Event('offline'));

    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('offline');
    });
  });
});

// ===================================================================
// OFFLINE ERROR HANDLER TESTS
// ===================================================================

describe('useOfflineErrorHandler', () => {
  test('should add and remove errors', () => {
    const TestComponent = () => {
      const { errors, addError, removeError } = useOfflineErrorHandler();
      return (
        <div>
          <button onClick={() => addError('Test error')}>Add Error</button>
          <div data-testid="error-count">{errors.length}</div>
          {errors.map((error) => (
            <div key={error.id} data-testid={`error-${error.id}`}>
              {error.message}
              <button onClick={() => removeError(error.id)}>Remove</button>
            </div>
          ))}
        </div>
      );
    };

    render(<TestComponent />);

    expect(screen.getByTestId('error-count')).toHaveTextContent('0');

    fireEvent.click(screen.getByText('Add Error'));
    expect(screen.getByTestId('error-count')).toHaveTextContent('1');
    expect(screen.getByText('Test error')).toBeInTheDocument();
  });

  test('should auto-remove errors after timeout', async () => {
    vi.useFakeTimers();

    const TestComponent = () => {
      const { errors, addError } = useOfflineErrorHandler();
      return (
        <div>
          <button onClick={() => addError('Auto-remove error')}>Add Error</button>
          <div data-testid="error-count">{errors.length}</div>
        </div>
      );
    };

    render(<TestComponent />);

    fireEvent.click(screen.getByText('Add Error'));
    expect(screen.getByTestId('error-count')).toHaveTextContent('1');

    // Fast-forward time by 5 seconds
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    await waitFor(() => {
      expect(screen.getByTestId('error-count')).toHaveTextContent('0');
    });

    vi.useRealTimers();
  });
});

// ===================================================================
// OFFLINE CAPABILITIES COMPONENT TESTS
// ===================================================================

describe('OfflineCapabilities Component', () => {
  test('should render when feature flag is enabled', () => {
    render(<OfflineCapabilities />);

    expect(screen.getByText('Connection Status')).toBeInTheDocument();
    expect(screen.getByText('Service Worker Status')).toBeInTheDocument();
  });

  test('should not render when feature flag is disabled', () => {
    mockUseFeatureFlags.mockReturnValue({
      flags: { enableOfflineCapabilities: false },
    });

    const { container } = render(<OfflineCapabilities />);
    expect(container.firstChild).toBeNull();
  });

  test('should display connection status correctly', () => {
    render(<OfflineCapabilities />);

    expect(screen.getByText('Online')).toBeInTheDocument();
    expect(screen.getByText('wifi')).toBeInTheDocument();
    expect(screen.getByText('4g')).toBeInTheDocument();
  });

  test('should handle service worker registration', async () => {
    mockServiceWorker.register.mockResolvedValue(mockRegistration);

    render(<OfflineCapabilities enableServiceWorker={true} />);

    await waitFor(() => {
      expect(mockServiceWorker.register).toHaveBeenCalled();
    });
  });

  test('should display cache status', async () => {
    const mockCacheStatus = [
      {
        name: 'static',
        size: 1024000,
        itemCount: 10,
        lastUpdated: new Date(),
        hitRate: 0.85,
      },
    ];

    // Mock cache manager
    const getCacheStatusSpy = vi
      .spyOn(CacheManager.prototype, 'getCacheStatus')
      .mockResolvedValue(mockCacheStatus);

    render(<OfflineCapabilities />);

    await waitFor(() => {
      // The component renders cache.name with CSS capitalize (visual only); DOM text is lowercase
      expect(screen.getByText('static Cache')).toBeInTheDocument();
      expect(screen.getByText(/10 items.*1000KB.*85% hit rate/)).toBeInTheDocument();
    });

    getCacheStatusSpy.mockRestore();
  });

  test('should handle cache clearing', async () => {
    const clearCacheSpy = vi.spyOn(CacheManager.prototype, 'clearCache').mockResolvedValue();

    render(<OfflineCapabilities />);

    const clearButton = screen.getByText('Clear All Caches');
    fireEvent.click(clearButton);

    await waitFor(() => {
      expect(clearCacheSpy).toHaveBeenCalled();
    });

    clearCacheSpy.mockRestore();
  });

  test('should display sync queue when background sync is enabled', () => {
    render(<OfflineCapabilities enableBackgroundSync={true} />);

    expect(screen.getByText('Background Synchronization')).toBeInTheDocument();
    expect(screen.getByText(/Sync Queue \(\d+ items\)/)).toBeInTheDocument();
  });

  test('should add test sync items', () => {
    const addToQueueSpy = vi.spyOn(SyncManager.prototype, 'addToQueue');

    render(<OfflineCapabilities enableBackgroundSync={true} />);

    const addButton = screen.getByText('Add Test Item');
    fireEvent.click(addButton);

    expect(addToQueueSpy).toHaveBeenCalledWith({
      action: 'test_sync',
      data: expect.objectContaining({
        message: 'Test sync item',
      }),
      retryCount: 0,
      maxRetries: 3,
      priority: 'normal',
    });

    addToQueueSpy.mockRestore();
  });

  test('should handle service worker updates', async () => {
    const skipWaitingSpy = vi
      .spyOn(ServiceWorkerManager.prototype, 'skipWaiting')
      .mockResolvedValue();

    // Spy on addListener to immediately invoke the callback with updateAvailable: true
    const addListenerSpy = vi
      .spyOn(ServiceWorkerManager.prototype, 'addListener')
      .mockImplementation((listener) => {
        listener({
          state: 'activated',
          scope: '/',
          scriptURL: '/sw.js',
          updateAvailable: true,
        });
      });

    render(<OfflineCapabilities />);

    await waitFor(() => {
      expect(screen.getByText('A new version is available')).toBeInTheDocument();
    });

    const updateButton = screen.getByText('Update');
    fireEvent.click(updateButton);

    expect(skipWaitingSpy).toHaveBeenCalled();

    skipWaitingSpy.mockRestore();
    addListenerSpy.mockRestore();
  });

  test('should display architecture information', () => {
    render(<OfflineCapabilities />);

    expect(screen.getByText('Offline Architecture')).toBeInTheDocument();
    expect(screen.getByText('Service Worker Support')).toBeInTheDocument();
    expect(screen.getByText('Cache Strategy')).toBeInTheDocument();
  });

  test('should handle connection quality indicators', () => {
    render(<OfflineCapabilities enableOfflineIndicators={true} />);

    // Should show online indicator
    const indicators = screen
      .getAllByRole('generic')
      .filter((el) => el.className.includes('rounded-full'));
    expect(indicators.length).toBeGreaterThan(0);
  });

  test('should handle poor connection quality', () => {
    // Mock slow connection (must include addEventListener/removeEventListener
    // since the component calls connection.addEventListener('change', ...))
    Object.defineProperty(navigator, 'connection', {
      value: {
        effectiveType: 'slow-2g',
        type: 'cellular',
        downlink: 0.5,
        rtt: 2000,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
      writable: true,
    });

    render(<OfflineCapabilities enableOfflineIndicators={true} />);

    expect(screen.getByText('slow-2g')).toBeInTheDocument();
    expect(screen.getByText('cellular')).toBeInTheDocument();
  });

  test('should handle errors gracefully', async () => {
    // Mock service worker registration failure
    mockServiceWorker.register.mockRejectedValue(new Error('SW registration failed'));

    render(<OfflineCapabilities />);

    await waitFor(() => {
      expect(
        screen.getByText('Service Worker not available or failed to initialize')
      ).toBeInTheDocument();
    });
  });
});

// ===================================================================
// INTEGRATION TESTS
// ===================================================================

describe('Offline Capabilities Integration', () => {
  test('should handle complete offline workflow', async () => {
    // Start online
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true });

    const TestComponent = () => {
      const offlineState = useOfflineState();
      const { errors, addError } = useOfflineErrorHandler();

      return (
        <div>
          <OfflineCapabilities />
          <div data-testid="connection-status">{offlineState.isOnline ? 'online' : 'offline'}</div>
          <div data-testid="error-count">{errors.length}</div>
        </div>
      );
    };

    render(<TestComponent />);

    // Should start online
    expect(screen.getByTestId('connection-status')).toHaveTextContent('online');

    // Simulate going offline
    Object.defineProperty(navigator, 'onLine', { value: false, writable: true });
    fireEvent(window, new Event('offline'));

    await waitFor(() => {
      expect(screen.getByTestId('connection-status')).toHaveTextContent('offline');
    });

    // Should show offline status in UI
    expect(screen.getByText('Offline')).toBeInTheDocument();
  });

  test('should handle service worker and cache integration', async () => {
    const swRegisterSpy = vi
      .spyOn(ServiceWorkerManager.prototype, 'register')
      .mockResolvedValue(mockRegistration);
    const cacheStatusSpy = vi.spyOn(CacheManager.prototype, 'getCacheStatus').mockResolvedValue([]);

    render(<OfflineCapabilities enableServiceWorker={true} />);

    await waitFor(() => {
      expect(swRegisterSpy).toHaveBeenCalled();
      expect(cacheStatusSpy).toHaveBeenCalled();
    });

    swRegisterSpy.mockRestore();
    cacheStatusSpy.mockRestore();
  });

  test('should handle sync queue with network changes', async () => {
    const syncManager = SyncManager.getInstance();
    const addToQueueSpy = vi.spyOn(syncManager, 'addToQueue');

    render(<OfflineCapabilities enableBackgroundSync={true} />);

    // Add sync item while online
    fireEvent.click(screen.getByText('Add Test Item'));
    expect(addToQueueSpy).toHaveBeenCalled();

    // Go offline
    Object.defineProperty(navigator, 'onLine', { value: false, writable: true });
    fireEvent(window, new Event('offline'));

    // Add another sync item while offline
    fireEvent.click(screen.getByText('Add Test Item'));
    expect(addToQueueSpy).toHaveBeenCalledTimes(2);

    addToQueueSpy.mockRestore();
  });
});

// ===================================================================
// PERFORMANCE TESTS
// ===================================================================

describe('Offline Capabilities Performance', () => {
  test('should initialize quickly', async () => {
    const startTime = performance.now();

    render(<OfflineCapabilities />);

    await waitFor(() => {
      expect(screen.getByText('Connection Status')).toBeInTheDocument();
    });

    const endTime = performance.now();
    const initTime = endTime - startTime;

    // Should initialize within 100ms
    expect(initTime).toBeLessThan(100);
  });

  test('should handle rapid state changes efficiently', async () => {
    const TestComponent = () => {
      const offlineState = useOfflineState();
      return <div data-testid="status">{offlineState.isOnline ? 'online' : 'offline'}</div>;
    };

    render(<TestComponent />);

    // Rapidly toggle online/offline status
    for (let i = 0; i < 10; i++) {
      Object.defineProperty(navigator, 'onLine', { value: i % 2 === 0, writable: true });
      fireEvent(window, new Event(i % 2 === 0 ? 'online' : 'offline'));
    }

    // Should handle rapid changes without issues
    await waitFor(() => {
      expect(screen.getByTestId('status')).toBeInTheDocument();
    });
  });

  test('should handle large sync queues efficiently', () => {
    const syncManager = SyncManager.getInstance();

    // Add many items to sync queue
    for (let i = 0; i < 100; i++) {
      syncManager.addToQueue({
        action: `test_action_${i}`,
        data: { index: i },
        retryCount: 0,
        maxRetries: 3,
        priority: 'normal',
      });
    }

    const queue = syncManager.getQueue();
    expect(queue).toHaveLength(100);

    // Should maintain performance with large queues
    const startTime = performance.now();
    syncManager.getQueue();
    const endTime = performance.now();

    expect(endTime - startTime).toBeLessThan(10); // Should be very fast
  });
});

// ===================================================================
// ACCESSIBILITY TESTS
// ===================================================================

describe('Offline Capabilities Accessibility', () => {
  test('should have proper ARIA labels and roles', () => {
    render(<OfflineCapabilities />);

    // Check for proper headings
    expect(screen.getByRole('heading', { name: /connection status/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /service worker status/i })).toBeInTheDocument();

    // Check for proper buttons
    expect(screen.getByRole('button', { name: /clear all caches/i })).toBeInTheDocument();
  });

  test('should be keyboard navigable', async () => {
    const user = userEvent.setup();
    render(<OfflineCapabilities enableBackgroundSync={true} />);

    // Should be able to tab through interactive elements
    // Native <button> elements have implicit role="button" but no explicit role attribute
    await user.tab();
    expect(document.activeElement?.tagName.toLowerCase()).toBe('button');

    await user.tab();
    expect(document.activeElement?.tagName.toLowerCase()).toBe('button');
  });

  test('should provide clear status indicators', () => {
    render(<OfflineCapabilities enableOfflineIndicators={true} />);

    // Connection status should be clearly indicated
    expect(screen.getByText('Online')).toBeInTheDocument();

    // Service worker status section heading should be present
    // (multiple elements match /service worker/i; check for the section heading specifically)
    expect(screen.getByRole('heading', { name: /service worker status/i })).toBeInTheDocument();
  });

  test('should handle reduced motion preferences', () => {
    // Mock prefers-reduced-motion
    Object.defineProperty(window, 'matchMedia', {
      value: vi.fn(() => ({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });

    render(<OfflineCapabilities />);

    // Should render without animations when reduced motion is preferred
    expect(screen.getByText('Connection Status')).toBeInTheDocument();
  });
});

export { mockCache, mockCaches, mockIndexedDB, mockRegistration, mockServiceWorker };
