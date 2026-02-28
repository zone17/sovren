/**
 * Vitest Integration Test Configuration
 *
 * Runs integration tests against real PostgreSQL + Redis via testcontainers.
 * globalSetup starts containers, applies migrations, and sets env vars.
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
    globalSetup: ['./src/__tests__/setup/testcontainers-global-setup.ts'],
    include: ['src/__tests__/integration/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    testTimeout: 60000,
    hookTimeout: 60000,
    teardownTimeout: 30000,
    pool: 'forks',
    poolOptions: {
      forks: {
        maxForks: 1, // Sequential: real DB tests must not interfere
      },
    },
  },
  resolve: {
    alias: {
      '@/': path.resolve(__dirname, './src') + '/',
      '@shared/': path.resolve(__dirname, '../shared/src') + '/',
      '@sovren/shared/': path.resolve(__dirname, '../shared/src') + '/',
      '@backend/': path.resolve(__dirname, './src') + '/',
    },
  },
});
