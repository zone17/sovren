/**
 * RequestRateLimiter — extracted from advanced-rate-limiting.ts
 *
 * Provides in-memory token-bucket rate limiting with per-key tracking.
 * Used by unified-nostr-auth.ts for per-pubkey auth rate limiting.
 *
 * @module rate-limiter
 */

import { createHash } from 'crypto';
import { Request } from 'express';
import { getClientIP } from '../utils/client-ip';

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: Request) => string;
  store?: RateLimitStore;
}

export interface RateLimitResult {
  allowed: boolean;
  remainingRequests: number;
  resetTime: number;
  retryAfter?: number;
  totalRequests: number;
  currentWindowMs: number;
}

export interface RateLimitEntry {
  count: number;
  resetTime: number;
  firstRequest: number;
  lastRequest: number;
  blocked: number;
  metadata: {
    userAgent: string;
    successRate: number;
    averageResponseTime: number;
    errorTypes: string[];
  };
}

export interface RateLimitStore {
  get(key: string): Promise<RateLimitEntry | null>;
  set(key: string, entry: RateLimitEntry, ttl: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  keys(): Promise<string[]>;
}

export class MemoryRateLimitStore implements RateLimitStore {
  private store: Map<string, RateLimitEntry>;
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    this.store = new Map();
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  async get(key: string): Promise<RateLimitEntry | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.resetTime) {
      this.store.delete(key);
      return null;
    }
    return entry;
  }

  async set(key: string, entry: RateLimitEntry, _ttl: number): Promise<void> {
    this.store.set(key, entry);
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async clear(): Promise<void> {
    this.store.clear();
  }

  async keys(): Promise<string[]> {
    return Array.from(this.store.keys());
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.resetTime) {
        this.store.delete(key);
      }
    }
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.store.clear();
  }

  getSize(): number {
    return this.store.size;
  }
}

export class RequestRateLimiter {
  private config: RateLimitConfig;
  private store: RateLimitStore;

  constructor(config: RateLimitConfig) {
    this.config = config;
    this.store = config.store || new MemoryRateLimitStore();
  }

  async checkLimit(req: Request): Promise<RateLimitResult> {
    const key = this.generateKey(req);
    const now = Date.now();

    let entry = await this.store.get(key);

    if (!entry || entry.resetTime <= now) {
      entry = {
        count: 1,
        resetTime: now + this.config.windowMs,
        firstRequest: now,
        lastRequest: now,
        blocked: 0,
        metadata: {
          userAgent: req.get('User-Agent') || 'unknown',
          successRate: 1.0,
          averageResponseTime: 0,
          errorTypes: [],
        },
      };
    } else {
      entry.count++;
      entry.lastRequest = now;
    }

    const allowed = entry.count <= this.config.maxRequests;
    if (!allowed) {
      entry.blocked++;
    }

    await this.store.set(key, entry, this.config.windowMs);

    return {
      allowed,
      remainingRequests: Math.max(0, this.config.maxRequests - entry.count),
      resetTime: entry.resetTime,
      retryAfter: allowed ? undefined : Math.ceil((entry.resetTime - now) / 1000),
      totalRequests: entry.count,
      currentWindowMs: this.config.windowMs,
    };
  }

  private generateKey(req: Request): string {
    if (this.config.keyGenerator) {
      return this.config.keyGenerator(req);
    }

    const ip = getClientIP(req);
    const userAgent = req.get('User-Agent') || 'unknown';
    const fingerprint = createHash('sha256')
      .update(`${ip}:${userAgent}`)
      .digest('hex')
      .substring(0, 16);

    return `rate_limit:${fingerprint}`;
  }

  updateConfig(newConfig: Partial<RateLimitConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}
