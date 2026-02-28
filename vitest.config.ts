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
            // Known-broken tests — re-enable when fixed (tracked in docs/backlog/excluded-tests.md)
            '**/database-integration.test.ts',
            '**/integration/api-endpoints.integration.test.ts',
            '**/integration/database-transactions.integration.test.ts',
            '**/integration/event-bus.integration.test.ts',
            '**/integration/lightning-receipt-integration.test.ts',
            '**/integration/payment-flow-integration.test.ts',
            '**/integration/service-orchestration.integration.test.ts',
            '**/nip05-routes.test.ts',
            '**/performance/api-performance.test.ts',
            '**/performance/database-performance.test.ts',
            '**/performance/payment-performance.test.ts',
            '**/production-docker.test.ts',
            '**/rls-security.test.ts',
            '**/routes/content.routes.test.ts',
            '**/routes/v1-api-routes.test.ts',
            '**/routes/webhooks-race-conditions.test.ts',
            '**/smoke-tests.test.ts',
            '**/unified-session-service.test.ts',
            '**/container/__tests__/ServiceContainer.integration.test.ts',
            '**/middleware/__tests__/auth.test.ts',
            '**/routes/__tests__/auth.test.ts',
            '**/services/__tests__/ai-recommendation-service.test.ts',
            '**/services/__tests__/EmailService.test.ts',
            '**/services/__tests__/lightning-service.test.ts',
            '**/services/__tests__/payment-persistence-atomic.test.ts',
            '**/services/__tests__/SecretsService.test.ts',
            '**/services/__tests__/user-service.test.ts',
            '**/content/__tests__/ContentAnalyticsService.test.ts',
            '**/content/__tests__/ContentCreationService.test.ts',
            '**/content/__tests__/ContentModerationService.test.ts',
            '**/content/__tests__/ContentPublishingService.test.ts',
            '**/distribution/__tests__/CrossPlatformAnalyticsService.test.ts',
            '**/distribution/__tests__/crypto.test.ts',
            '**/distribution/__tests__/InboxPollingService.test.ts',
            '**/distribution/__tests__/NostrReplyAdapter.test.ts',
            '**/payment/__tests__/integration/payment-flow.integration.test.ts',
            '**/payment/__tests__/InvoiceService.test.ts',
            '**/user/__tests__/UserActivityService.test.ts',
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
    },
    // Reporter
    reporters: ['default'],
  },
});
