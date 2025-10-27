/**
 * 🧪 **ELITE FRONTEND TEST SETUP - REACT & DOM TESTING**
 *
 * @description Frontend-specific test setup for React components and DOM testing
 * @version 2.0.0 - Production-Ready Frontend Test Setup
 * @author Elite Engineering Team
 * @lastModified 2024-12-28
 *
 * **FEATURES:**
 * - React Testing Library setup
 * - DOM environment configuration
 * - Frontend-specific mocks
 * - Browser API mocks
 * - Component testing utilities
 *
 * **USAGE:**
 * Automatically loaded for frontend tests through Jest setupFilesAfterEnv
 */

import { afterEach, beforeEach } from '@jest/globals';
import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';

// 🧹 **CLEANUP AFTER EACH TEST**
afterEach(() => {
  cleanup();

  // Clear all mocks
  jest.clearAllMocks();

  // Clear local storage
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.clear();
  }

  // Clear session storage
  if (typeof window !== 'undefined' && window.sessionStorage) {
    window.sessionStorage.clear();
  }

  // Reset document title
  if (typeof document !== 'undefined') {
    document.title = '';
  }
});

// 🎯 **FRONTEND-SPECIFIC SETUP**
beforeEach(() => {
  // Reset console mocks for each test
  jest.clearAllMocks();
});

// 🌐 **DOM ENVIRONMENT SETUP**
if (typeof global !== 'undefined' && typeof window === 'undefined') {
  // Setup JSDOM environment if needed
  Object.defineProperty(global, 'window', {
    value: global.window || {},
    writable: true,
  });
}

// 📱 **REACT NATIVE BRIDGE MOCKS (for future mobile testing)**
if (typeof global !== 'undefined') {
  (global).React = require('react');
}

// 🎨 **FRONTEND UTILITIES**
export const frontendTestUtils = {
  // Utility to wait for React state updates
  waitForReactUpdate: () => {
    return new Promise((resolve) => setTimeout(resolve, 0));
  },

  // Utility to trigger React suspense
  triggerSuspense: () => {
    throw new Promise((resolve) => setTimeout(resolve, 100));
  },

  // Utility to mock React error boundary
  mockErrorBoundary: () => {
    const originalError = console.error;
    console.error = jest.fn();
    return () => {
      console.error = originalError;
    };
  },
};

// 🎯 **SETUP COMPLETE**
console.log('🎨 Elite frontend test setup completed!');
console.log('⚛️  React Testing Library configured with cleanup automation');
