/**
 * Real Redis client for backend integration tests.
 * Connects to test Redis container on port 6380.
 */
import Redis from 'ioredis';

const REDIS_TEST_URL = process.env.REDIS_URL || 'redis://localhost:6380';

let redisClient: Redis | null = null;

export function getTestRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(REDIS_TEST_URL, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
  }
  return redisClient;
}

/**
 * Flush all keys in the test Redis instance.
 * Call in beforeEach to ensure test isolation.
 */
export async function flushTestRedis(): Promise<void> {
  const client = getTestRedisClient();
  if (client.status !== 'ready') {
    await client.connect();
  }
  await client.flushall();
}

/**
 * Disconnect the test Redis client.
 * Call in afterAll or global teardown.
 */
export async function disconnectTestRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}

export { REDIS_TEST_URL };
