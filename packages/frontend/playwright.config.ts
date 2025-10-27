import { defineConfig, devices } from '@playwright/test';

/**
 * Elite Playwright Configuration for Sovren
 * Comprehensive E2E testing across browsers and devices
 */
export default defineConfig({
  testDir: './e2e',

  // Global test settings
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 30 * 1000, // 30 seconds per test
  expect: {
    timeout: 5 * 1000, // 5 seconds for assertions
  },

  // Comprehensive reporting
  reporter: [
    [
      'html',
      {
        outputFolder: 'test-results/playwright-report',
        open: process.env.CI ? 'never' : 'on-failure',
      },
    ],
    [
      'junit',
      {
        outputFile: 'test-results/playwright-junit.xml',
      },
    ],
    [
      'json',
      {
        outputFile: 'test-results/playwright-results.json',
      },
    ],
    ['line'],
    ...(process.env.CI ? [['github'] as const] : []),
  ],

  // Global test configuration
  use: {
    // Base URL for tests
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',

    // Test artifacts
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',

    // Browser settings
    actionTimeout: 10 * 1000,
    navigationTimeout: 30 * 1000,

    // Locale and timezone
    locale: 'en-US',
    timezoneId: 'America/New_York',

    // Permissions
    permissions: ['notifications', 'clipboard-read', 'clipboard-write'],

    // Custom headers
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9',
    },
  },

  // Multi-browser and device testing
  projects: [
    // Setup project for authentication
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
      teardown: 'cleanup',
    },

    // Cleanup project
    {
      name: 'cleanup',
      testMatch: /.*\.cleanup\.ts/,
    },

    // Desktop browsers
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Enable Chrome DevTools Protocol for performance monitoring
        launchOptions: {
          args: ['--enable-automation', '--disable-web-security'],
        },
      },
      dependencies: ['setup'],
    },

    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        launchOptions: {
          firefoxUserPrefs: {
            'dom.webnotifications.enabled': true,
            'media.navigator.permission.disabled': true,
          },
        },
      },
      dependencies: ['setup'],
    },

    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
        // Safari-specific settings
        launchOptions: {
          args: ['--disable-web-security'],
        },
      },
      dependencies: ['setup'],
    },

    // Mobile devices - iOS
    {
      name: 'Mobile Safari',
      use: {
        ...devices['iPhone 13'],
        // Mobile-specific settings
        hasTouch: true,
        isMobile: true,
      },
      dependencies: ['setup'],
    },

    {
      name: 'iPad',
      use: {
        ...devices['iPad Pro'],
        hasTouch: true,
        isMobile: false,
      },
      dependencies: ['setup'],
    },

    // Mobile devices - Android
    {
      name: 'Mobile Chrome',
      use: {
        ...devices['Pixel 5'],
        hasTouch: true,
        isMobile: true,
      },
      dependencies: ['setup'],
    },

    {
      name: 'Galaxy Tab',
      use: {
        ...devices['Galaxy Tab S4'],
        hasTouch: true,
        isMobile: false,
      },
      dependencies: ['setup'],
    },

    // High DPI displays
    {
      name: 'High DPI',
      use: {
        ...devices['Desktop Chrome HiDPI'],
        deviceScaleFactor: 2,
      },
      dependencies: ['setup'],
    },

    // Dark mode testing
    {
      name: 'Dark Mode',
      use: {
        ...devices['Desktop Chrome'],
        colorScheme: 'dark',
      },
      dependencies: ['setup'],
    },

    // Slow network simulation
    {
      name: 'Slow 3G',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: ['--throttling.cpuSlowdownMultiplier=4'],
        },
      },
      dependencies: ['setup'],
    },
  ],

  // Web server configuration
  webServer: [
    // Frontend development server
    {
      command: 'npm run dev',
      port: 3000,
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000, // 2 minutes
      env: {
        NODE_ENV: 'test',
        PORT: '3000',
      },
    },

    // Backend API server (if needed separately)
    {
      command: 'npm run dev:backend',
      port: 3001,
      reuseExistingServer: !process.env.CI,
      timeout: 60 * 1000, // 1 minute
      env: {
        NODE_ENV: 'test',
        PORT: '3001',
        DATABASE_URL: process.env.TEST_DATABASE_URL || '',
      },
    },
  ],

  // Global setup and teardown
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',

  // Test output directories
  outputDir: 'test-results/playwright-output',
  snapshotDir: './e2e/screenshots',

  // Metadata
  metadata: {
    'test-framework': 'Playwright',
    project: 'Sovren E2E Tests',
    environment: process.env.NODE_ENV || 'development',
    'base-url': process.env.E2E_BASE_URL || 'http://localhost:3000',
  },
});
