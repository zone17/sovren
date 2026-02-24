/**
 * Shared Redis client factory
 * Single source of truth for Redis connection configuration.
 *
 * Lifecycle:
 *   1. connectRedis() — call during server bootstrap (eager connect, fail-fast)
 *   2. getRedisClient() — returns the connected singleton
 *   3. disconnectRedis() — call during graceful shutdown
 */
import Redis from 'ioredis';
import logger from './logger';

let sharedClient: Redis | null = null;
let connectPromise: Promise<void> | null = null;

const MAX_RETRY_ATTEMPTS = 10;

export interface RedisConfig {
  url?: string;
  host?: string;
  port?: number;
  password?: string;
  db?: number;
}

function getConfig(): RedisConfig {
  return {
    url: process.env.REDIS_URL,
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0', 10),
  };
}

function createClient(): Redis {
  const config = getConfig();
  const commonOpts = {
    maxRetriesPerRequest: 3,
    retryStrategy(times: number) {
      if (times > MAX_RETRY_ATTEMPTS) {
        logger.error(`[Redis] Exceeded max retry attempts (${MAX_RETRY_ATTEMPTS}). Giving up.`);
        return null; // stop retrying
      }
      const delay = Math.min(times * 200, 5000);
      logger.warn(`[Redis] Reconnect attempt ${times}/${MAX_RETRY_ATTEMPTS} in ${delay}ms`);
      return delay;
    },
    // No lazyConnect — connect eagerly at startup
  };

  const client = config.url
    ? new Redis(config.url, commonOpts)
    : new Redis({ host: config.host, port: config.port, password: config.password, db: config.db, ...commonOpts });

  client.on('error', (err) => {
    logger.error('[Redis] Connection error:', { message: err.message });
  });

  client.on('connect', () => {
    logger.info('[Redis] Connected');
  });

  return client;
}

/**
 * Eagerly connect Redis during server bootstrap.
 * Fails fast if Redis is unreachable (12-factor principle).
 * Uses a promise lock so concurrent calls wait for the same connection.
 */
export async function connectRedis(): Promise<void> {
  if (sharedClient) return;
  if (connectPromise) return connectPromise;

  connectPromise = (async () => {
    try {
      sharedClient = createClient();
      // Verify the connection is alive
      await sharedClient.ping();
      logger.info('[Redis] Ping successful — client ready');
    } catch (err) {
      sharedClient = null;
      connectPromise = null;
      throw err;
    }
  })();

  return connectPromise;
}

/**
 * Get the shared Redis client singleton.
 * Lazily creates the client if connectRedis() has not been called yet,
 * which happens when services are instantiated at module-load time
 * before the server bootstrap completes.
 */
export function getRedisClient(): Redis {
  if (!sharedClient) {
    sharedClient = createClient();
  }
  return sharedClient;
}

/**
 * Check whether a Redis client has been initialized and connected.
 * Non-throwing alternative to getRedisClient() for optional Redis consumers.
 */
export function isRedisAvailable(): boolean {
  return sharedClient !== null && sharedClient.status === 'ready';
}

/**
 * Disconnect the shared Redis client. Call during graceful shutdown.
 */
export async function disconnectRedis(): Promise<void> {
  if (sharedClient) {
    try {
      await sharedClient.quit();
    } catch (err) {
      logger.warn('[Redis] Error during disconnect, forcing close', { error: (err as Error).message });
      sharedClient.disconnect();
    }
    sharedClient = null;
    connectPromise = null;
  }
}
