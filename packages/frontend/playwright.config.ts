import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, devices } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const authFile = path.join(__dirname, 'test-results/.auth/creator.json');

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 30_000,
  expect: { timeout: 5_000 },

  reporter: [
    [
      'html',
      {
        outputFolder: 'test-results/playwright-report',
        open: process.env.CI ? 'never' : 'on-failure',
      },
    ],
    ['json', { outputFile: 'test-results/results.json' }],
    ['line'],
    ...(process.env.CI ? [['github'] as const] : []),
  ],

  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },

  projects: [
    {
      name: 'setup',
      testMatch: /\.setup\.ts$/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chromium-authenticated',
      testMatch: /\.auth\.spec\.ts$/,
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: authFile,
      },
    },
    {
      name: 'chromium-public',
      testMatch: /\.public\.spec\.ts$/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'api',
      testMatch: /\.api\.spec\.ts$/,
      dependencies: ['setup'],
      use: {
        baseURL: process.env.E2E_API_URL || 'http://localhost:3001',
      },
    },
  ],

  // In CI, the preview server is started externally (vite preview on port 4173).
  // Locally, Playwright starts a dev server automatically.
  ...(process.env.CI
    ? {}
    : {
        webServer: [
          // Backend — only started if explicitly enabled via USE_BACKEND=1
          ...(process.env.USE_BACKEND
            ? [
                {
                  command: 'npm run dev',
                  cwd: path.join(__dirname, '../backend'),
                  url: 'http://localhost:3001/health',
                  timeout: 30_000,
                  reuseExistingServer: true,
                  env: {
                    NODE_ENV: 'test',
                    PORT: '3001',
                    SUPABASE_URL: process.env.SUPABASE_URL || 'http://localhost:54321',
                    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || '',
                    JWT_SECRET: 'e2e-test-secret-at-least-32-characters-long',
                  },
                },
              ]
            : []),
          // Frontend — demo auth by default, real backend auth when USE_BACKEND=1
          {
            command: 'npm run dev',
            url: 'http://localhost:3000',
            timeout: 15_000,
            reuseExistingServer: true,
            env: {
              VITE_DEMO_MODE: 'true',
              ...(process.env.USE_BACKEND
                ? { VITE_ENABLE_BACKEND: 'true', VITE_DEMO_MODE: 'false' }
                : {}),
            },
          },
        ],
      }),

  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  outputDir: 'test-results/playwright-output',
});
