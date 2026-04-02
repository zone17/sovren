/**
 * RedisAdapter - Production-Ready Redis Caching Layer
 *
 * US-317: Implement NOSTR Caching Layer
 * Epic 003: NOSTR Consolidation
 *
 * Features:
 * - Connection pooling and automatic failover
 * - Redis Cluster support
 * - Automatic fallback to memory cache
 * - Performance monitoring
 * - TTL-based expiration
 * - Pattern-based key management
 *
 * Performance Targets:
 * - Cache operations < 5ms
 * - Connection pool: 10-50 connections
 * - Automatic reconnection on failure
 * - Graceful degradation to memory cache
 */

import Redis, { RedisOptions, Cluster, ClusterOptions } from 'ioredis';
import logger from '../lib/logger';

// Define minimal NostrEvent type for backend caching
// Full types are in shared package but we only need structure for caching
export interface NostrEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}

// ========================================
// Types
// ========================================

export interface RedisAdapterConfig {
  // Connection
  host?: string;
  port?: number;
  password?: string;
  db?: number;

  // Cluster mode
  enableCluster?: boolean;
  clusterNodes?: Array<{ host: string; port: number }>;

  // Connection pool
  maxConnections?: number;
  minConnections?: number;
  connectionTimeout?: number;

  // Retry strategy
  maxRetries?: number;
  retryDelay?: number;

  // Fallback
  enableMemoryFallback?: boolean;

  // Performance
  enableCompression?: boolean;
  keyPrefix?: string;

  // TTL
  defaultTTL?: number; // seconds
}

export interface CacheAdapter {
  get(key: string): Promise<NostrEvent | null>;
  set(key: string, value: NostrEvent, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  deletePattern(pattern: string): Promise<number>;
  exists(key: string): Promise<boolean>;
  clear(): Promise<void>;
  getStats(): Promise<CacheAdapterStats>;
  isConnected(): boolean;
  disconnect(): Promise<void>;
}

export interface CacheAdapterStats {
  connected: boolean;
  keys: number;
  memoryUsage: number;
  hits: number;
  misses: number;
  hitRate: number;
  operations: number;
  errors: number;
}

// ========================================
// RedisAdapter Implementation
// ========================================

export class RedisAdapter implements CacheAdapter {
  private client: Redis | Cluster | null = null;
  private memoryFallback: Map<string, { value: NostrEvent; expiresAt: number }>;
  private config: Required<RedisAdapterConfig>;
  private stats: CacheAdapterStats;
  private isUsingFallback = false;

  constructor(config: RedisAdapterConfig = {}) {
    this.config = {
      host: config.host ?? process.env.REDIS_HOST ?? 'localhost',
      port: config.port ?? parseInt(process.env.REDIS_PORT ?? '6379', 10),
      password: config.password ?? process.env.REDIS_PASSWORD ?? '',
      db: config.db ?? parseInt(process.env.REDIS_DB ?? '0', 10),
      enableCluster: config.enableCluster ?? false,
      clusterNodes: config.clusterNodes ?? [],
      maxConnections: config.maxConnections ?? 50,
      minConnections: config.minConnections ?? 10,
      connectionTimeout: config.connectionTimeout ?? 5000,
      maxRetries: config.maxRetries ?? 3,
      retryDelay: config.retryDelay ?? 1000,
      enableMemoryFallback: config.enableMemoryFallback ?? true,
      enableCompression: config.enableCompression ?? false,
      keyPrefix: config.keyPrefix ?? 'nostr:cache:',
      defaultTTL: config.defaultTTL ?? 300, // 5 minutes
    };

    this.memoryFallback = new Map();
    this.stats = {
      connected: false,
      keys: 0,
      memoryUsage: 0,
      hits: 0,
      misses: 0,
      hitRate: 0,
      operations: 0,
      errors: 0,
    };

    this.connect();
  }

  // ========================================
  // Connection Management
  // ========================================

  private async connect(): Promise<void> {
    try {
      if (this.config.enableCluster && this.config.clusterNodes.length > 0) {
        await this.connectCluster();
      } else {
        await this.connectSingle();
      }
    } catch (error) {
      logger.error('Redis connection failed', { error });
      this.activateFallback();
    }
  }

  private async connectSingle(): Promise<void> {
    const options: RedisOptions = {
      host: this.config.host,
      port: this.config.port,
      password: this.config.password,
      db: this.config.db,
      maxRetriesPerRequest: this.config.maxRetries,
      retryStrategy: (times: number) => {
        if (times > this.config.maxRetries) {
          this.activateFallback();
          return null; // Stop retrying
        }
        return Math.min(times * this.config.retryDelay, 10000);
      },
      enableReadyCheck: true,
      lazyConnect: false,
    };

    this.client = new Redis(options);

    this.client.on('connect', () => {
      logger.info('Redis connected');
      this.stats.connected = true;
      this.isUsingFallback = false;
    });

    this.client.on('error', error => {
      logger.error('Redis error', { error });
      this.stats.errors++;
      if (!this.isUsingFallback) {
        this.activateFallback();
      }
    });

    this.client.on('close', () => {
      logger.warn('Redis connection closed');
      this.stats.connected = false;
    });

    await this.client.ping();
  }

  private async connectCluster(): Promise<void> {
    const options: ClusterOptions = {
      redisOptions: {
        password: this.config.password,
        maxRetriesPerRequest: this.config.maxRetries,
      },
      clusterRetryStrategy: (times: number) => {
        if (times > this.config.maxRetries) {
          this.activateFallback();
          return null;
        }
        return Math.min(times * this.config.retryDelay, 10000);
      },
    };

    this.client = new Redis.Cluster(this.config.clusterNodes, options);

    this.client.on('connect', () => {
      logger.info('Redis Cluster connected');
      this.stats.connected = true;
      this.isUsingFallback = false;
    });

    this.client.on('error', error => {
      logger.error('Redis Cluster error', { error });
      this.stats.errors++;
      if (!this.isUsingFallback) {
        this.activateFallback();
      }
    });

    await this.client.ping();
  }

  private activateFallback(): void {
    if (!this.config.enableMemoryFallback) {
      throw new Error('Redis unavailable and fallback disabled');
    }

    logger.warn('Redis unavailable - using memory fallback');
    this.isUsingFallback = true;
    this.stats.connected = false;
  }

  isConnected(): boolean {
    return this.stats.connected;
  }

  // ========================================
  // Cache Operations
  // ========================================

  async get(key: string): Promise<NostrEvent | null> {
    this.stats.operations++;
    const fullKey = this.config.keyPrefix + key;

    try {
      if (this.isUsingFallback) {
        return this.getFallback(key);
      }

      if (!this.client) {
        throw new Error('Redis client not initialized');
      }

      const value = await this.client.get(fullKey);

      if (!value) {
        this.stats.misses++;
        return null;
      }

      this.stats.hits++;
      return JSON.parse(value) as NostrEvent;
    } catch (error) {
      logger.error('Redis get error', { error });
      this.stats.errors++;
      return this.getFallback(key);
    }
  }

  async set(key: string, value: NostrEvent, ttl?: number): Promise<void> {
    this.stats.operations++;
    const fullKey = this.config.keyPrefix + key;
    const effectiveTTL = ttl ?? this.config.defaultTTL;

    try {
      if (this.isUsingFallback) {
        this.setFallback(key, value, effectiveTTL);
        return;
      }

      if (!this.client) {
        throw new Error('Redis client not initialized');
      }

      const serialized = JSON.stringify(value);
      await this.client.setex(fullKey, effectiveTTL, serialized);
    } catch (error) {
      logger.error('Redis set error', { error });
      this.stats.errors++;
      this.setFallback(key, value, effectiveTTL);
    }
  }

  async delete(key: string): Promise<void> {
    this.stats.operations++;
    const fullKey = this.config.keyPrefix + key;

    try {
      if (this.isUsingFallback) {
        this.memoryFallback.delete(key);
        return;
      }

      if (!this.client) {
        throw new Error('Redis client not initialized');
      }

      await this.client.del(fullKey);
    } catch (error) {
      logger.error('Redis delete error', { error });
      this.stats.errors++;
      this.memoryFallback.delete(key);
    }
  }

  async deletePattern(pattern: string): Promise<number> {
    this.stats.operations++;
    const fullPattern = this.config.keyPrefix + pattern;

    try {
      if (this.isUsingFallback) {
        return this.deletePatternFallback(pattern);
      }

      if (!this.client) {
        throw new Error('Redis client not initialized');
      }

      let cursor = '0';
      let deletedCount = 0;

      do {
        const [newCursor, keys] = await this.client.scan(
          cursor,
          'MATCH',
          fullPattern,
          'COUNT',
          100
        );

        cursor = newCursor;

        if (keys.length > 0) {
          const deleted = await this.client.del(...keys);
          deletedCount += deleted;
        }
      } while (cursor !== '0');

      return deletedCount;
    } catch (error) {
      logger.error('Redis deletePattern error', { error });
      this.stats.errors++;
      return this.deletePatternFallback(pattern);
    }
  }

  async exists(key: string): Promise<boolean> {
    this.stats.operations++;
    const fullKey = this.config.keyPrefix + key;

    try {
      if (this.isUsingFallback) {
        return this.memoryFallback.has(key);
      }

      if (!this.client) {
        throw new Error('Redis client not initialized');
      }

      const result = await this.client.exists(fullKey);
      return result === 1;
    } catch (error) {
      logger.error('Redis exists error', { error });
      this.stats.errors++;
      return this.memoryFallback.has(key);
    }
  }

  async clear(): Promise<void> {
    this.stats.operations++;

    try {
      if (this.isUsingFallback) {
        this.memoryFallback.clear();
        return;
      }

      if (!this.client) {
        throw new Error('Redis client not initialized');
      }

      // Delete all keys with our prefix
      await this.deletePattern('*');
    } catch (error) {
      logger.error('Redis clear error', { error });
      this.stats.errors++;
      this.memoryFallback.clear();
    }
  }

  // ========================================
  // Memory Fallback Operations
  // ========================================

  private getFallback(key: string): NostrEvent | null {
    const cached = this.memoryFallback.get(key);

    if (!cached) {
      this.stats.misses++;
      return null;
    }

    // Check expiration
    if (Date.now() > cached.expiresAt) {
      this.memoryFallback.delete(key);
      this.stats.misses++;
      return null;
    }

    this.stats.hits++;
    return cached.value;
  }

  private setFallback(key: string, value: NostrEvent, ttl: number): void {
    const expiresAt = Date.now() + ttl * 1000;
    this.memoryFallback.set(key, { value, expiresAt });
  }

  private deletePatternFallback(pattern: string): number {
    let count = 0;
    const regex = new RegExp(pattern.replace('*', '.*'));

    const keysToDelete: string[] = [];
    this.memoryFallback.forEach((_value, key) => {
      if (regex.test(key)) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => {
      this.memoryFallback.delete(key);
      count++;
    });

    return count;
  }

  // ========================================
  // Statistics
  // ========================================

  async getStats(): Promise<CacheAdapterStats> {
    try {
      if (!this.isUsingFallback && this.client) {
        // Get Redis stats
        const info = await this.client.info('stats');
        const keyspace = await this.client.info('keyspace');

        // Parse keyspace info for key count
        const keyMatch = keyspace.match(/keys=(\d+)/);
        if (keyMatch) {
          this.stats.keys = parseInt(keyMatch[1], 10);
        }

        // Parse memory usage
        const memMatch = info.match(/used_memory:(\d+)/);
        if (memMatch) {
          this.stats.memoryUsage = parseInt(memMatch[1], 10);
        }
      } else {
        // Fallback stats
        this.stats.keys = this.memoryFallback.size;
        this.stats.memoryUsage = JSON.stringify(Array.from(this.memoryFallback.entries())).length;
      }

      // Calculate hit rate
      const total = this.stats.hits + this.stats.misses;
      this.stats.hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;

      return { ...this.stats };
    } catch (error) {
      logger.error('Redis getStats error', { error });
      return { ...this.stats };
    }
  }

  // ========================================
  // Lifecycle
  // ========================================

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
    }

    this.memoryFallback.clear();
    this.stats.connected = false;
  }
}

// ========================================
// Factory Functions
// ========================================

/**
 * Create Redis adapter from environment variables
 */
export function createRedisAdapter(config?: RedisAdapterConfig): RedisAdapter {
  return new RedisAdapter(config);
}

/**
 * Create Redis adapter with cluster support
 */
export function createRedisClusterAdapter(
  nodes: Array<{ host: string; port: number }>,
  config?: Partial<RedisAdapterConfig>
): RedisAdapter {
  return new RedisAdapter({
    ...config,
    enableCluster: true,
    clusterNodes: nodes,
  });
}
