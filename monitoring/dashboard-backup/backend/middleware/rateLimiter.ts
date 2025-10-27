/**
 * Rate Limiting Middleware - PAY-016
 *
 * Protect payment endpoints from abuse and DDoS attacks.
 * Uses sliding window algorithm for accurate rate limiting.
 *
 * @module middleware/rateLimiter
 * @story PAY-016
 */

import { Request, Response, NextFunction } from 'express';

/**
 * Rate limiter configuration
 */
export interface RateLimiterConfig {
  /** Max requests per window */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Custom key generator (default: IP address) */
  keyGenerator?: (req: Request) => string;
  /** Custom message */
  message?: string;
  /** Skip failed requests (default: false) */
  skipFailedRequests?: boolean;
  /** Skip successful requests (default: false) */
  skipSuccessfulRequests?: boolean;
}

/**
 * Request tracking entry
 */
interface RequestEntry {
  count: number;
  timestamps: number[];
}

/**
 * In-memory rate limiter store
 * In production, use Redis for distributed rate limiting
 */
class RateLimiterStore {
  private store: Map<string, RequestEntry> = new Map();
  private cleanupInterval?: NodeJS.Timeout;

  constructor(cleanupIntervalMs: number = 60000) {
    // Cleanup expired entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, cleanupIntervalMs);

    this.cleanupInterval.unref();
  }

  /**
   * Check if request is allowed
   */
  isAllowed(key: string, maxRequests: number, windowMs: number): boolean {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry) {
      this.store.set(key, {
        count: 1,
        timestamps: [now],
      });
      return true;
    }

    // Remove timestamps outside the window
    const validTimestamps = entry.timestamps.filter(
      (timestamp) => now - timestamp < windowMs
    );

    if (validTimestamps.length < maxRequests) {
      validTimestamps.push(now);
      this.store.set(key, {
        count: validTimestamps.length,
        timestamps: validTimestamps,
      });
      return true;
    }

    return false;
  }

  /**
   * Get current request count for key
   */
  getCount(key: string, windowMs: number): number {
    const entry = this.store.get(key);
    if (!entry) return 0;

    const now = Date.now();
    const validTimestamps = entry.timestamps.filter(
      (timestamp) => now - timestamp < windowMs
    );

    return validTimestamps.length;
  }

  /**
   * Reset rate limit for key
   */
  reset(key: string): void {
    this.store.delete(key);
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    const maxAge = 60 * 60 * 1000; // 1 hour

    for (const [key, entry] of this.store.entries()) {
      const latestTimestamp = Math.max(...entry.timestamps);
      if (now - latestTimestamp > maxAge) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Stop cleanup interval
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
  }
}

/**
 * Global rate limiter store
 */
const globalStore = new RateLimiterStore();

/**
 * Default key generator (uses IP address)
 */
function defaultKeyGenerator(req: Request): string {
  return req.ip || req.socket.remoteAddress || 'unknown';
}

/**
 * Create rate limiter middleware
 */
export function createRateLimiter(config: RateLimiterConfig) {
  const {
    maxRequests,
    windowMs,
    keyGenerator = defaultKeyGenerator,
    message = 'Rate limit exceeded',
    skipFailedRequests = false,
    skipSuccessfulRequests = false,
  } = config;

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = keyGenerator(req);
    const isAllowed = globalStore.isAllowed(key, maxRequests, windowMs);

    if (!isAllowed) {
      const retryAfter = Math.ceil(windowMs / 1000);

      res.status(429).json({
        error: message,
        code: 'RATE_LIMIT_EXCEEDED',
        retry_after_seconds: retryAfter,
      });
      return;
    }

    // Add rate limit headers
    const currentCount = globalStore.getCount(key, windowMs);
    res.setHeader('X-RateLimit-Limit', maxRequests.toString());
    res.setHeader('X-RateLimit-Remaining', (maxRequests - currentCount).toString());
    res.setHeader('X-RateLimit-Reset', new Date(Date.now() + windowMs).toISOString());

    // Track response status for skip logic
    if (skipFailedRequests || skipSuccessfulRequests) {
      const originalJson = res.json.bind(res);
      res.json = function (body: any) {
        const statusCode = res.statusCode;

        if (
          (skipSuccessfulRequests && statusCode < 400) ||
          (skipFailedRequests && statusCode >= 400)
        ) {
          // Remove this request from count
          // (Not implemented in simple store, would need Redis DECR)
        }

        return originalJson(body);
      };
    }

    next();
  };
}

/**
 * Preset configurations
 */
export const RateLimitPresets = {
  /** Strict: 10 requests per minute */
  STRICT: {
    maxRequests: 10,
    windowMs: 60 * 1000,
  },

  /** Standard: 100 requests per minute */
  STANDARD: {
    maxRequests: 100,
    windowMs: 60 * 1000,
  },

  /** Relaxed: 1000 requests per minute */
  RELAXED: {
    maxRequests: 1000,
    windowMs: 60 * 1000,
  },

  /** Payment endpoints: 20 requests per minute */
  PAYMENT: {
    maxRequests: 20,
    windowMs: 60 * 1000,
  },

  /** Webhook endpoints: 100 requests per minute */
  WEBHOOK: {
    maxRequests: 100,
    windowMs: 60 * 1000,
  },
};

/**
 * Reset rate limiter for testing
 */
export function resetRateLimiter(req: Request): void {
  const key = defaultKeyGenerator(req);
  globalStore.reset(key);
}
