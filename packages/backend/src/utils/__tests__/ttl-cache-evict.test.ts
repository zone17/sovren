import { TTLCache } from '../ttl-cache';

describe('TTLCache onEvict callback (Fix #118 support)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('should fire onEvict when entry is deleted', () => {
    const evicted: Array<[string, number]> = [];
    const cache = new TTLCache<string, number>({
      maxSize: 10,
      ttlMs: 60000,
      onEvict: (key, value) => evicted.push([key, value]),
    });

    cache.set('a', 1);
    cache.delete('a');

    expect(evicted).toEqual([['a', 1]]);
    cache.destroy();
  });

  it('should fire onEvict on overflow eviction (FIFO)', () => {
    const evicted: Array<[string, number]> = [];
    const cache = new TTLCache<string, number>({
      maxSize: 3,
      ttlMs: 60000,
      onEvict: (key, value) => evicted.push([key, value]),
    });

    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    // This should evict 'a' (oldest)
    cache.set('d', 4);

    expect(evicted).toEqual([['a', 1]]);
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('d')).toBe(4);
    cache.destroy();
  });

  it('should fire onEvict on TTL expiry during get()', () => {
    vi.useFakeTimers();

    const evicted: Array<[string, number]> = [];
    const cache = new TTLCache<string, number>({
      maxSize: 10,
      ttlMs: 1000,
      cleanupIntervalMs: 100000, // Prevent background cleanup during test
      onEvict: (key, value) => evicted.push([key, value]),
    });

    cache.set('x', 42);

    // Advance past TTL
    vi.advanceTimersByTime(1100);

    // get() should trigger eviction
    const result = cache.get('x');
    expect(result).toBeUndefined();
    expect(evicted).toEqual([['x', 42]]);
    cache.destroy();
  });

  it('should fire onEvict for expired entries during values() call', () => {
    vi.useFakeTimers();

    const evicted: Array<[string, number]> = [];
    const cache = new TTLCache<string, number>({
      maxSize: 10,
      ttlMs: 1000,
      cleanupIntervalMs: 100000,
      onEvict: (key, value) => evicted.push([key, value]),
    });

    cache.set('expired', 1);
    cache.set('fresh', 2);

    // Advance just past first TTL, then add 'fresh' again
    vi.advanceTimersByTime(1100);
    cache.set('fresh', 2); // Re-set to extend TTL

    const vals = cache.values();
    // 'expired' should be evicted, 'fresh' should remain
    expect(vals).toEqual([2]);
    expect(evicted).toContainEqual(['expired', 1]);
    cache.destroy();
  });

  it('should not fire onEvict when overwriting an existing key', () => {
    const evicted: Array<[string, number]> = [];
    const cache = new TTLCache<string, number>({
      maxSize: 10,
      ttlMs: 60000,
      onEvict: (key, value) => evicted.push([key, value]),
    });

    cache.set('a', 1);
    cache.set('a', 2); // Overwrite, should not evict

    expect(evicted).toEqual([]);
    expect(cache.get('a')).toBe(2);
    cache.destroy();
  });

  it('should work correctly without onEvict callback', () => {
    const cache = new TTLCache<string, number>({
      maxSize: 2,
      ttlMs: 60000,
    });

    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3); // Should evict 'a' without error

    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('c')).toBe(3);
    cache.destroy();
  });
});
