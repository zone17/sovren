/**
 * CacheService Implementation
 * User Story: US-E5-010
 * Redis-based caching with TTL management and pattern-based invalidation
 * Part of Epic 005 - Backend Service Layer Refactoring
 */

import type { ICacheService } from '../interfaces/shared/ICacheService';
import type { IEventBus, DomainEvent } from '../interfaces/shared/IEventBus';
import { DomainEventType, DomainEventBuilder } from '../interfaces/shared/IEventBus';
import type { ILogger } from '../interfaces/shared/ILogger';
import type {
  CacheOptions,
  CacheStats,
  CacheConfiguration,
  CacheInvalidationPattern,
  CacheWarmupStrategy,
} from '../types/cache';

import * as Redis from 'ioredis';
import { performance } from 'perf_hooks';
import { cacheOperations } from '../middleware/deployment-monitoring';

/**
 * Cache provider interface
 */
interface ICacheProvider {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttl?: number): Promise<void>;
  delete(key: string): Promise<boolean>;
  exists(key: string): Promise<boolean>;
  keys(pattern: string): Promise<string[]>;
  /**
   * Non-blocking key scan that yields keys in batches via an async generator.
   * Implementations backed by Redis use SCAN so the server is never blocked.
   */
  scanKeys(pattern: string): AsyncGenerator<string>;
  ttl(key: string): Promise<number>;
  expire(key: string, ttl: number): Promise<boolean>;
  flush(): Promise<void>;
  mget(keys: string[]): Promise<(string | null)[]>;
  mset(entries: Array<{ key: string; value: string; ttl?: number }>): Promise<void>;
  ping(): Promise<boolean>;
}

/**
 * Redis cache provider
 */
class RedisCacheProvider implements ICacheProvider {
  private client: Redis.Redis;

  constructor(config: Redis.RedisOptions) {
    this.client = new Redis.Redis(config);
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (ttl) {
      await this.client.setex(key, ttl, value);
    } else {
      await this.client.set(key, value);
    }
  }

  async delete(key: string): Promise<boolean> {
    const result = await this.client.del(key);
    return result === 1;
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }

  async keys(pattern: string): Promise<string[]> {
    // Use SCAN instead of KEYS to avoid blocking Redis in production
    const keys: string[] = [];
    let cursor = '0';
    do {
      const [nextCursor, batch] = await this.client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;
      keys.push(...batch);
    } while (cursor !== '0');
    return keys;
  }

  async *scanKeys(pattern: string): AsyncGenerator<string> {
    // Use ioredis scanStream for non-blocking, streaming key iteration.
    // Keys are yielded in batches of ~100 so callers can process/delete as
    // they go rather than buffering the entire result set in memory.
    const stream = this.client.scanStream({ match: pattern, count: 100 });
    for await (const batch of stream) {
      for (const key of batch as string[]) {
        yield key;
      }
    }
  }

  async ttl(key: string): Promise<number> {
    return this.client.ttl(key);
  }

  async expire(key: string, ttl: number): Promise<boolean> {
    const result = await this.client.expire(key, ttl);
    return result === 1;
  }

  async flush(): Promise<void> {
    await this.client.flushdb();
  }

  async mget(keys: string[]): Promise<(string | null)[]> {
    if (keys.length === 0) return [];
    return this.client.mget(...keys);
  }

  async mset(entries: Array<{ key: string; value: string; ttl?: number }>): Promise<void> {
    const pipeline = this.client.pipeline();

    for (const entry of entries) {
      if (entry.ttl) {
        pipeline.setex(entry.key, entry.ttl, entry.value);
      } else {
        pipeline.set(entry.key, entry.value);
      }
    }

    await pipeline.exec();
  }

  async ping(): Promise<boolean> {
    const result = await this.client.ping();
    return result === 'PONG';
  }

  async disconnect(): Promise<void> {
    await this.client.quit();
  }
}

/**
 * In-memory cache provider (for testing)
 */
class InMemoryCacheProvider implements ICacheProvider {
  private store: Map<string, { value: string; expiresAt?: number }> = new Map();

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;

    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return entry.value;
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    const expiresAt = ttl ? Date.now() + ttl * 1000 : undefined;
    this.store.set(key, { value, expiresAt });
  }

  async delete(key: string): Promise<boolean> {
    return this.store.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    return this.store.has(key);
  }

  async keys(pattern: string): Promise<string[]> {
    const regex = new RegExp(pattern.replace('*', '.*'));
    return Array.from(this.store.keys()).filter(key => regex.test(key));
  }

  async *scanKeys(pattern: string): AsyncGenerator<string> {
    const regex = new RegExp(pattern.replace('*', '.*'));
    for (const key of this.store.keys()) {
      if (regex.test(key)) yield key;
    }
  }

  async ttl(key: string): Promise<number> {
    const entry = this.store.get(key);
    if (!entry || !entry.expiresAt) return -1;

    const remaining = Math.floor((entry.expiresAt - Date.now()) / 1000);
    return remaining > 0 ? remaining : -2;
  }

  async expire(key: string, ttl: number): Promise<boolean> {
    const entry = this.store.get(key);
    if (!entry) return false;

    entry.expiresAt = Date.now() + ttl * 1000;
    return true;
  }

  async flush(): Promise<void> {
    this.store.clear();
  }

  async mget(keys: string[]): Promise<(string | null)[]> {
    return Promise.all(keys.map(key => this.get(key)));
  }

  async mset(entries: Array<{ key: string; value: string; ttl?: number }>): Promise<void> {
    for (const entry of entries) {
      await this.set(entry.key, entry.value, entry.ttl);
    }
  }

  async ping(): Promise<boolean> {
    return true;
  }

  async disconnect(): Promise<void> {
    this.store.clear();
  }
}

/**
 * Concrete implementation of CacheService
 */
export class CacheService implements ICacheService {
  private readonly eventBus: IEventBus;
  private readonly logger: ILogger;
  private readonly provider: ICacheProvider;
  private readonly config: CacheConfiguration;
  private readonly stats: CacheStats;
  private readonly warmupStrategies: Map<string, CacheWarmupStrategy> = new Map();
  private readonly invalidationPatterns: Map<string, CacheInvalidationPattern> = new Map();
  private warmupInterval?: NodeJS.Timeout;

  constructor(eventBus: IEventBus, logger: ILogger, config: CacheConfiguration) {
    this.eventBus = eventBus;
    this.logger = logger;
    this.config = config;

    // Initialize provider
    if (config.provider === 'redis' && config.redis) {
      this.provider = new RedisCacheProvider(config.redis);
    } else {
      this.provider = new InMemoryCacheProvider();
    }

    // Initialize stats
    this.stats = {
      hits: 0,
      misses: 0,
      keys: 0,
      sets: 0,
      deletes: 0,
      hitRate: 0,
      avgGetTime: 0,
      avgSetTime: 0,
      memoryUsage: 0,
      keyCount: 0,
    };

    // Start warmup process if configured
    if (config.warmup?.enabled) {
      this.startWarmupProcess();
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const startTime = performance.now();

    try {
      const prefixedKey = this.getPrefixedKey(key);
      const value = await this.provider.get(prefixedKey);

      const duration = performance.now() - startTime;
      this.updateGetStats(duration, !!value);

      if (!value) {
        this.logger.debug(`Cache miss: ${key}`);
        cacheOperations.inc({ operation: 'get', result: 'miss' });
        return null;
      }

      this.logger.debug(`Cache hit: ${key}`);
      cacheOperations.inc({ operation: 'get', result: 'hit' });
      // NOTE: Supabase query instrumentation (dbQueryDuration, dbConnectionsActive) requires
      // a wrapper around the Supabase client. Deferred to a dedicated instrumentation task.

      // Parse JSON value
      try {
        return JSON.parse(value) as T;
      } catch {
        // Raw string value — valid when T is string
        return value as T & string;
      }
    } catch (error) {
      this.logger.error(`Cache get error for key ${key}`, error);
      return null;
    }
  }

  async set<T>(key: string, value: T, ttl?: number, options?: CacheOptions): Promise<void> {
    const startTime = performance.now();

    try {
      const prefixedKey = this.getPrefixedKey(key);

      // Serialize value
      const serialized = typeof value === 'string' ? value : JSON.stringify(value);

      // Use default TTL if not specified
      const effectiveTtl = ttl || this.config.defaultTtl || 3600;

      await this.provider.set(prefixedKey, serialized, effectiveTtl);

      const duration = performance.now() - startTime;
      this.updateSetStats(duration);

      this.logger.debug(`Cache set: ${key} (TTL: ${effectiveTtl}s)`);

      // Handle cache tags
      if (options?.tags) {
        await this.addTags(key, options.tags);
      }

      // Emit event
      await this.emitCacheEvent('cache.set', {
        key,
        ttl: effectiveTtl,
        tags: options?.tags,
      });
    } catch (error) {
      this.logger.error(`Cache set error for key ${key}`, error);
      throw error;
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      const prefixedKey = this.getPrefixedKey(key);
      const result = await this.provider.delete(prefixedKey);

      this.stats.deletes++;

      if (result) {
        this.logger.debug(`Cache delete: ${key}`);

        // Remove tags
        await this.removeTags(key);

        // Emit event
        await this.emitCacheEvent('cache.delete', { key });
      }

      return result;
    } catch (error) {
      this.logger.error(`Cache delete error for key ${key}`, error);
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const prefixedKey = this.getPrefixedKey(key);
      return this.provider.exists(prefixedKey);
    } catch (error) {
      this.logger.error(`Cache exists error for key ${key}`, error);
      return false;
    }
  }

  async invalidate(pattern: string): Promise<number> {
    try {
      const prefixedPattern = this.getPrefixedKey(pattern);

      // Use SCAN-based streaming iteration instead of KEYS to avoid blocking Redis
      let count = 0;
      for await (const key of this.provider.scanKeys(prefixedPattern)) {
        if (await this.provider.delete(key)) {
          count++;
        }
      }

      this.logger.info(`Cache invalidation: ${pattern} (${count} keys deleted)`);

      // Emit event
      await this.emitCacheEvent('cache.invalidate', {
        pattern,
        count,
      });

      return count;
    } catch (error) {
      this.logger.error(`Cache invalidation error for pattern ${pattern}`, error);
      return 0;
    }
  }

  async invalidateByTags(tags: string[]): Promise<number> {
    try {
      const keys = new Set<string>();

      // Get all keys for each tag
      for (const tag of tags) {
        const tagKey = `${this.config.prefix}:tags:${tag}`;
        const taggedKeys = await this.provider.get(tagKey);

        if (taggedKeys) {
          const parsed = JSON.parse(taggedKeys) as string[];
          parsed.forEach(key => keys.add(key));
        }
      }

      // Delete all tagged keys
      let count = 0;
      for (const key of keys) {
        if (await this.delete(key)) {
          count++;
        }
      }

      // Clean up tag keys
      for (const tag of tags) {
        const tagKey = `${this.config.prefix}:tags:${tag}`;
        await this.provider.delete(tagKey);
      }

      this.logger.info(`Cache invalidation by tags: ${tags.join(', ')} (${count} keys deleted)`);

      return count;
    } catch (error) {
      this.logger.error(`Cache invalidation by tags error`, error);
      return 0;
    }
  }

  async flush(): Promise<void> {
    try {
      await this.provider.flush();

      // Reset stats
      this.stats.hits = 0;
      this.stats.misses = 0;
      this.stats.sets = 0;
      this.stats.deletes = 0;

      this.logger.warn('Cache flushed');

      // Emit event
      await this.emitCacheEvent('cache.flush', {});
    } catch (error) {
      this.logger.error('Cache flush error', error);
      throw error;
    }
  }

  async getTtl(key: string): Promise<number> {
    try {
      const prefixedKey = this.getPrefixedKey(key);
      return this.provider.ttl(prefixedKey);
    } catch (error) {
      this.logger.error(`Cache TTL error for key ${key}`, error);
      return -1;
    }
  }

  async setTtl(key: string, ttl: number): Promise<boolean> {
    try {
      const prefixedKey = this.getPrefixedKey(key);
      const result = await this.provider.expire(prefixedKey, ttl);

      if (result) {
        this.logger.debug(`Cache TTL updated: ${key} (${ttl}s)`);
      }

      return result;
    } catch (error) {
      this.logger.error(`Cache set TTL error for key ${key}`, error);
      return false;
    }
  }

  async getMany<T>(keys: string[]): Promise<Map<string, T | null>> {
    try {
      const prefixedKeys = keys.map(key => this.getPrefixedKey(key));
      const values = await this.provider.mget(prefixedKeys);

      const result = new Map<string, T | null>();

      keys.forEach((key, index) => {
        const value = values[index];
        if (value) {
          try {
            result.set(key, JSON.parse(value) as T);
            this.stats.hits++;
          } catch {
            // Raw string value — valid when T is string
            result.set(key, value as T & string);
          }
        } else {
          result.set(key, null);
          this.stats.misses++;
        }
      });

      return result;
    } catch (error) {
      this.logger.error('Cache mget error', error);
      return new Map();
    }
  }

  async setMany<T>(entries: Array<{ key: string; value: T; ttl?: number }>): Promise<void> {
    try {
      const serialized = entries.map(entry => ({
        key: this.getPrefixedKey(entry.key),
        value: typeof entry.value === 'string' ? entry.value : JSON.stringify(entry.value),
        ttl: entry.ttl || this.config.defaultTtl,
      }));

      await this.provider.mset(serialized);

      this.stats.sets += entries.length;

      this.logger.debug(`Cache mset: ${entries.length} keys`);
    } catch (error) {
      this.logger.error('Cache mset error', error);
      throw error;
    }
  }

  async remember<T>(key: string, factory: () => Promise<T>, ttl?: number): Promise<T> {
    // Try to get from cache
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Generate value
    const value = await factory();

    // Store in cache
    await this.set(key, value, ttl);

    return value;
  }

  async getStats(): Promise<CacheStats> {
    try {
      const keys = await this.provider.keys(`${this.config.prefix}:*`);

      return {
        ...this.stats,
        hitRate: this.calculateHitRate(),
        keyCount: keys.length,
        memoryUsage: await this.estimateMemoryUsage(),
      };
    } catch (error) {
      this.logger.error('Failed to get cache stats', error);
      return this.stats;
    }
  }

  async registerWarmupStrategy(strategy: CacheWarmupStrategy): Promise<void> {
    this.warmupStrategies.set(strategy.name, strategy);
    this.logger.info(`Cache warmup strategy registered: ${strategy.name}`);
  }

  async warmup(strategyName?: string): Promise<void> {
    try {
      const strategies = strategyName
        ? [this.warmupStrategies.get(strategyName)].filter(Boolean)
        : Array.from(this.warmupStrategies.values());

      for (const strategy of strategies) {
        if (!strategy) continue;

        this.logger.info(`Running cache warmup: ${strategy.name}`);

        const data = await strategy.dataLoader();

        for (const item of data) {
          await this.set(strategy.keyGenerator(item), item, strategy.ttl || this.config.defaultTtl);
        }

        this.logger.info(`Cache warmup completed: ${strategy.name} (${data.length} items)`);
      }
    } catch (error) {
      this.logger.error('Cache warmup error', error);
    }
  }

  async registerInvalidationPattern(pattern: CacheInvalidationPattern): Promise<void> {
    this.invalidationPatterns.set(pattern.name, pattern);

    // Subscribe to events
    (pattern.events as DomainEventType[]).forEach((eventType: DomainEventType) => {
      this.eventBus.subscribe(eventType, async (domainEvent: DomainEvent) => {
        const keysToInvalidate = pattern.keyGenerator(domainEvent.payload);

        for (const key of keysToInvalidate) {
          await this.delete(key);
        }

        this.logger.debug(`Cache invalidation pattern triggered: ${pattern.name}`);
      });
    });

    this.logger.info(`Cache invalidation pattern registered: ${pattern.name}`);
  }

  async healthCheck(): Promise<boolean> {
    try {
      return this.provider.ping();
    } catch (error) {
      this.logger.error('Cache health check failed', error);
      return false;
    }
  }

  async dispose(): Promise<void> {
    // Stop warmup process
    if (this.warmupInterval) {
      clearInterval(this.warmupInterval);
    }

    // Disconnect from provider
    if ('disconnect' in this.provider) {
      await (this.provider as unknown as { disconnect(): Promise<void> }).disconnect();
    }

    this.logger.info('CacheService disposed');
  }

  // Private helper methods

  /**
   * Publish a cache-related domain event via the event bus.
   * Wraps plain data into a DomainEvent envelope.
   */
  private async emitCacheEvent(eventName: string, data: Record<string, unknown>): Promise<void> {
    const event = new DomainEventBuilder()
      .withType(DomainEventType.SERVICE_STARTED) // Cache events don't have a dedicated type
      .withAggregateId(eventName)
      .withAggregateType('cache')
      .withPayload({ eventName, ...data })
      .withSource('CacheService')
      .build();
    await this.eventBus.publish(event);
  }

  private getPrefixedKey(key: string): string {
    return this.config.prefix ? `${this.config.prefix}:${key}` : key;
  }

  private updateGetStats(duration: number, hit: boolean): void {
    if (hit) {
      this.stats.hits++;
    } else {
      this.stats.misses++;
    }

    const totalGets = this.stats.hits + this.stats.misses;
    this.stats.avgGetTime = (this.stats.avgGetTime * (totalGets - 1) + duration) / totalGets;
  }

  private updateSetStats(duration: number): void {
    this.stats.sets++;
    this.stats.avgSetTime =
      (this.stats.avgSetTime * (this.stats.sets - 1) + duration) / this.stats.sets;
  }

  private calculateHitRate(): number {
    const total = this.stats.hits + this.stats.misses;
    return total > 0 ? this.stats.hits / total : 0;
  }

  private async estimateMemoryUsage(): Promise<number> {
    // This is a rough estimate
    // In production, would use Redis INFO memory command
    const keys = await this.provider.keys(`${this.config.prefix}:*`);
    const avgKeySize = 100; // bytes
    const avgValueSize = 1024; // bytes
    return keys.length * (avgKeySize + avgValueSize);
  }

  private async addTags(key: string, tags: string[]): Promise<void> {
    for (const tag of tags) {
      const tagKey = `${this.config.prefix}:tags:${tag}`;
      const existing = await this.provider.get(tagKey);

      const keys = existing ? JSON.parse(existing) : [];
      if (!keys.includes(key)) {
        keys.push(key);
      }

      await this.provider.set(tagKey, JSON.stringify(keys), 86400); // 24 hour TTL
    }
  }

  private async removeTags(key: string): Promise<void> {
    // In production, would maintain reverse index for efficiency
    const tagPattern = `${this.config.prefix}:tags:*`;

    // Use SCAN-based streaming iteration instead of KEYS to avoid blocking Redis
    for await (const tagKey of this.provider.scanKeys(tagPattern)) {
      const existing = await this.provider.get(tagKey);
      if (!existing) continue;

      const keys = JSON.parse(existing) as string[];
      const filtered = keys.filter(k => k !== key);

      if (filtered.length > 0) {
        await this.provider.set(tagKey, JSON.stringify(filtered), 86400);
      } else {
        await this.provider.delete(tagKey);
      }
    }
  }

  private startWarmupProcess(): void {
    if (!this.config.warmup?.interval) return;

    this.warmupInterval = setInterval(async () => {
      await this.warmup();
    }, this.config.warmup.interval * 1000);

    // Initial warmup
    setTimeout(() => this.warmup(), 1000);
  }
}
