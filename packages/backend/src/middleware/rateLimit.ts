import { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';

// 🚦 ELITE RATE LIMITING MIDDLEWARE
// Advanced DDoS protection and abuse prevention for Sovren API

/**
 * Rate limit configuration type
 */
export interface RateLimitConfig {
  windowMs: number;
  max: number;
  message: string;
  standardHeaders?: boolean;
  legacyHeaders?: boolean;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: Request) => string;
}

/**
 * Default rate limit configurations for different endpoints
 */
const DEFAULT_CONFIGS = {
  // General API endpoints
  default: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // 1000 requests per window
    message: 'Too many requests from this IP',
    standardHeaders: true,
    legacyHeaders: false,
  },

  // Authentication endpoints
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // 20 login attempts per window
    message: 'Too many authentication attempts',
    standardHeaders: true,
    legacyHeaders: false,
  },

  // Lightning Network endpoints
  lightning: {
    windowMs: 60 * 1000, // 1 minute
    max: 30, // 30 requests per minute
    message: 'Too many Lightning Network requests',
    standardHeaders: true,
    legacyHeaders: false,
  },

  // Invoice creation (more restrictive)
  invoices: {
    windowMs: 60 * 1000, // 1 minute
    max: 10, // 10 invoices per minute
    message: 'Too many invoice creation requests',
    standardHeaders: true,
    legacyHeaders: false,
  },

  // Webhook endpoints
  webhooks: {
    windowMs: 60 * 1000, // 1 minute
    max: 100, // 100 webhook requests per minute
    message: 'Too many webhook requests',
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true, // Don't count successful webhooks
  },

  // User operations
  users: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 user operations per window
    message: 'Too many user requests',
    standardHeaders: true,
    legacyHeaders: false,
  },
};

/**
 * Advanced key generator that considers IP, user, and endpoint
 */
const advancedKeyGenerator = (prefix: string) => (req: Request): string => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const userKey = req.user?.nostr_pubkey || 'anonymous';
  return `${prefix}:${ip}:${userKey}`;
};

/**
 * Create rate limiter with custom configuration
 */
export function rateLimiter(config: Partial<RateLimitConfig> = {}) {
  const finalConfig = {
    ...DEFAULT_CONFIGS.default,
    ...config,
  };

  return rateLimit({
    windowMs: finalConfig.windowMs,
    max: finalConfig.max,
    message: {
      success: false,
      error: 'Rate limit exceeded',
      message: finalConfig.message,
      retryAfter: Math.ceil(finalConfig.windowMs / 1000),
      timestamp: new Date().toISOString(),
    },
    standardHeaders: finalConfig.standardHeaders,
    legacyHeaders: finalConfig.legacyHeaders,
    skipSuccessfulRequests: finalConfig.skipSuccessfulRequests,
    skipFailedRequests: finalConfig.skipFailedRequests,
    keyGenerator: finalConfig.keyGenerator,
    handler: (req: Request, res: Response) => {
      console.warn(`🚨 Rate limit exceeded for ${req.ip} on ${req.path}`);
      res.status(429).json({
        success: false,
        error: 'Rate limit exceeded',
        message: finalConfig.message,
        retryAfter: Math.ceil(finalConfig.windowMs / 1000),
        timestamp: new Date().toISOString(),
        details: {
          windowMs: finalConfig.windowMs,
          maxRequests: finalConfig.max,
          endpoint: req.path,
        },
      });
    },
  });
}

/**
 * Pre-configured rate limiters for common use cases
 */
export const authRateLimit = rateLimiter({
  ...DEFAULT_CONFIGS.auth,
  keyGenerator: advancedKeyGenerator('auth'),
});

export const lightningRateLimit = rateLimiter({
  ...DEFAULT_CONFIGS.lightning,
  keyGenerator: advancedKeyGenerator('lightning'),
});

export const invoiceRateLimit = rateLimiter({
  ...DEFAULT_CONFIGS.invoices,
  keyGenerator: advancedKeyGenerator('invoices'),
});

export const webhookRateLimit = rateLimiter({
  ...DEFAULT_CONFIGS.webhooks,
  keyGenerator: advancedKeyGenerator('webhooks'),
});

export const userRateLimit = rateLimiter({
  ...DEFAULT_CONFIGS.users,
  keyGenerator: advancedKeyGenerator('users'),
});

/**
 * Strict rate limiter for sensitive operations
 */
export const strictRateLimit = rateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 requests per minute
  message: 'Too many sensitive operation requests',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: advancedKeyGenerator('strict'),
});

/**
 * Create endpoint-specific rate limiter
 */
export function createEndpointRateLimit(endpoint: string, customConfig: Partial<RateLimitConfig> = {}) {
  return rateLimiter({
    ...DEFAULT_CONFIGS.default,
    ...customConfig,
    keyGenerator: advancedKeyGenerator(endpoint),
  });
}

/**
 * IP-based rate limiter (more permissive for known users)
 */
export const ipBasedRateLimit = rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 2000, // Higher limit for authenticated users
  message: 'Too many requests from this IP address',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    // More generous limits for authenticated users
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const multiplier = req.user ? 2 : 1; // Double the limit for authenticated users
    return `ip:${ip}:${multiplier}`;
  },
});

/**
 * Global rate limiter for all API endpoints
 */
export const globalRateLimit = rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5000, // 5000 requests per window globally
  message: 'Global rate limit exceeded',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    return `global:${req.ip || 'unknown'}`;
  },
});

export default rateLimiter;
