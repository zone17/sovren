/**
 * Vitest Configuration - Backend Tests
 *
 * Configuration for backend payment analytics and security tests.
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./test-setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: [
        'services/**/*.ts',
        'routes/**/*.ts',
        'middleware/**/*.ts',
        'repositories/**/*.ts',
      ],
      exclude: [
        '**/*.d.ts',
        '**/*.test.ts',
        '**/node_modules/**',
        '**/dist/**',
        '**/__tests__/**',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
    testTimeout: 10000,
    hookTimeout: 10000,
  },
});
