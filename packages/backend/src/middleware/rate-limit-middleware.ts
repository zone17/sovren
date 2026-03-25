/**
 * Rate Limiting Middleware
 *
 * Provides configurable rate limiting for API endpoints
 * Prevents abuse and ensures fair resource allocation
 */

import crypto from 'crypto';
import rateLimit, { Options, RateLimitRequestHandler } from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { Request, Response } from 'express';
import { RateLimitError } from './error-handler-middleware';
import { getRedisClient as getSharedRedisClient, isRedisAvailable } from '../lib/redis';

// ============================================================================
// Rate Limit Configuration
// ============================================================================

interface RateLimitConfig {
  windowMs: number;
  max: number;
  message?: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

// ============================================================================
// Redis Store Factory (with in-memory fallback)
// ============================================================================

/**
 * Returns a RedisStore if Redis is connected, otherwise undefined (in-memory default).
 * This ensures rate limits are shared across instances in production
 * while gracefully degrading to per-process limits in dev/test.
 */
function getStore(): RedisStore | undefined {
  if (!isRedisAvailable()) return undefined;
  try {
    const client = getSharedRedisClient();
    return new RedisStore({
      sendCommand: (...args: string[]) =>
        client.call(...(args as [string, ...string[]])) as Promise<
          boolean | number | string | (boolean | number | string)[]
        >,
    });
  } catch {
    return undefined;
  }
}

// ============================================================================
// Default Rate Limit Options
// ============================================================================

const defaultOptions: Partial<Options> = {
  standardHeaders: true, // Return rate limit info in headers
  legacyHeaders: false, // Disable X-RateLimit-* headers
  skip: (req: Request) => {
    // Skip rate limiting for health checks
    return req.path === '/health' || req.path === '/api/health';
  },
  handler: (req: Request, res: Response) => {
    throw new RateLimitError('Too many requests from this IP, please try again later', {
      retryAfter: Math.ceil(res.getHeader('Retry-After') as number),
    });
  },
};

// ============================================================================
// Rate Limit Presets
// ============================================================================

/**
 * Strict rate limit for authentication endpoints
 */
export const authRateLimiter: RateLimitRequestHandler = rateLimit({
  ...defaultOptions,
  store: getStore(),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per window
  skipSuccessfulRequests: true, // Don't count successful logins
  message: 'Too many authentication attempts, please try again later',
});

/**
 * Moderate rate limit for content creation endpoints
 */
export const contentCreationRateLimiter: RateLimitRequestHandler = rateLimit({
  ...defaultOptions,
  store: getStore(),
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 content publishes per minute
  message: 'Too many content publications, please slow down',
});

/**
 * Moderate rate limit for payment endpoints
 */
export const paymentRateLimiter: RateLimitRequestHandler = rateLimit({
  ...defaultOptions,
  store: getStore(),
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 payment operations per minute
  message: 'Too many payment requests, please try again later',
});

/**
 * Generous rate limit for read-only endpoints
 */
export const readOnlyRateLimiter: RateLimitRequestHandler = rateLimit({
  ...defaultOptions,
  store: getStore(),
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 reads per minute
  message: 'Too many requests, please slow down',
});

/**
 * Very strict rate limit for expensive operations (search, analytics)
 */
export const expensiveOperationRateLimiter: RateLimitRequestHandler = rateLimit({
  ...defaultOptions,
  store: getStore(),
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 operations per minute
  message: 'Too many expensive operations, please try again later',
});

/**
 * Moderate rate limit for webhook registration
 */
export const webhookRateLimiter: RateLimitRequestHandler = rateLimit({
  ...defaultOptions,
  store: getStore(),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 webhook registrations per 15 minutes
  message: 'Too many webhook registration attempts',
});

// ============================================================================
// Custom Rate Limiter Factory
// ============================================================================

/**
 * Create a custom rate limiter with specific configuration
 *
 * @param config - Rate limit configuration
 * @returns Rate limit middleware
 *
 * @example
 * ```typescript
 * const customLimiter = createRateLimiter({
 *   windowMs: 5 * 60 * 1000, // 5 minutes
 *   max: 50,
 *   message: 'Custom rate limit message'
 * });
 * ```
 */
export function createRateLimiter(config: RateLimitConfig): RateLimitRequestHandler {
  return rateLimit({
    ...defaultOptions,
    store: getStore(),
    ...config,
    message: config.message || 'Too many requests, please try again later',
  });
}

// ============================================================================
// Redis-backed Rate Limiter (for production)
// ============================================================================

/**
 * Create rate limiter with Redis store for distributed systems
 * Use this in production when running multiple API instances
 */
export function createRedisRateLimiter(config: RateLimitConfig): RateLimitRequestHandler {
  const client = getSharedRedisClient();

  return rateLimit({
    ...defaultOptions,
    ...config,
    store: new RedisStore({
      sendCommand: (...args: string[]) =>
        client.call(...(args as [string, ...string[]])) as Promise<
          boolean | number | string | (boolean | number | string)[]
        >,
    }),
    message: config.message || 'Too many requests, please try again later',
  });
}

// ============================================================================
// Per-User Rate Limiting
// ============================================================================

/**
 * Rate limiter that uses user ID instead of IP address
 * Requires authentication middleware to run first
 */
export function createUserRateLimiter(config: RateLimitConfig): RateLimitRequestHandler {
  return rateLimit({
    ...defaultOptions,
    ...config,
    keyGenerator: (req: Request) => {
      // Use user's NOSTR pubkey if authenticated, otherwise fall back to IP
      const user = req.user;
      return user?.nostr_pubkey || req.ip || 'unknown';
    },
    message: config.message || 'Too many requests, please try again later',
  });
}

// ============================================================================
// Endpoint-Specific Rate Limiters
// ============================================================================

/**
 * Rate limiters organized by API domain
 */
export const rateLimiters = {
  // Content API rate limiters
  content: {
    publish: contentCreationRateLimiter,
    moderate: createRateLimiter({
      windowMs: 60 * 1000,
      max: 50, // 50 moderation actions per minute
    }),
    search: expensiveOperationRateLimiter,
    recommendations: expensiveOperationRateLimiter,
    analytics: expensiveOperationRateLimiter,
    read: readOnlyRateLimiter,
  },

  // User API rate limiters
  user: {
    updateProfile: createRateLimiter({
      windowMs: 60 * 1000,
      max: 5, // 5 profile updates per minute
    }),
    updatePreferences: createRateLimiter({
      windowMs: 60 * 1000,
      max: 10, // 10 preference updates per minute
    }),
    follow: createRateLimiter({
      windowMs: 60 * 1000,
      max: 30, // 30 follow/unfollow actions per minute
    }),
    analytics: expensiveOperationRateLimiter,
    read: readOnlyRateLimiter,
    deleteAccount: createRateLimiter({
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 3, // 3 deletion attempts per hour — high-stakes, low-frequency
    }),
    dataExport: createRateLimiter({
      windowMs: 24 * 60 * 60 * 1000, // 24 hours
      max: 5, // 5 export requests per day
    }),
  },

  // Payment API rate limiters
  payment: {
    createInvoice: paymentRateLimiter,
    payInvoice: paymentRateLimiter,
    createSubscription: createRateLimiter({
      windowMs: 60 * 1000,
      max: 5, // 5 subscription creations per minute
    }),
    createRefund: createRateLimiter({
      windowMs: 60 * 1000,
      max: 10, // 10 refund requests per minute
    }),
    webhook: webhookRateLimiter,
    analytics: expensiveOperationRateLimiter,
    read: readOnlyRateLimiter,
  },

  // Authentication rate limiter
  auth: authRateLimiter,

  // General rate limiter
  general: readOnlyRateLimiter,
};

// ============================================================================
// Rate Limit Bypass for Testing
// ============================================================================

/**
 * Bypass rate limiting in test environment
 */
export const bypassRateLimitInTest = (req: Request): boolean => {
  if (process.env.NODE_ENV === 'test') {
    return true;
  }

  // Allow bypass with special header in development (timing-safe comparison)
  if (process.env.NODE_ENV === 'development') {
    const header = req.headers['x-bypass-rate-limit'];
    const secret = process.env.RATE_LIMIT_BYPASS_SECRET;
    if (typeof header === 'string' && secret && header.length === secret.length) {
      return crypto.timingSafeEqual(Buffer.from(header), Buffer.from(secret));
    }
    return false;
  }

  return false;
};
