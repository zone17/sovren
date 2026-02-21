/**
 * Vitest Frontend Setup
 *
 * Provides jsdom environment setup, mocks for browser APIs, and
 * testing-library configuration for React component tests.
 */
import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Environment variables
process.env.NODE_ENV = 'test';
process.env.TZ = 'UTC';
process.env.VITE_SUPABASE_URL = 'https://test-project.supabase.co';
process.env.VITE_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-anon-key';
process.env.VITE_API_URL = 'http://localhost:3000/api';
process.env.VITE_ENABLE_CMS = 'true';
process.env.VITE_ENABLE_AI_ASSISTANT = 'true';
process.env.VITE_ENABLE_NOSTR_INTEGRATION = 'true';
process.env.VITE_ENABLE_LIGHTNING_PAYMENTS = 'true';
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_ANON_KEY = 'test-anon-key';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';

// Cleanup after each test
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeEach(() => {
  vi.clearAllMocks();
});

// Browser API mocks
if (typeof window !== 'undefined') {
  // ResizeObserver - use a real class so vi.clearAllMocks() won't break it
  class MockResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = MockResizeObserver as any;

  // IntersectionObserver - use a real class so vi.clearAllMocks() won't break it
  class MockIntersectionObserver {
    readonly root = null;
    readonly rootMargin = '';
    readonly thresholds = [0];
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() { return []; }
  }
  globalThis.IntersectionObserver = MockIntersectionObserver as any;

  // scrollIntoView - not available in jsdom
  Element.prototype.scrollIntoView = function() {};

  // getBoundingClientRect - return non-zero dimensions for recharts
  if (!Element.prototype.getBoundingClientRect.__mocked) {
    const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function() {
      const rect = originalGetBoundingClientRect.call(this);
      // Return non-zero dimensions if jsdom returns zeros (for recharts ResponsiveContainer)
      if (rect.width === 0 && rect.height === 0) {
        return { ...rect, width: 500, height: 300, top: 0, left: 0, bottom: 300, right: 500 };
      }
      return rect;
    };
    (Element.prototype.getBoundingClientRect as any).__mocked = true;
  }

  // matchMedia
  Object.defineProperty(window, 'matchMedia', {
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
    writable: true,
  });

  // crypto - make it configurable so tests can override with mocks
  try {
    Object.defineProperty(window, 'crypto', {
      value: window.crypto || {
        getRandomValues: (arr: Uint8Array) => {
          for (let i = 0; i < arr.length; i++) {
            arr[i] = Math.floor(Math.random() * 256);
          }
          return arr;
        },
        subtle: {
          digest: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
          sign: vi.fn().mockResolvedValue(new ArrayBuffer(64)),
          verify: vi.fn().mockResolvedValue(true),
          generateKey: vi.fn().mockResolvedValue({ privateKey: {}, publicKey: {} }),
        },
      },
      writable: true,
      configurable: true,
    });
  } catch {
    // crypto already defined as read-only in newer jsdom - that's fine
  }

  // Also make globalThis.crypto assignable for tests that set global.crypto = ...
  try {
    Object.defineProperty(globalThis, 'crypto', {
      value: globalThis.crypto,
      writable: true,
      configurable: true,
    });
  } catch {
    // Already configured
  }

  // indexedDB mock for tests that need it
  if (typeof globalThis.indexedDB === 'undefined') {
    const mockIDBFactory = {
      open: vi.fn().mockReturnValue({
        onupgradeneeded: null,
        onsuccess: null,
        onerror: null,
        result: {
          createObjectStore: vi.fn(),
          transaction: vi.fn().mockReturnValue({
            objectStore: vi.fn().mockReturnValue({
              put: vi.fn(),
              get: vi.fn(),
              delete: vi.fn(),
              getAll: vi.fn(),
            }),
          }),
          close: vi.fn(),
        },
      }),
      deleteDatabase: vi.fn(),
    };
    Object.defineProperty(globalThis, 'indexedDB', {
      value: mockIDBFactory,
      writable: true,
      configurable: true,
    });
  }

  // getComputedStyle
  globalThis.getComputedStyle = vi.fn().mockImplementation(() => ({
    getPropertyValue: vi.fn().mockReturnValue(''),
    setProperty: vi.fn(),
    removeProperty: vi.fn(),
  })) as any;
}

// WebSocket mock
globalThis.WebSocket = vi.fn().mockImplementation(() => ({
  close: vi.fn(),
  send: vi.fn(),
  readyState: 1,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
})) as any;

// Notification mock
globalThis.Notification = vi.fn().mockImplementation(() => ({
  close: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
})) as any;
(globalThis.Notification as any).permission = 'granted';
(globalThis.Notification as any).requestPermission = vi.fn().mockResolvedValue('granted');

// fetch mock
globalThis.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: vi.fn().mockResolvedValue({}),
  text: vi.fn().mockResolvedValue(''),
  status: 200,
});
