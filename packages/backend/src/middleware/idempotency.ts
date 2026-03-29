/**
 * Payment Idempotency Middleware (API-003)
 *
 * Prevents duplicate processing of payment mutations by caching responses
 * keyed on the client-supplied `Idempotency-Key` header.
 *
 * Storage strategy:
 *   1. Redis (preferred) — key: `idempotency:{key}`, TTL: 24 hours
 *   2. In-memory Map (fallback when Redis is unavailable) — capped at 1000 entries
 *
 * Usage: place this middleware after `authenticate` and before the route handler
 * on any non-idempotent (POST/PUT/DELETE) payment endpoint.
 */

import { Request, Response, NextFunction } from 'express';
import logger from '../lib/logger';
import { getRedisClient, isRedisAvailable } from '../lib/redis';

const REDIS_TTL_SECONDS = 24 * 60 * 60; // 24 hours
const REDIS_KEY_PREFIX = 'idempotency:';
const MEMORY_MAX_ENTRIES = 1000;
const IDEMPOTENCY_KEY_MAX_LENGTH = 64;

/** UUID v4 format: 8-4-4-4-12 hex characters */
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface CachedResponse {
  statusCode: number;
  body: unknown;
}

/** In-memory fallback store used when Redis is unavailable. */
const memoryStore = new Map<string, CachedResponse>();

function memorySet(key: string, value: CachedResponse): void {
  if (memoryStore.size >= MEMORY_MAX_ENTRIES) {
    // Evict the oldest entry (first inserted key)
    const firstKey = memoryStore.keys().next().value;
    if (firstKey !== undefined) {
      memoryStore.delete(firstKey);
    }
  }
  memoryStore.set(key, value);
}

async function getCached(key: string): Promise<CachedResponse | null> {
  if (isRedisAvailable()) {
    try {
      const redis = getRedisClient();
      const raw = await redis.get(`${REDIS_KEY_PREFIX}${key}`);
      if (raw) {
        return JSON.parse(raw) as CachedResponse;
      }
      return null;
    } catch (err) {
      logger.warn('[Idempotency] Redis get failed, falling back to memory', {
        error: (err as Error).message,
      });
    }
  }
  return memoryStore.get(key) ?? null;
}

async function setCached(key: string, value: CachedResponse): Promise<void> {
  if (isRedisAvailable()) {
    try {
      const redis = getRedisClient();
      await redis.setex(
        `${REDIS_KEY_PREFIX}${key}`,
        REDIS_TTL_SECONDS,
        JSON.stringify(value)
      );
      return;
    } catch (err) {
      logger.warn('[Idempotency] Redis set failed, falling back to memory', {
        error: (err as Error).message,
      });
    }
  }
  memorySet(key, value);
}

/**
 * Express middleware that enforces idempotency for payment mutation routes.
 *
 * - If `Idempotency-Key` header is absent: the request passes through unchanged.
 * - If the key was seen before: replay the cached status + body immediately.
 * - If the key is new: intercept `res.json()` / `res.send()` to capture and cache
 *   the response before sending it to the client.
 */
export function idempotency(req: Request, res: Response, next: NextFunction): void {
  const idempotencyKey = req.headers['idempotency-key'];

  if (!idempotencyKey || typeof idempotencyKey !== 'string' || idempotencyKey.trim() === '') {
    // No key provided — pass through without caching
    return next();
  }

  const key = idempotencyKey.trim();

  // Validate key length and format
  if (key.length > IDEMPOTENCY_KEY_MAX_LENGTH) {
    res.status(400).json({
      success: false,
      error: 'Invalid Idempotency-Key',
      message: `Idempotency key must not exceed ${IDEMPOTENCY_KEY_MAX_LENGTH} characters`,
    });
    return;
  }

  if (!UUID_V4_REGEX.test(key)) {
    res.status(400).json({
      success: false,
      error: 'Invalid Idempotency-Key',
      message: 'Idempotency key must be a valid UUID v4',
    });
    return;
  }

  // Async wrapper so we can await the cache lookup before calling next()
  (async () => {
    try {
      const cached = await getCached(key);

      if (cached) {
        logger.debug('[Idempotency] Cache hit — replaying cached response', { key });
        res.status(cached.statusCode).json(cached.body);
        return;
      }

      // Cache miss — intercept the outgoing response to store it
      const originalJson = res.json.bind(res);

      res.json = function interceptedJson(body: unknown): Response {
        // Restore original before calling to avoid infinite recursion
        res.json = originalJson;

        const statusCode = res.statusCode ?? 200;

        // Fire-and-forget cache write; do not block the response
        setCached(key, { statusCode, body }).catch((err) => {
          logger.warn('[Idempotency] Failed to cache response', {
            key,
            error: (err as Error).message,
          });
        });

        return originalJson(body);
      };

      next();
    } catch (err) {
      // If something goes wrong with cache infrastructure, let the request proceed
      logger.error('[Idempotency] Unexpected error in middleware — passing through', {
        key,
        error: (err as Error).message,
      });
      next();
    }
  })();
}
