/**
 * Production Environment Configuration
 *
 * Purpose: Live production environment serving real users
 * Infrastructure: FREE tier resources (Supabase + Upstash + Railway)
 * High Availability: 2 replicas per service for zero-downtime deployments
 *
 * This configuration is optimized for performance, security, and reliability
 * while staying within free tier limits.
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
    replication: boolean;
    connectionTimeout: number;
    idleTimeout: number;
  };
  redis: {
    url: string;
    ttl: number;
    cluster: boolean;
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
  cdn: {
    enabled: boolean;
    url: string;
  };
  monitoring: {
    sentryDsn?: string;
    sentryEnvironment: string;
    sampleRate: number;
  };
}

export const productionConfig: EnvironmentConfig = {
  environment: 'production',

  api: {
    url: process.env.VITE_API_URL || 'https://api.sovren.dev',
    timeout: 10000, // 10 seconds (strict for production)
    retries: 5, // More retries for reliability
    rateLimit: {
      windowMs: 900000, // 15 minutes
      maxRequests: 100, // Stricter limits
    },
  },

  database: {
    poolSize: 50, // Maximum connections within free tier
    ssl: true,
    replication: true, // Enable read replicas if available
    connectionTimeout: 10000,
    idleTimeout: 60000,
  },

  redis: {
    url: process.env.REDIS_URL || '',
    ttl: 7200, // 2 hours (longer for production)
    cluster: false, // Single instance (free tier)
    maxRetries: 5,
    retryDelay: 2000,
  },

  logging: {
    level: 'error', // Only errors in production (reduce noise)
    performance: false, // Disable performance logs in production
    prettyPrint: false, // JSON logs for parsing
  },

  features: {
    enableBeta: false, // No beta features in production
    enableDebugTools: false, // No debug tools in production
    enablePerformanceMonitoring: true,
    enableErrorTracking: true,
  },

  security: {
    corsOrigins: ['https://sovren.dev', 'https://www.sovren.dev'],
    secureCookies: true,
    helmetEnabled: true,
    rateLimitEnabled: true,
  },

  cdn: {
    enabled: true,
    url: process.env.CDN_URL || 'https://cdn.sovren.dev',
  },

  monitoring: {
    sentryDsn: process.env.SENTRY_DSN,
    sentryEnvironment: 'production',
    sampleRate: 0.1, // 10% sampling (reduce Sentry usage)
  },
};

export default productionConfig;
