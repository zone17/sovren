/**
 * Development Environment Configuration
 *
 * Purpose: Local development environment
 * Infrastructure: Docker Compose (local PostgreSQL + Redis)
 *
 * This configuration provides a comfortable development experience with
 * relaxed security, verbose logging, and hot reload.
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
}

export const developmentConfig: EnvironmentConfig = {
  environment: 'development',

  api: {
    url: process.env.VITE_API_URL || 'http://localhost:4000',
    timeout: 60000, // 60 seconds (generous for debugging)
    retries: 1, // Fail fast in development
    rateLimit: {
      windowMs: 60000,
      maxRequests: 1000, // No real rate limiting in dev
    },
  },

  database: {
    poolSize: 5, // Small pool for local development
    ssl: false, // No SSL for local DB
    connectionTimeout: 30000,
    idleTimeout: 60000,
  },

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    ttl: 1800, // 30 minutes (shorter for testing)
    maxRetries: 1,
    retryDelay: 500,
  },

  logging: {
    level: 'debug', // Maximum verbosity
    performance: true,
    prettyPrint: true, // Human-readable logs
  },

  features: {
    enableBeta: true, // All features enabled
    enableDebugTools: true,
    enablePerformanceMonitoring: true,
    enableErrorTracking: false, // No Sentry in development
  },

  security: {
    corsOrigins: ['*'], // Allow all origins in development
    secureCookies: false, // HTTP cookies OK in development
    helmetEnabled: false, // Relaxed security headers
    rateLimitEnabled: false, // No rate limiting
  },
};

export default developmentConfig;
