/**
 * 🧪 **ELITE TEST SETUP CONFIGURATION**
 *
 * **Purpose**: Essential test setup following TDD/BDD best practices
 * **Architecture**: Browser environment mocking for React testing
 * **Security**: Safe test environment with isolated credentials
 * **Performance**: Optimized for sub-2 second test execution
 *
 * @author Elite Engineering Team
 * @version 2.0.0 - Simplified and focused
 * @lastModified 2024-12-28
 */

import '@testing-library/jest-dom';

// Jest and browser globals
declare const jest: any;
declare const window: any;
declare const global: any;
declare const navigator: any;
declare const console: any;
declare const process: any;
declare const document: any;
declare const beforeEach: any;
declare const afterEach: any;
declare const afterAll: any;

// 🚀 Import our elite testing infrastructure
import { setupSnapshotTesting } from './test-utils/snapshot-testing';
import { resetTestEnvironment, setupTestEnvironment } from './test-utils/test-environment';
import { timeoutManager } from './test-utils/test-timeout-manager';

// 📊 React Query testing setup

// 🔧 Initialize test environment before all tests
setupTestEnvironment();

// 📸 Initialize snapshot testing
setupSnapshotTesting();

// Elite testing: Mock import.meta for Jest compatibility
Object.defineProperty(globalThis, 'import', {
  value: {
    meta: {
      env: {
        DEV: false,
        NODE_ENV: 'test',
        MODE: 'test',
        // Include all Vite environment variables from our test environment
        VITE_SUPABASE_URL: 'https://test-project.supabase.co',
        VITE_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-anon-key',
        VITE_ENABLE_CMS: 'true',
        VITE_ENABLE_AI_ASSISTANT: 'true',
        VITE_ENABLE_NOSTR_INTEGRATION: 'true',
        VITE_ENABLE_LIGHTNING_PAYMENTS: 'true',
      },
    },
  },
  writable: true,
  configurable: true,
});

// Properly typed global interface extensions
declare global {
  interface Window {
    IntersectionObserver: typeof IntersectionObserver;
    ResizeObserver: typeof ResizeObserver;
  }

  interface Global {
    IntersectionObserver: typeof IntersectionObserver;
    ResizeObserver: typeof ResizeObserver;
  }
}

// Mock IntersectionObserver
(window as unknown as { IntersectionObserver: unknown }).IntersectionObserver = jest
  .fn()
  .mockImplementation(() => ({
    disconnect: jest.fn(),
    observe: jest.fn(),
    unobserve: jest.fn(),
  }));

// Mock ResizeObserver
(window as unknown as { ResizeObserver: unknown }).ResizeObserver = jest
  .fn()
  .mockImplementation(() => ({
    disconnect: jest.fn(),
    observe: jest.fn(),
    unobserve: jest.fn(),
  }));

// Mock window.matchMedia
const mockMatchMedia = jest.fn().mockImplementation((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: jest.fn(), // deprecated
  removeListener: jest.fn(), // deprecated
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn(),
}));

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: mockMatchMedia,
});

// Mock window.scrollTo
(window as unknown as { scrollTo: unknown }).scrollTo = jest.fn();

// 🌐 Mock fetch for API calls
global.fetch = jest.fn().mockImplementation(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: () => Promise.resolve({ message: 'Test API response' }),
    text: () => Promise.resolve('Test response text'),
    blob: () => Promise.resolve(new Blob(['test'])),
    headers: new Headers(),
    redirected: false,
    type: 'basic',
    url: '',
    body: null,
    bodyUsed: false,
    clone: jest.fn(),
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    formData: () => Promise.resolve(new FormData()),
  })
);

// 🔄 Mock WebSocket for real-time features
global.WebSocket = jest.fn().mockImplementation(() => ({
  readyState: WebSocket.OPEN,
  send: jest.fn(),
  close: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn(),
  onopen: null,
  onclose: null,
  onmessage: null,
  onerror: null,
  protocol: '',
  bufferedAmount: 0,
  extensions: '',
  binaryType: 'blob',
})) as unknown as typeof WebSocket;

// 📱 Mock navigator properties for mobile testing
Object.defineProperty(navigator, 'userAgent', {
  writable: true,
  value:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
});

Object.defineProperty(navigator, 'platform', {
  writable: true,
  value: 'iPhone',
});

Object.defineProperty(navigator, 'onLine', {
  writable: true,
  value: true,
});

// 📋 Mock clipboard API (Enhanced for UserEvent compatibility)
const mockClipboard = {
  writeText: jest.fn().mockResolvedValue(undefined),
  readText: jest.fn().mockResolvedValue('test clipboard content'),
  write: jest.fn().mockResolvedValue(undefined),
  read: jest.fn().mockResolvedValue([]),
};

// Ensure clipboard can be redefined by UserEvent
delete (navigator as unknown as { clipboard?: Clipboard }).clipboard;
Object.defineProperty(navigator, 'clipboard', {
  writable: true,
  configurable: true,
  value: mockClipboard,
});

// 📊 Mock performance API for performance testing
Object.defineProperty(window, 'performance', {
  writable: true,
  value: {
    now: jest.fn().mockReturnValue(Date.now()),
    mark: jest.fn(),
    measure: jest.fn(),
    getEntriesByType: jest.fn().mockReturnValue([]),
    getEntriesByName: jest.fn().mockReturnValue([]),
    clearMarks: jest.fn(),
    clearMeasures: jest.fn(),
    observer: jest.fn(),
  },
});

// 🔒 Mock crypto API for NOSTR testing
Object.defineProperty(global, 'crypto', {
  value: {
    getRandomValues: jest.fn().mockImplementation((arr: Uint8Array) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    }),
    randomUUID: jest.fn().mockReturnValue('test-uuid-123e4567-e89b-12d3-a456-426614174000'),
    subtle: {
      sign: jest.fn().mockResolvedValue(new ArrayBuffer(64)),
      verify: jest.fn().mockResolvedValue(true),
      digest: jest.fn().mockResolvedValue(new ArrayBuffer(32)),
      generateKey: jest.fn().mockResolvedValue({}),
      importKey: jest.fn().mockResolvedValue({}),
      exportKey: jest.fn().mockResolvedValue(new ArrayBuffer(32)),
    },
  },
});

// 🔤 Mock TextEncoder/TextDecoder for NOSTR NIP-19 support
if (typeof global.TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util');
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}

// 🎯 Console management for clean test output
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

// Only show console output in verbose mode
if (!process.env.VERBOSE_TESTS) {
  console.log = jest.fn();
  console.warn = jest.fn();
  console.error = jest.fn();
}

// 🧹 Global test cleanup and setup hooks
beforeEach(() => {
  // Reset test environment for each test
  resetTestEnvironment();

  // Clear all mocks
  jest.clearAllMocks();

  // Reset any DOM modifications
  document.body.innerHTML = '';
  document.head.innerHTML = '';

  // Reset clipboard state for each test
  jest.clearAllMocks();

  // Ensure clipboard remains configurable
  if (!Object.getOwnPropertyDescriptor(navigator, 'clipboard')?.configurable) {
    delete (navigator as unknown as { clipboard?: Clipboard }).clipboard;
    Object.defineProperty(navigator, 'clipboard', {
      writable: true,
      configurable: true,
      value: mockClipboard,
    });
  }

  // Clear all timeouts using the timeout manager
  timeoutManager.clearAllTimeouts();
});

afterEach(() => {
  // Additional cleanup if needed
  jest.clearAllTimers();

  // Clear timeouts using timeout manager
  timeoutManager.clearAllTimeouts();
});

afterAll(() => {
  // Restore original console methods
  if (!process.env.VERBOSE_TESTS) {
    console.log = originalConsoleLog;
    console.warn = originalConsoleWarn;
    console.error = originalConsoleError;
  }

  // Final cleanup with timeout manager
  timeoutManager.cleanup();
});

// 🎯 Jest timeout configuration for async operations
jest.setTimeout(10000); // 10 seconds for complex integration tests
