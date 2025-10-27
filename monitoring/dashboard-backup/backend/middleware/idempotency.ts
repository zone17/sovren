/**
 * Idempotency Middleware
 *
 * Express middleware to prevent duplicate payment transactions using idempotency keys.
 * Implements RFC-based idempotency patterns with request/response caching.
 *
 * @module middleware/idempotency
 * @story PAY-010
 */

import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';
import { IdempotencyRepository } from '../repositories/IdempotencyRepository';
import {
  IdempotencyConfig,
  IdempotencyValidation,
  IdempotencyCheckResult,
  IdempotencyCacheRequest,
} from '../types/idempotency';

/**
 * Extended Express request with idempotency data
 */
export interface IdempotentRequest extends Request {
  idempotency?: {
    key: string;
    request_hash: string;
    is_cached: boolean;
  };
}

/**
 * Idempotency middleware for Express
 *
 * Usage:
 * ```typescript
 * const middleware = new IdempotencyMiddleware(repository);
 * app.post('/api/lightning/invoice', middleware.handle.bind(middleware), handler);
 * ```
 */
export class IdempotencyMiddleware {
  private static readonly DEFAULT_CONFIG: Required<IdempotencyConfig> = {
    ttl_ms: 24 * 60 * 60 * 1000, // 24 hours
    header_name: 'Idempotency-Key',
    required: true,
    endpoints: [],
    enable_cleanup: true,
    cleanup_interval_ms: 60 * 60 * 1000, // 1 hour
  };

  private static readonly IDEMPOTENT_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];
  private static readonly UUID_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  private config: Required<IdempotencyConfig>;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(
    private repository: IdempotencyRepository,
    config: IdempotencyConfig = {}
  ) {
    this.config = { ...IdempotencyMiddleware.DEFAULT_CONFIG, ...config };

    // Start automatic cleanup if enabled
    if (this.config.enable_cleanup) {
      this.startCleanup();
    }
  }

  /**
   * Main middleware handler
   */
  async handle(
    req: IdempotentRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      // Skip idempotency for non-mutating methods
      if (!IdempotencyMiddleware.IDEMPOTENT_METHODS.includes(req.method)) {
        return next();
      }

      // Skip if endpoint filtering is configured and this endpoint is not included
      if (
        this.config.endpoints.length > 0 &&
        !this.config.endpoints.some((endpoint) => req.path.startsWith(endpoint))
      ) {
        return next();
      }

      // Extract and validate idempotency key
      const validation = this.validateIdempotencyKey(req);
      if (!validation.valid) {
        if (this.config.required) {
          res.status(400).json({
            error: validation.error,
            code: 'INVALID_IDEMPOTENCY_KEY',
          });
          return;
        }
        // If not required, proceed without idempotency
        return next();
      }

      const idempotencyKey = validation.idempotency_key!;

      // Check for existing cache entry
      const checkResult = await this.checkIdempotency(req, idempotencyKey);

      if (checkResult.is_duplicate && checkResult.cached_response) {
        // Return cached response
        const cached = checkResult.cached_response;

        res.setHeader('X-Idempotency-Cached', 'true');
        res.setHeader('X-Cache-Expires', cached.expires_at.toISOString());

        // Set cached headers
        Object.entries(cached.headers).forEach(([key, value]) => {
          res.setHeader(key, value);
        });

        res.status(cached.status).json(cached.body);
        return;
      }

      // Store idempotency data in request for potential response caching
      req.idempotency = {
        key: idempotencyKey,
        request_hash: checkResult.request_hash,
        is_cached: false,
      };

      // Intercept response to cache it
      this.interceptResponse(req, res);

      // Proceed with request processing
      next();
    } catch (error) {
      console.error('Idempotency check failed:', error);
      res.status(500).json({
        error: 'Idempotency check failed',
        code: 'IDEMPOTENCY_ERROR',
      });
    }
  }

  /**
   * Validate idempotency key format (UUID v4)
   */
  private validateIdempotencyKey(req: Request): IdempotencyValidation {
    const headerName = this.config.header_name.toLowerCase();
    const idempotencyKey = req.get(headerName);

    if (!idempotencyKey) {
      return {
        valid: false,
        error: `${this.config.header_name} header is required for ${req.method} requests`,
      };
    }

    if (!IdempotencyMiddleware.UUID_REGEX.test(idempotencyKey)) {
      return {
        valid: false,
        error: `Invalid idempotency key format. Must be a valid UUID v4.`,
      };
    }

    return {
      valid: true,
      idempotency_key: idempotencyKey,
    };
  }

  /**
   * Check if request is a duplicate
   */
  private async checkIdempotency(
    req: Request,
    idempotencyKey: string
  ): Promise<IdempotencyCheckResult> {
    const requestHash = this.computeRequestHash(req.body);

    // Look for existing cache entry
    const cached = await this.repository.findByKey(idempotencyKey);

    if (!cached) {
      // First request with this key
      return {
        is_duplicate: false,
        request_hash: requestHash,
      };
    }

    // Check if cache entry is expired
    if (cached.expires_at < new Date()) {
      // Expired - delete and treat as new request
      try {
        await this.repository.deleteByKey(idempotencyKey);
      } catch (error) {
        console.warn('Failed to delete expired cache entry:', error);
      }

      return {
        is_duplicate: false,
        request_hash: requestHash,
      };
    }

    // Check if request body has changed
    if (cached.request_hash !== requestHash) {
      throw new Error(
        'Request body has changed for the same idempotency key. ' +
          'This indicates a potential error in the client implementation.'
      );
    }

    // Valid duplicate request
    return {
      is_duplicate: true,
      cached_response: {
        status: cached.response_status,
        body: cached.response_body,
        headers: cached.response_headers,
        cached_at: cached.created_at,
        expires_at: cached.expires_at,
      },
      request_hash: requestHash,
    };
  }

  /**
   * Compute SHA-256 hash of request body
   */
  private computeRequestHash(body: any): string {
    const bodyString = JSON.stringify(body || {});
    return crypto.createHash('sha256').update(bodyString).digest('hex');
  }

  /**
   * Intercept response to cache successful responses
   */
  private interceptResponse(req: IdempotentRequest, res: Response): void {
    const originalJson = res.json.bind(res);
    const self = this;

    // Override res.json to cache the response
    res.json = function (body: any) {
      // Only cache successful responses (2xx status codes)
      const statusCode = res.statusCode;
      if (statusCode >= 200 && statusCode < 300 && req.idempotency) {
        // Store in cache asynchronously (don't block response)
        const cacheRequest: IdempotencyCacheRequest = {
          idempotency_key: req.idempotency.key,
          request_hash: req.idempotency.request_hash,
          http_method: req.method,
          endpoint_path: req.path,
          response_status: statusCode,
          response_body: body,
          response_headers: self.extractResponseHeaders(res),
          client_ip: req.ip,
          user_agent: req.get('user-agent'),
        };

        self.repository.store(cacheRequest).catch((error) => {
          console.error('Failed to cache idempotent response:', error);
        });
      }

      return originalJson(body);
    };
  }

  /**
   * Extract relevant response headers for caching
   */
  private extractResponseHeaders(res: Response): Record<string, string> {
    const headers: Record<string, string> = {};

    // Get all headers (Express doesn't expose them directly)
    const headerNames = ['content-type', 'cache-control', 'x-custom'];

    headerNames.forEach((name) => {
      const value = res.getHeader(name);
      if (value && typeof value === 'string') {
        headers[name] = value;
      }
    });

    return headers;
  }

  /**
   * Start automatic cleanup of expired entries
   */
  private startCleanup(): void {
    this.cleanupTimer = setInterval(async () => {
      try {
        const stats = await this.repository.cleanupExpired();
        if (stats.deleted_count > 0) {
          console.log(
            `Idempotency cleanup: removed ${stats.deleted_count} expired entries ` +
              `in ${stats.duration_ms}ms`
          );
        }
      } catch (error) {
        console.error('Idempotency cleanup failed:', error);
      }
    }, this.config.cleanup_interval_ms);

    // Prevent cleanup timer from keeping process alive
    this.cleanupTimer.unref();
  }

  /**
   * Stop automatic cleanup
   */
  stopCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
  }

  /**
   * Manually trigger cleanup
   */
  async cleanup(): Promise<void> {
    const stats = await this.repository.cleanupExpired();
    console.log(
      `Manual cleanup: removed ${stats.deleted_count} entries in ${stats.duration_ms}ms`
    );
  }
}

/**
 * Create idempotency middleware instance
 *
 * @param repository - Idempotency repository
 * @param config - Middleware configuration
 * @returns Express middleware function
 */
export function createIdempotencyMiddleware(
  repository: IdempotencyRepository,
  config?: IdempotencyConfig
) {
  const middleware = new IdempotencyMiddleware(repository, config);
  return middleware.handle.bind(middleware);
}
