/**
 * Vitest Integration Test Configuration
 *
 * Configuration for running integration tests with testcontainers.
 * Uses Vitest for fast, modern testing with TypeScript support.
 *
 * @see https://vitest.dev/config/
 */

import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    name: 'backend-integration',
    globals: true,
    environment: 'node',
    setupFiles: ['./src/__tests__/setup/integration-setup.ts'],
    include: ['src/__tests__/integration/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    testTimeout: 60000, // 60s for container startup
    hookTimeout: 60000,
    teardownTimeout: 30000,
    isolate: true,
    poolOptions: {
      threads: {
        singleThread: true, // Run integration tests sequentially for database consistency
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage/integration',
      include: [
        'src/services/**/*.ts',
        'src/routes/**/*.ts',
        'src/middleware/**/*.ts',
      ],
      exclude: [
        '**/__tests__/**',
        '**/__mocks__/**',
        '**/node_modules/**',
        '**/dist/**',
        '**/*.test.ts',
        '**/*.spec.ts',
      ],
      thresholds: {
        lines: 95,
        functions: 95,
        branches: 90,
        statements: 95,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@sovren/shared': path.resolve(__dirname, '../shared/src'),
    },
  },
});
