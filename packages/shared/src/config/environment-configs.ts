/**
 * 🌍 Elite Environment Configuration Management
 * Environment-specific configurations with automatic detection,
 * switching mechanisms, and validation
 */

import { type EnvironmentConfig } from './environment';

// 🏷️ Environment Types
export type Environment = 'development' | 'staging' | 'production' | 'test';

// 📋 Environment-Specific Configuration Interface
export interface EnvironmentSpecificConfig {
  name: Environment;
  description: string;
  variables: Partial<EnvironmentConfig>;
  required: string[];
  optional: string[];
  features: {
    [key: string]: boolean;
  };
  security: {
    minSecretLength: number;
    requireSSL: boolean;
    allowDebug: boolean;
    corsRestricted: boolean;
  };
  performance: {
    cacheEnabled: boolean;
    compressionEnabled: boolean;
    rateLimitStrict: boolean;
  };
  monitoring: {
    metricsEnabled: boolean;
    errorTrackingRequired: boolean;
    analyticsEnabled: boolean;
  };
}

// 🧪 Development Environment Configuration
export const DEVELOPMENT_CONFIG: EnvironmentSpecificConfig = {
  name: 'development',
  description: 'Local development environment with relaxed security and enhanced debugging',
  variables: {
    NODE_ENV: 'development',
    PORT: 3001,
    LOG_LEVEL: 'debug',

    // Relaxed security for development
    JWT_EXPIRES_IN: '24h',
    CORS_ORIGIN: 'http://localhost:3000,http://localhost:3001,http://localhost:5173',

    // Development-friendly settings
    DEBUG_ENABLED: true,

    // Relaxed rate limits
    RATE_LIMIT_WINDOW_MS: 900000, // 15 minutes
    RATE_LIMIT_MAX_REQUESTS: 1000,

    // Development Lightning Network
    LIGHTNING_NETWORK: 'testnet',
    LIGHTNING_MIN_AMOUNT: 1000,
    LIGHTNING_MAX_AMOUNT: 100000000,

    // Local services
    REDIS_URL: 'redis://localhost:6379',

    // Analytics disabled in development
    ANALYTICS_ENABLED: false,
    SENTRY_ENVIRONMENT: 'development',
  },
  required: [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'JWT_SECRET',
    'SESSION_SECRET',
    'LNBITS_API_URL',
    'LNBITS_ADMIN_KEY',
    'LNBITS_INVOICE_READ_KEY',
    'LNBITS_WEBHOOK_SECRET',
    'NOSTR_RELAYS',
  ],
  optional: [
    'DATABASE_URL',
    'REDIS_PASSWORD',
    'OPENAI_API_KEY',
    'SENTRY_DSN',
    'NOSTR_PRIVATE_KEY',
    'NOSTR_PUBLIC_KEY',
  ],
  features: {
    FEATURE_LIGHTNING_PAYMENTS: true,
    FEATURE_AI_CONTENT_GENERATION: true,
    FEATURE_NOSTR_PUBLISHING: true,
    FEATURE_CONTENT_MONETIZATION: true,
    FEATURE_PREMIUM_SUBSCRIPTIONS: true,
  },
  security: {
    minSecretLength: 32,
    requireSSL: false,
    allowDebug: true,
    corsRestricted: false,
  },
  performance: {
    cacheEnabled: true,
    compressionEnabled: false,
    rateLimitStrict: false,
  },
  monitoring: {
    metricsEnabled: false,
    errorTrackingRequired: false,
    analyticsEnabled: false,
  },
};

// 🚀 Production Environment Configuration
export const PRODUCTION_CONFIG: EnvironmentSpecificConfig = {
  name: 'production',
  description: 'Production environment with maximum security and performance',
  variables: {
    NODE_ENV: 'production',
    PORT: 3001,
    LOG_LEVEL: 'warn',

    // Maximum security
    JWT_EXPIRES_IN: '7d',

    // Production optimizations
    DEBUG_ENABLED: false,

    // Strict rate limits
    RATE_LIMIT_WINDOW_MS: 900000, // 15 minutes
    RATE_LIMIT_MAX_REQUESTS: 100,

    // Production Lightning Network
    LIGHTNING_NETWORK: 'mainnet',
    LIGHTNING_MIN_AMOUNT: 1000,
    LIGHTNING_MAX_AMOUNT: 100000000,

    // Production analytics
    ANALYTICS_ENABLED: true,
    SENTRY_ENVIRONMENT: 'production',
  },
  required: [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'JWT_SECRET',
    'SESSION_SECRET',
    'LNBITS_API_URL',
    'LNBITS_ADMIN_KEY',
    'LNBITS_INVOICE_READ_KEY',
    'LNBITS_WEBHOOK_SECRET',
    'NOSTR_RELAYS',
    'DOMAIN',
    'SSL_EMAIL',
    'CORS_ORIGIN',
    'SENTRY_DSN',
  ],
  optional: [
    'DATABASE_URL',
    'REDIS_PASSWORD',
    'OPENAI_API_KEY',
    'NOSTR_PRIVATE_KEY',
    'NOSTR_PUBLIC_KEY',
  ],
  features: {
    FEATURE_LIGHTNING_PAYMENTS: true,
    FEATURE_AI_CONTENT_GENERATION: true,
    FEATURE_NOSTR_PUBLISHING: true,
    FEATURE_CONTENT_MONETIZATION: true,
    FEATURE_PREMIUM_SUBSCRIPTIONS: true,
  },
  security: {
    minSecretLength: 64,
    requireSSL: true,
    allowDebug: false,
    corsRestricted: true,
  },
  performance: {
    cacheEnabled: true,
    compressionEnabled: true,
    rateLimitStrict: true,
  },
  monitoring: {
    metricsEnabled: true,
    errorTrackingRequired: true,
    analyticsEnabled: true,
  },
};

// 🧪 Test Environment Configuration
export const TEST_CONFIG: EnvironmentSpecificConfig = {
  name: 'test',
  description: 'Testing environment with isolated resources and fast execution',
  variables: {
    NODE_ENV: 'test',
    PORT: 3002,
    LOG_LEVEL: 'error', // Minimal logging for faster tests

    // Test-specific settings
    DEBUG_ENABLED: false,

    // No rate limits for testing
    RATE_LIMIT_WINDOW_MS: 60000,
    RATE_LIMIT_MAX_REQUESTS: 10000,

    // Test Lightning Network
    LIGHTNING_NETWORK: 'regtest',
    LIGHTNING_MIN_AMOUNT: 1,
    LIGHTNING_MAX_AMOUNT: 1000000,

    // Disable external services
    ANALYTICS_ENABLED: false,
    SENTRY_ENVIRONMENT: 'test',
  },
  required: ['JWT_SECRET', 'SESSION_SECRET'],
  optional: [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'LNBITS_API_URL',
    'LNBITS_ADMIN_KEY',
    'NOSTR_RELAYS',
  ],
  features: {
    FEATURE_LIGHTNING_PAYMENTS: false, // Mocked in tests
    FEATURE_AI_CONTENT_GENERATION: false, // Mocked in tests
    FEATURE_NOSTR_PUBLISHING: false, // Mocked in tests
    FEATURE_CONTENT_MONETIZATION: true,
    FEATURE_PREMIUM_SUBSCRIPTIONS: true,
  },
  security: {
    minSecretLength: 16, // Relaxed for testing
    requireSSL: false,
    allowDebug: true,
    corsRestricted: false,
  },
  performance: {
    cacheEnabled: false, // Disabled for test isolation
    compressionEnabled: false,
    rateLimitStrict: false,
  },
  monitoring: {
    metricsEnabled: false,
    errorTrackingRequired: false,
    analyticsEnabled: false,
  },
};

// 📊 Environment Configuration Registry
export const ENVIRONMENT_CONFIGS: Record<Environment, EnvironmentSpecificConfig> = {
  development: DEVELOPMENT_CONFIG,
  staging: DEVELOPMENT_CONFIG, // Use development config for staging
  production: PRODUCTION_CONFIG,
  test: TEST_CONFIG,
};

// 🔍 Environment Detection and Management
export class EnvironmentManager {
  private currentEnvironment: Environment;
  private config: EnvironmentSpecificConfig;

  constructor(env: Record<string, string | undefined> = process.env) {
    this.currentEnvironment = this.detectEnvironment(env);
    this.config = ENVIRONMENT_CONFIGS[this.currentEnvironment];
  }

  /**
   * Detect current environment from environment variables
   */
  private detectEnvironment(env: Record<string, string | undefined>): Environment {
    const nodeEnv = env.NODE_ENV?.toLowerCase();

    // Explicit test environment
    if (nodeEnv === 'test' || env.NODE_ENV === 'testing') {
      return 'test';
    }

    // Node environment detection
    if (nodeEnv === 'production') {
      return 'production';
    }

    // Default to development
    return 'development';
  }

  /**
   * Get current environment name
   */
  getCurrentEnvironment(): Environment {
    return this.currentEnvironment;
  }

  /**
   * Get current environment configuration
   */
  getConfig(): EnvironmentSpecificConfig {
    return this.config;
  }

  /**
   * Check if current environment matches
   */
  isEnvironment(env: Environment): boolean {
    return this.currentEnvironment === env;
  }

  /**
   * Check if running in development
   */
  isDevelopment(): boolean {
    return this.currentEnvironment === 'development';
  }

  /**
   * Check if running in production
   */
  isProduction(): boolean {
    return this.currentEnvironment === 'production';
  }

  /**
   * Check if running in test
   */
  isTest(): boolean {
    return this.currentEnvironment === 'test';
  }
}

// 🚀 Utility Functions
export function createEnvironmentManager(
  env: Record<string, string | undefined> = process.env
): EnvironmentManager {
  return new EnvironmentManager(env);
}

export function getCurrentEnvironment(
  env: Record<string, string | undefined> = process.env
): Environment {
  const manager = new EnvironmentManager(env);
  return manager.getCurrentEnvironment();
}

export function getEnvironmentConfig(
  environment?: Environment,
  env: Record<string, string | undefined> = process.env
): EnvironmentSpecificConfig {
  if (environment) {
    return ENVIRONMENT_CONFIGS[environment];
  }
  const manager = new EnvironmentManager(env);
  return manager.getConfig();
}

// Export environment manager instance
export const environmentManager = new EnvironmentManager();
