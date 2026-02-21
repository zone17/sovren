/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * P1-039: Redis Client Factory Tests
 *
 * Verifies the shared Redis client singleton pattern:
 * - getRedisClient() returns the same instance on multiple calls
 * - Reads REDIS_URL when available
 * - Falls back to REDIS_HOST/PORT/PASSWORD env vars
 * - disconnectRedis() cleans up the singleton
 */

// Mock ioredis before importing the module under test
const mockRedisOn = vi.fn().mockReturnThis();
const mockRedisQuit = vi.fn().mockResolvedValue('OK');

const MockRedis = vi.fn().mockImplementation((...args: any[]) => ({
  on: mockRedisOn,
  quit: mockRedisQuit,
  ping: vi.fn().mockResolvedValue('PONG'),
  _constructorArgs: args,
}));

vi.mock('ioredis', () => ({ default: MockRedis }));

describe('P1-039: Redis Client Factory', () => {
  let getRedisClient: typeof import('../../lib/redis').getRedisClient;
  let disconnectRedis: typeof import('../../lib/redis').disconnectRedis;

  beforeEach(() => {
    vi.resetModules();
    MockRedis.mockClear();
    mockRedisOn.mockClear();
    mockRedisQuit.mockClear();

    // Clear all Redis-related env vars
    delete process.env.REDIS_URL;
    delete process.env.REDIS_HOST;
    delete process.env.REDIS_PORT;
    delete process.env.REDIS_PASSWORD;
    delete process.env.REDIS_DB;
  });

  async function loadModule() {
    const mod = await import('../../lib/redis');
    getRedisClient = mod.getRedisClient;
    disconnectRedis = mod.disconnectRedis;
    return mod;
  }

  describe('Singleton behavior', () => {
    it('should return the same instance on multiple calls', async () => {
      await loadModule();

      const client1 = getRedisClient();
      const client2 = getRedisClient();

      expect(client1).toBe(client2);
      // Constructor should only be called once
      expect(MockRedis).toHaveBeenCalledTimes(1);
    });

    it('should create a new instance after disconnectRedis()', async () => {
      await loadModule();

      const client1 = getRedisClient();
      await disconnectRedis();

      const client2 = getRedisClient();

      expect(client1).not.toBe(client2);
      expect(MockRedis).toHaveBeenCalledTimes(2);
    });
  });

  describe('REDIS_URL configuration', () => {
    it('should use REDIS_URL when available', async () => {
      process.env.REDIS_URL = 'redis://my-redis:6380/1';

      await loadModule();
      getRedisClient();

      // When REDIS_URL is set, ioredis constructor receives the URL as first arg
      expect(MockRedis).toHaveBeenCalledTimes(1);
      const [firstArg] = MockRedis.mock.calls[0];
      expect(firstArg).toBe('redis://my-redis:6380/1');
    });

    it('should pass maxRetriesPerRequest and retryStrategy with URL', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';

      await loadModule();
      getRedisClient();

      const [, options] = MockRedis.mock.calls[0];
      expect(options.maxRetriesPerRequest).toBe(3);
      expect(typeof options.retryStrategy).toBe('function');
      expect(options.lazyConnect).toBe(true);
    });
  });

  describe('REDIS_HOST/PORT/PASSWORD fallback', () => {
    it('should fall back to individual env vars when REDIS_URL is not set', async () => {
      process.env.REDIS_HOST = 'custom-host';
      process.env.REDIS_PORT = '6380';
      process.env.REDIS_PASSWORD = 'secret123';
      process.env.REDIS_DB = '2';

      await loadModule();
      getRedisClient();

      expect(MockRedis).toHaveBeenCalledTimes(1);
      const [config] = MockRedis.mock.calls[0];
      expect(config.host).toBe('custom-host');
      expect(config.port).toBe(6380);
      expect(config.password).toBe('secret123');
      expect(config.db).toBe(2);
    });

    it('should use defaults when no env vars are set', async () => {
      await loadModule();
      getRedisClient();

      expect(MockRedis).toHaveBeenCalledTimes(1);
      const [config] = MockRedis.mock.calls[0];
      expect(config.host).toBe('localhost');
      expect(config.port).toBe(6379);
      expect(config.db).toBe(0);
    });

    it('should pass maxRetriesPerRequest and retryStrategy with host config', async () => {
      await loadModule();
      getRedisClient();

      const [config] = MockRedis.mock.calls[0];
      expect(config.maxRetriesPerRequest).toBe(3);
      expect(typeof config.retryStrategy).toBe('function');
      expect(config.lazyConnect).toBe(true);
    });
  });

  describe('Retry strategy', () => {
    it('should return delay = times * 200, capped at 3000ms', async () => {
      await loadModule();
      getRedisClient();

      const config = MockRedis.mock.calls[0][0];
      const retryStrategy =
        typeof config === 'string'
          ? MockRedis.mock.calls[0][1].retryStrategy
          : config.retryStrategy;

      expect(retryStrategy(1)).toBe(200);
      expect(retryStrategy(5)).toBe(1000);
      expect(retryStrategy(15)).toBe(3000);
      expect(retryStrategy(100)).toBe(3000);
    });
  });

  describe('Error handler registration', () => {
    it('should register an error event handler', async () => {
      await loadModule();
      getRedisClient();

      expect(mockRedisOn).toHaveBeenCalledWith('error', expect.any(Function));
    });
  });

  describe('disconnectRedis()', () => {
    it('should call quit() on the shared client', async () => {
      await loadModule();
      getRedisClient();
      await disconnectRedis();

      expect(mockRedisQuit).toHaveBeenCalledTimes(1);
    });

    it('should set singleton to null after disconnect', async () => {
      await loadModule();
      getRedisClient();
      await disconnectRedis();

      // Next call should create a new instance
      getRedisClient();
      expect(MockRedis).toHaveBeenCalledTimes(2);
    });

    it('should be a no-op when no client exists', async () => {
      await loadModule();
      // Don't create a client first
      await disconnectRedis();

      // Should not throw
      expect(mockRedisQuit).not.toHaveBeenCalled();
    });
  });
});
