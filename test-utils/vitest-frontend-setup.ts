/**
 * Vitest Frontend Setup
 *
 * Provides jsdom environment setup, mocks for browser APIs, and
 * testing-library configuration for React component tests.
 */
import { afterAll, afterEach, beforeAll, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { server } from '../packages/frontend/src/test-utils/msw/server';

// Environment variables
process.env.NODE_ENV = 'test';
process.env.TZ = 'UTC';
process.env.VITE_SUPABASE_URL = 'https://test-project.supabase.co';
process.env.VITE_SUPABASE_ANON_KEY = 'test-anon-key-not-real-000000000000000000000000';
process.env.VITE_API_URL = 'http://localhost:3000/api';
process.env.VITE_ENABLE_CMS = 'true';
process.env.VITE_ENABLE_AI_ASSISTANT = 'true';
process.env.VITE_ENABLE_NOSTR_INTEGRATION = 'true';
process.env.VITE_ENABLE_LIGHTNING_PAYMENTS = 'true';
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_ANON_KEY = 'test-anon-key-not-real-000000000000000000000000';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';

// MSW server lifecycle
beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterAll(() => server.close());

// Cleanup after each test
afterEach(() => {
  server.resetHandlers();
  cleanup();
  vi.clearAllMocks();
});

beforeEach(() => {
  vi.clearAllMocks();
});

// Module-level guard for getBoundingClientRect patching (replaces fragile __mocked flag)
let boundingRectPatched = false;

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
    takeRecords() {
      return [];
    }
  }
  globalThis.IntersectionObserver = MockIntersectionObserver as any;

  // scrollIntoView - not available in jsdom
  Element.prototype.scrollIntoView = function () {};

  // getBoundingClientRect - return non-zero dimensions for recharts
  // Use module-level boolean instead of fragile __mocked flag on the prototype.
  // The __mocked property required `as any` casts and could become inconsistent
  // if vi.clearAllMocks() or vi.restoreAllMocks() reset the function but not the flag.
  if (!boundingRectPatched) {
    const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function () {
      const rect = originalGetBoundingClientRect.call(this);
      // Return non-zero dimensions if jsdom returns zeros (for recharts ResponsiveContainer)
      if (rect.width === 0 && rect.height === 0) {
        return { ...rect, width: 500, height: 300, top: 0, left: 0, bottom: 300, right: 500 };
      }
      return rect;
    };
    boundingRectPatched = true;
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
    const mockDB = {
      objectStoreNames: { contains: vi.fn().mockReturnValue(false) },
      createObjectStore: vi.fn().mockReturnValue({
        createIndex: vi.fn(),
      }),
      transaction: vi.fn().mockReturnValue({
        objectStore: vi.fn().mockReturnValue({
          put: vi.fn().mockImplementation(() => {
            const req: any = { onsuccess: null, onerror: null };
            Promise.resolve().then(() => req.onsuccess?.({ target: { result: undefined } }));
            return req;
          }),
          get: vi.fn().mockImplementation(() => {
            const req: any = { onsuccess: null, onerror: null };
            Promise.resolve().then(() => req.onsuccess?.({ target: { result: undefined } }));
            return req;
          }),
          delete: vi.fn().mockImplementation(() => {
            const req: any = { onsuccess: null, onerror: null };
            Promise.resolve().then(() => req.onsuccess?.({ target: { result: undefined } }));
            return req;
          }),
          getAll: vi.fn().mockImplementation(() => {
            const req: any = { onsuccess: null, onerror: null };
            Promise.resolve().then(() => req.onsuccess?.({ target: { result: [] } }));
            return req;
          }),
        }),
        oncomplete: null,
        onerror: null,
      }),
      close: vi.fn(),
    };
    const mockIDBFactory = {
      open: vi.fn().mockImplementation(() => {
        const request: any = {
          onupgradeneeded: null,
          onsuccess: null,
          onerror: null,
          result: mockDB,
        };
        // Trigger onsuccess asynchronously after callbacks are set
        Promise.resolve().then(() => {
          request.onsuccess?.({ target: { result: mockDB } });
        });
        return request;
      }),
      deleteDatabase: vi.fn().mockImplementation(() => {
        const request: any = { onsuccess: null, onerror: null };
        Promise.resolve().then(() => request.onsuccess?.({ target: { result: undefined } }));
        return request;
      }),
    };
    Object.defineProperty(globalThis, 'indexedDB', {
      value: mockIDBFactory,
      writable: true,
      configurable: true,
    });
  }

  // getComputedStyle - return a more complete CSSStyleDeclaration mock
  globalThis.getComputedStyle = vi.fn().mockImplementation(() => {
    const style: Record<string, string> = {};
    return new Proxy(style, {
      get(target, prop) {
        if (prop === 'getPropertyValue') return vi.fn().mockReturnValue('');
        if (prop === 'setProperty') return vi.fn();
        if (prop === 'removeProperty') return vi.fn();
        if (prop === 'length') return 0;
        if (typeof prop === 'string') return target[prop] || '';
        return undefined;
      },
    });
  }) as any;

  // navigator.clipboard mock
  if (typeof navigator !== 'undefined') {
    try {
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          writeText: vi.fn().mockResolvedValue(undefined),
          readText: vi.fn().mockResolvedValue(''),
          write: vi.fn().mockResolvedValue(undefined),
          read: vi.fn().mockResolvedValue([]),
        },
        writable: true,
        configurable: true,
      });
    } catch {
      // clipboard already defined
    }
  }
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

// fetch mock — complete Response shape to prevent silent failures
// when code accesses headers, blob(), clone(), etc.
globalThis.fetch = vi.fn().mockImplementation(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: new Headers({ 'content-type': 'application/json' }),
    json: vi.fn().mockResolvedValue({}),
    text: vi.fn().mockResolvedValue(''),
    blob: vi.fn().mockResolvedValue(new Blob()),
    arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
    formData: vi.fn().mockResolvedValue(new FormData()),
    clone: function () {
      return { ...this };
    },
    redirected: false,
    type: 'basic' as ResponseType,
    url: '',
    body: null,
    bodyUsed: false,
  })
);
