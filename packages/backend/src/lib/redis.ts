/**
 * Shared Redis client factory
 * Single source of truth for Redis connection configuration.
 */
import Redis from 'ioredis';

let sharedClient: Redis | null = null;

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

/**
 * Get the shared Redis client singleton.
 * Creates client on first call with unified config.
 */
export function getRedisClient(): Redis {
  if (sharedClient) return sharedClient;

  const config = getConfig();

  if (config.url) {
    sharedClient = new Redis(config.url, {
      maxRetriesPerRequest: 3,
      retryStrategy(times: number) {
        return Math.min(times * 200, 3000);
      },
      lazyConnect: true,
    });
  } else {
    sharedClient = new Redis({
      host: config.host,
      port: config.port,
      password: config.password,
      db: config.db,
      maxRetriesPerRequest: 3,
      retryStrategy(times: number) {
        return Math.min(times * 200, 3000);
      },
      lazyConnect: true,
    });
  }

  sharedClient.on('error', (err) => {
    console.error('[Redis] Connection error:', err.message);
  });

  return sharedClient;
}

/**
 * Disconnect the shared Redis client. Call during graceful shutdown.
 */
export async function disconnectRedis(): Promise<void> {
  if (sharedClient) {
    await sharedClient.quit();
    sharedClient = null;
  }
}
