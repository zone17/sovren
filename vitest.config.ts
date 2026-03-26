/// <reference types="vitest" />
import path from 'path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  esbuild: {
    // Required for inversify @inject() parameter decorators in backend services
    tsconfigRaw: {
      compilerOptions: {
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
      },
    },
  },
  resolve: {
    alias: {
      '@/': path.resolve(__dirname, 'packages/frontend/src') + '/',
      '@backend/': path.resolve(__dirname, 'packages/backend/src') + '/',
      '@shared/': path.resolve(__dirname, 'packages/shared/src') + '/',
      '@sovren/shared/': path.resolve(__dirname, 'packages/shared/src') + '/',
      '@testing/': path.resolve(__dirname, 'packages/testing/src') + '/',
      '@test-utils/': path.resolve(__dirname, 'test-utils') + '/',
      // Jest compat: redirect @jest/globals to vitest
      '@jest/globals': 'vitest',
    },
  },
  test: {
    globals: true,
    pool: 'forks',
    poolOptions: {
      forks: {
        maxForks: 2, // Limit workers to avoid OOM on 24GB machines
      },
    },
    // Default environment - overridden per project
    environment: 'node',
    // CSS handling
    css: false,
    // Timeouts
    testTimeout: 30000,
    hookTimeout: 30000,
    // Projects (replaces workspace file)
    projects: [
      {
        extends: true,
        test: {
          name: 'frontend',
          environment: 'jsdom',
          include: ['packages/frontend/src/**/*.{test,spec}.{ts,tsx}'],
          exclude: [
            'node_modules',
            'dist',
            '**/fixtures/**',
            '**/helpers/**',
            '**/mocks/**',
            '**/integration/**',
            '**/setup.ts',
            '**/test-helpers.ts',
            '**/test-events.ts',
            '**/relay-fixtures.ts',
            '**/performance-utils.ts',
            // Known-broken tests — re-enable when fixed
            '**/MonitoringService.test.ts',
            '**/ContentManagementHub.test.tsx',
            '**/PaymentHistory.test.tsx',
            '**/OptimizationSuggestionPanel.test.tsx',
            '**/NIP26Service.test.ts',
            '**/CreatorCard.test.tsx',
            '**/input.stories.test.tsx',
            '**/CollaborativeFeatures.test.tsx',
            '**/InstantMessagingFeatures.test.tsx',
            '**/LiveContentUpdates.test.tsx',
            '**/MobileComponents.test.tsx',
            '**/NIP19BatchService.test.ts',
            '**/Post.test.tsx',
            '**/Login.test.tsx',
            '**/UserSubscriptionManager.test.tsx',
          ],
          setupFiles: [
            './test-utils/vitest-jest-compat.ts',
            './test-utils/vitest-frontend-setup.ts',
          ],
        },
      },
      {
        extends: true,
        resolve: {
          alias: {
            '@/': path.resolve(__dirname, 'packages/backend/src') + '/',
          },
        },
        test: {
          name: 'backend',
          environment: 'node',
          include: ['packages/backend/src/**/*.{test,spec}.{ts,tsx}'],
          exclude: [
            'node_modules',
            'dist',
            '**/fixtures/**',
            '**/helpers/**',
            '**/mocks/**',
            // Integration/E2E tests run via dedicated configs (testcontainers)
            '**/integration/**',
            '**/e2e/**',
            // Permanent exclusions — need dedicated CI jobs, not the unit test suite
            '**/performance/api-performance.test.ts',
            '**/performance/database-performance.test.ts',
            '**/performance/payment-performance.test.ts',
            '**/production-docker.test.ts',
            '**/smoke-tests.test.ts',
            // NOTE: rls-security.test.ts requires a real Supabase connection.
            // Run it via the `test:integration` job (testcontainers) — not the unit suite.
          ],
          globalSetup: ['./test-utils/backend-global-setup.ts'],
          setupFiles: [
            './test-utils/vitest-jest-compat.ts',
            './test-utils/vitest-backend-setup.ts',
          ],
          poolOptions: {
            forks: {
              maxForks: 1, // Sequential: real DB tests must not interfere
            },
          },
        },
      },
      {
        extends: true,
        test: {
          name: 'shared',
          environment: 'node',
          include: ['packages/shared/src/**/*.{test,spec}.{ts,tsx}'],
          exclude: [
            'node_modules',
            'dist',
            'packages/shared/dist',
            // Known-broken — re-enable when fixed (tracked in docs/backlog/excluded-tests.md)
            '**/environment-validator.test.ts',
          ],
          setupFiles: ['./test-utils/vitest-jest-compat.ts'],
        },
      },
    ],
    // Coverage
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html', 'json'],
      all: true, // Include uncovered files in report
      include: ['packages/*/src/**/*.{ts,tsx}'],
      exclude: [
        '**/*.d.ts',
        '**/*.test.{ts,tsx}',
        '**/*.spec.{ts,tsx}',
        '**/__tests__/**',
        '**/__mocks__/**',
        '**/stories/**',
        '**/test-utils/**',
      ],
      thresholds: {
        // Baseline — ratcheted up (meaningful gate; target 85/95 after Phase 4 test recovery)
        lines: 40,
        branches: 25,
        // Per-file thresholds for critical payment services
        'packages/backend/src/services/payment/**': {
          lines: 80,
        },
      },
    },
    // Reporter
    reporters: ['default'],
  },
});
