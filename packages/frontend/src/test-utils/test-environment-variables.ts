/**
 * 🌍 **ELITE TEST ENVIRONMENT VARIABLES**
 *
 * **Purpose**: Comprehensive environment variable setup for testing
 * **Architecture**: Complete mock environment with all required variables
 * **Security**: Safe test values that don't expose production credentials
 * **Performance**: Fast loading environment configuration
 *
 * @author Elite Engineering Team
 * @version 1.0.0 - US-201 Test Infrastructure Repair
 * @lastModified 2024-12-28
 */

// 🔧 **TEST ENVIRONMENT CONFIGURATION**
export const TEST_ENVIRONMENT_VARIABLES = {
  // 🚀 **CORE APPLICATION SETTINGS**
  NODE_ENV: 'test',
  DEV: 'false',
  MODE: 'test',
  PROD: 'false',
  CI: process.env.CI || 'false',

  // 🗄️ **SUPABASE CONFIGURATION**
  VITE_SUPABASE_URL: 'https://test-project.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-anon-key',
  VITE_SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
  VITE_SUPABASE_JWT_SECRET: 'test-jwt-secret',

  // ⚡ **VERCEL CONFIGURATION**
  VITE_VERCEL_URL: 'https://test-sovren.vercel.app',
  VITE_VERCEL_ENV: 'test',
  VITE_VERCEL_REGION: 'test-region',

  // 🌐 **NOSTR PROTOCOL SETTINGS**
  VITE_ENABLE_NOSTR_INTEGRATION: 'true',
  VITE_NOSTR_RELAY_URL: 'wss://test-relay.nostr.com',
  VITE_NOSTR_RELAY_BACKUP: 'wss://test-backup-relay.nostr.com',
  VITE_DEFAULT_NOSTR_RELAYS: JSON.stringify([
    'wss://test-relay1.nostr.com',
    'wss://test-relay2.nostr.com',
    'wss://test-relay3.nostr.com',
  ]),

  // ⚡ **LIGHTNING NETWORK SETTINGS**
  VITE_ENABLE_LIGHTNING_PAYMENTS: 'true',
  VITE_LNBITS_URL: 'https://test-lnbits.com',
  VITE_LNBITS_API_KEY: 'test-lnbits-api-key',
  VITE_LIGHTNING_WALLET_KEY: 'test-wallet-key',
  VITE_LIGHTNING_INVOICE_EXPIRY: '3600',

  // 🎨 **CMS AND CONTENT SETTINGS**
  VITE_ENABLE_CMS: 'true',
  VITE_CMS_API_URL: 'https://test-cms-api.com',
  VITE_CMS_API_KEY: 'test-cms-api-key',
  VITE_CONTENT_API_URL: 'https://test-content-api.com',

  // 🤖 **AI ASSISTANT SETTINGS**
  VITE_ENABLE_AI_ASSISTANT: 'true',
  VITE_OPENAI_API_KEY: 'test-openai-api-key',
  VITE_AI_API_URL: 'https://test-ai-api.com',
  VITE_AI_MODEL: 'gpt-4-test',

  // 📊 **ANALYTICS SETTINGS**
  VITE_ANALYTICS_API_URL: 'https://test-analytics-api.com',
  VITE_ANALYTICS_API_KEY: 'test-analytics-api-key',
  VITE_GOOGLE_ANALYTICS_ID: 'GA-TEST-123456',
  VITE_MIXPANEL_TOKEN: 'test-mixpanel-token',
  VITE_ENABLE_ANALYTICS: 'true',

  // 💳 **PAYMENT PROCESSING**
  VITE_STRIPE_PUBLISHABLE_KEY: 'pk_test_stripe_key',
  VITE_STRIPE_SECRET_KEY: 'sk_test_stripe_secret',
  VITE_STRIPE_WEBHOOK_SECRET: 'whsec_test_webhook_secret',
  VITE_ENABLE_STRIPE: 'true',

  // 📧 **EMAIL SERVICES**
  VITE_EMAIL_API_URL: 'https://test-email-api.com',
  VITE_EMAIL_API_KEY: 'test-email-api-key',
  VITE_SENDGRID_API_KEY: 'SG.test-sendgrid-key',
  VITE_MAILGUN_API_KEY: 'test-mailgun-key',
  VITE_EMAIL_FROM_ADDRESS: 'test@sovren.app',

  // 🌐 **SOCIAL MEDIA INTEGRATION**
  VITE_TWITTER_API_KEY: 'test-twitter-api-key',
  VITE_TWITTER_API_SECRET: 'test-twitter-api-secret',
  VITE_GITHUB_CLIENT_ID: 'test-github-client-id',
  VITE_GITHUB_CLIENT_SECRET: 'test-github-client-secret',

  // 🔒 **SECURITY SETTINGS**
  VITE_JWT_SECRET: 'test-jwt-secret-key',
  VITE_ENCRYPTION_KEY: 'test-encryption-key-32chars!!',
  VITE_CORS_ORIGIN: 'https://test-sovren.app',
  VITE_CSRF_SECRET: 'test-csrf-secret',

  // 📱 **MOBILE APP SETTINGS**
  VITE_MOBILE_API_URL: 'https://test-mobile-api.com',
  VITE_PUSH_NOTIFICATION_KEY: 'test-push-notification-key',
  VITE_DEEP_LINK_SCHEME: 'sovren-test',

  // 🗄️ **DATABASE SETTINGS**
  VITE_DATABASE_URL: 'postgresql://test:test@localhost:5432/sovren_test',
  VITE_REDIS_URL: 'redis://localhost:6379/0',
  VITE_CACHE_TTL: '300',

  // 🔍 **SEARCH AND INDEXING**
  VITE_SEARCH_API_URL: 'https://test-search-api.com',
  VITE_SEARCH_API_KEY: 'test-search-api-key',
  VITE_ELASTICSEARCH_URL: 'https://test-elasticsearch.com',

  // 📊 **MONITORING AND LOGGING**
  VITE_SENTRY_DSN: 'https://test-sentry-dsn.com',
  VITE_LOG_LEVEL: 'debug',
  VITE_ENABLE_LOGGING: 'true',
  VITE_DATADOG_API_KEY: 'test-datadog-api-key',

  // 🎯 **FEATURE FLAGS**
  VITE_ENABLE_FEATURE_FLAGS: 'true',
  VITE_FEATURE_FLAG_URL: 'https://test-feature-flags.com',
  VITE_FEATURE_FLAG_KEY: 'test-feature-flag-key',

  // 📈 **PERFORMANCE MONITORING**
  VITE_PERFORMANCE_API_URL: 'https://test-performance-api.com',
  VITE_PERFORMANCE_API_KEY: 'test-performance-api-key',
  VITE_ENABLE_PERFORMANCE_MONITORING: 'true',

  // 🌍 **INTERNATIONALIZATION**
  VITE_DEFAULT_LOCALE: 'en-US',
  VITE_SUPPORTED_LOCALES: 'en-US,es-ES,fr-FR,de-DE',
  VITE_TRANSLATION_API_URL: 'https://test-translation-api.com',

  // 🎮 **DEVELOPMENT TOOLS**
  VITE_ENABLE_DEVTOOLS: 'true',
  VITE_ENABLE_STORYBOOK: 'true',
  VITE_ENABLE_HOT_RELOAD: 'true',
  VITE_BUNDLE_ANALYZER: 'false',

  // 🔧 **API ENDPOINTS**
  VITE_API_BASE_URL: 'https://test-api.sovren.app',
  VITE_API_VERSION: 'v1',
  VITE_API_TIMEOUT: '30000',
  VITE_API_RETRY_ATTEMPTS: '3',

  // 🌊 **WEBSOCKET SETTINGS**
  VITE_WS_URL: 'wss://test-ws.sovren.app',
  VITE_WS_RECONNECT_INTERVAL: '5000',
  VITE_WS_MAX_RECONNECT_ATTEMPTS: '10',

  // 📦 **CDN AND ASSETS**
  VITE_CDN_URL: 'https://test-cdn.sovren.app',
  VITE_ASSETS_URL: 'https://test-assets.sovren.app',
  VITE_MEDIA_URL: 'https://test-media.sovren.app',

  // 🧪 **TESTING SPECIFIC**
  VITE_TEST_MODE: 'true',
  VITE_MOCK_API: 'true',
  VITE_DISABLE_ANALYTICS: 'true',
  VITE_SKIP_AUTH: 'false',
  VITE_VERBOSE_TESTS: process.env.VERBOSE_TESTS || 'false',

  // 🔐 **OAUTH PROVIDERS**
  VITE_GOOGLE_CLIENT_ID: 'test-google-client-id',
  VITE_GOOGLE_CLIENT_SECRET: 'test-google-client-secret',
  VITE_FACEBOOK_APP_ID: 'test-facebook-app-id',
  VITE_DISCORD_CLIENT_ID: 'test-discord-client-id',

  // 🎨 **THEME AND UI**
  VITE_DEFAULT_THEME: 'dark',
  VITE_ENABLE_THEME_SWITCHING: 'true',
  VITE_CUSTOM_CSS_URL: 'https://test-custom-css.com',

  // 📱 **PWA SETTINGS**
  VITE_ENABLE_PWA: 'true',
  VITE_PWA_CACHE_NAME: 'sovren-test-cache',
  VITE_SW_UPDATE_INTERVAL: '3600000',

  // 🔄 **BACKUP AND SYNC**
  VITE_BACKUP_API_URL: 'https://test-backup-api.com',
  VITE_SYNC_INTERVAL: '300000',
  VITE_ENABLE_AUTO_BACKUP: 'true',
} as const;

// 🎯 **ENVIRONMENT SETUP FUNCTIONS**

/**
 * Setup test environment variables
 */
export function setupTestEnvironment(): void {
  // Set process.env variables
  Object.entries(TEST_ENVIRONMENT_VARIABLES).forEach(([key, value]) => {
    process.env[key] = value;
  });

  // Setup import.meta.env for Vite
  setupViteEnvironment();

  // Setup globalThis for global access
  setupGlobalEnvironment();
}

/**
 * Setup Vite-specific environment variables
 */
export function setupViteEnvironment(): void {
  const viteEnv = {};

  Object.entries(TEST_ENVIRONMENT_VARIABLES).forEach(([key, value]) => {
    if (key.startsWith('VITE_') || ['NODE_ENV', 'DEV', 'MODE', 'PROD'].includes(key)) {
      viteEnv[key] = value;
    }
  });

  // Mock import.meta.env
  Object.defineProperty(globalThis, 'import', {
    value: {
      meta: {
        env: viteEnv,
      },
    },
    writable: true,
    configurable: true,
  });
}

/**
 * Setup global environment access
 */
export function setupGlobalEnvironment(): void {
  // Add environment to window for client-side access
  if (typeof window !== 'undefined') {
    window.__TEST_ENV__ = TEST_ENVIRONMENT_VARIABLES;
  }

  // Add to global for Node.js access
  if (typeof global !== 'undefined') {
    global.__TEST_ENV__ = TEST_ENVIRONMENT_VARIABLES;
  }
}

/**
 * Get environment variable with fallback
 */
export function getTestEnvVar(key: string, fallback?: string): string {
  return process.env[key] || TEST_ENVIRONMENT_VARIABLES[key] || fallback || '';
}

/**
 * Check if we're in test environment
 */
export function isTestEnvironment(): boolean {
  return process.env.NODE_ENV === 'test' || process.env.VITE_TEST_MODE === 'true';
}

/**
 * Get all environment variables that start with a prefix
 */
export function getEnvVarsByPrefix(prefix: string): Record<string, string> {
  const envVars: Record<string, string> = {};

  Object.entries(TEST_ENVIRONMENT_VARIABLES).forEach(([key, value]) => {
    if (key.startsWith(prefix)) {
      envVars[key] = value;
    }
  });

  return envVars;
}

/**
 * Validate that all required environment variables are set
 */
export function validateTestEnvironment(): { valid: boolean; missing: string[] } {
  const requiredVars = [
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY',
    'VITE_API_BASE_URL',
    'NODE_ENV',
  ];

  const missing: string[] = [];

  requiredVars.forEach((varName) => {
    if (!process.env[varName] && !TEST_ENVIRONMENT_VARIABLES[varName]) {
      missing.push(varName);
    }
  });

  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Override environment variable for testing
 */
export function overrideEnvVar(key: string, value: string): () => void {
  const originalValue = process.env[key];
  process.env[key] = value;

  // Return cleanup function
  return () => {
    if (originalValue !== undefined) {
      process.env[key] = originalValue;
    } else {
      delete process.env[key];
    }
  };
}

/**
 * Create environment variable mock for specific test
 */
export function createEnvMock(overrides: Record<string, string>): () => void {
  const cleanupFunctions: (() => void)[] = [];

  Object.entries(overrides).forEach(([key, value]) => {
    const cleanup = overrideEnvVar(key, value);
    cleanupFunctions.push(cleanup);
  });

  return () => {
    cleanupFunctions.forEach((cleanup) => cleanup());
  };
}

/**
 * Setup environment for analytics testing
 */
export function setupAnalyticsEnvironment(): () => void {
  return createEnvMock({
    VITE_ENABLE_ANALYTICS: 'true',
    VITE_ANALYTICS_API_URL: 'https://test-analytics.com',
    VITE_ANALYTICS_API_KEY: 'test-analytics-key',
    VITE_GOOGLE_ANALYTICS_ID: 'GA-TEST-123',
  });
}

/**
 * Setup environment for payment testing
 */
export function setupPaymentEnvironment(): () => void {
  return createEnvMock({
    VITE_ENABLE_STRIPE: 'true',
    VITE_STRIPE_PUBLISHABLE_KEY: 'pk_test_stripe',
    VITE_ENABLE_LIGHTNING_PAYMENTS: 'true',
    VITE_LNBITS_URL: 'https://test-lnbits.com',
  });
}

/**
 * Setup environment for NOSTR testing
 */
export function setupNostrEnvironment(): () => void {
  return createEnvMock({
    VITE_ENABLE_NOSTR_INTEGRATION: 'true',
    VITE_NOSTR_RELAY_URL: 'wss://test-relay.nostr.com',
    VITE_DEFAULT_NOSTR_RELAYS: JSON.stringify(['wss://test1.com', 'wss://test2.com']),
  });
}

/**
 * Reset environment to default test values
 */
export function resetTestEnvironment(): void {
  // Clear any overrides
  Object.keys(TEST_ENVIRONMENT_VARIABLES).forEach((key) => {
    process.env[key] = TEST_ENVIRONMENT_VARIABLES[key];
  });

  // Re-setup Vite environment
  setupViteEnvironment();
}

// 🧹 **AUTOMATIC SETUP**
// Automatically setup test environment when this module is imported
if (isTestEnvironment()) {
  setupTestEnvironment();
}

// 🎯 **EXPORT INTERFACE**
export {
  getTestEnvVar as getEnv,
  isTestEnvironment,
  setupTestEnvironment,
  TEST_ENVIRONMENT_VARIABLES as testEnv,
  validateTestEnvironment,
};
