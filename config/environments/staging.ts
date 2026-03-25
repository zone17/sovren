/**
 * Staging Environment Configuration
 *
 * Purpose: Production parity testing environment
 * Infrastructure: FREE tier resources (Supabase + Upstash + Railway)
 *
 * This configuration mirrors production settings with scaled-down resources
 * for testing features before production deployment.
 */

export interface EnvironmentConfig {
  environment: string;
  api: {
    url: string;
    timeout: number;
    retries: number;
    rateLimit: {
      windowMs: number;
      maxRequests: number;
    };
  };
  database: {
    poolSize: number;
    ssl: boolean;
    connectionTimeout: number;
    idleTimeout: number;
  };
  redis: {
    url: string;
    ttl: number;
    maxRetries: number;
    retryDelay: number;
  };
  logging: {
    level: 'error' | 'warn' | 'info' | 'debug' | 'trace';
    performance: boolean;
    prettyPrint: boolean;
  };
  features: {
    enableBeta: boolean;
    enableDebugTools: boolean;
    enablePerformanceMonitoring: boolean;
    enableErrorTracking: boolean;
  };
  security: {
    corsOrigins: string[];
    secureCookies: boolean;
    helmetEnabled: boolean;
    rateLimitEnabled: boolean;
  };
  monitoring: {
    sentryDsn?: string;
    sentryEnvironment: string;
    sampleRate: number;
  };
}

export const stagingConfig: EnvironmentConfig = {
  environment: 'staging',

  api: {
    url: process.env.VITE_API_URL_STAGING || 'https://api-staging.sovren.dev',
    timeout: 30000, // 30 seconds (generous for testing)
    retries: 3,
    rateLimit: {
      windowMs: 60000, // 1 minute
      maxRequests: 100, // Relaxed for testing
    },
  },

  database: {
    poolSize: 10, // Moderate pool size for staging
    ssl: true,
    connectionTimeout: 15000,
    idleTimeout: 30000,
  },

  redis: {
    url: process.env.REDIS_URL_STAGING || '',
    ttl: 3600, // 1 hour
    maxRetries: 3,
    retryDelay: 1000,
  },

  logging: {
    level: 'debug', // Verbose logging for debugging
    performance: true,
    prettyPrint: true, // Human-readable logs
  },

  features: {
    enableBeta: true, // Enable beta features for testing
    enableDebugTools: true, // Enable debug tools
    enablePerformanceMonitoring: true,
    enableErrorTracking: true,
  },

  security: {
    corsOrigins: ['https://staging.sovren.dev', 'http://localhost:3000', 'http://localhost:5173'],
    secureCookies: true,
    helmetEnabled: true,
    rateLimitEnabled: true,
  },

  monitoring: {
    sentryDsn: process.env.SENTRY_DSN_STAGING,
    sentryEnvironment: 'staging',
    sampleRate: 1.0, // 100% sampling for staging
  },
};

export default stagingConfig;
