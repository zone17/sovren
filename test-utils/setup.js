/**
 * Global Jest Setup
 *
 * This file runs before all tests and sets up the global testing environment.
 * It configures common test utilities, polyfills, and global mocks.
 */

// Polyfills for Node.js environment
const { TextDecoder, TextEncoder } = require('util');
require('whatwg-fetch');

// Global polyfills
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Mock window.matchMedia for React components that use media queries (jsdom only)
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(), // deprecated
      removeListener: jest.fn(), // deprecated
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
}

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

// Mock crypto for Node.js environment
const crypto = require('crypto');
Object.defineProperty(global, 'crypto', {
  value: {
    getRandomValues: (arr) => crypto.randomBytes(arr.length),
    randomUUID: () => crypto.randomUUID(),
  },
});

// Mock console methods in test environment
if (process.env.NODE_ENV === 'test') {
  // Suppress console.log in tests unless explicitly enabled
  if (!process.env.ENABLE_TEST_LOGS) {
    global.console = {
      ...console,
      log: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
  }
}

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only-minimum-64-characters-long';
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_ANON_KEY = 'test-anon-key';
process.env.LNBITS_URL = 'https://demo.lnbits.com';
process.env.LNBITS_ADMIN_KEY = 'test-admin-key';

// Global test timeout
jest.setTimeout(10000);

// Unhandled promise rejection handling
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Application specific logging, throwing an error, or other logic here
});

// Global error handler for tests (jsdom only)
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    console.error('Global error in test:', event.error);
  });

  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection in test:', event.reason);
  });
}
