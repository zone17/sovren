import { defineConfig, devices } from '@playwright/test';

/**
 * Simplified Playwright config for Phase 7 E2E tests.
 * Does not start web servers (assumes frontend dev server is already running).
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: 0,
  timeout: 30000,
  expect: { timeout: 10000 },
  reporter: [['line']],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'off',
    screenshot: 'only-on-failure',
    actionTimeout: 10000,
    navigationTimeout: 30000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  outputDir: 'test-results/playwright-output',
});
