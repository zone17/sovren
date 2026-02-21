import { TTLCache } from '../ttl-cache';

describe('TTLCache', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('should store and retrieve values', () => {
    const cache = new TTLCache<string, number>({ maxSize: 10, ttlMs: 60_000 });
    cache.set('a', 1);
    cache.set('b', 2);
    expect(cache.get('a')).toBe(1);
    expect(cache.get('b')).toBe(2);
    cache.destroy();
  });

  it('should return undefined for missing keys', () => {
    const cache = new TTLCache<string, number>({ maxSize: 10, ttlMs: 60_000 });
    expect(cache.get('missing')).toBeUndefined();
    cache.destroy();
  });

  it('should expire entries after TTL', () => {
    vi.useFakeTimers();
    const cache = new TTLCache<string, number>({ maxSize: 10, ttlMs: 1000, cleanupIntervalMs: 500 });
    cache.set('a', 1);
    expect(cache.get('a')).toBe(1);

    vi.advanceTimersByTime(1001);
    expect(cache.get('a')).toBeUndefined();
    cache.destroy();
  });

  it('should evict oldest entry when maxSize is reached', () => {
    const cache = new TTLCache<string, number>({ maxSize: 3, ttlMs: 60_000 });
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);

    // Adding a 4th entry should evict 'a' (oldest)
    cache.set('d', 4);
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBe(2);
    expect(cache.get('c')).toBe(3);
    expect(cache.get('d')).toBe(4);
    expect(cache.size).toBe(3);
    cache.destroy();
  });

  it('should not evict when updating an existing key', () => {
    const cache = new TTLCache<string, number>({ maxSize: 2, ttlMs: 60_000 });
    cache.set('a', 1);
    cache.set('b', 2);

    // Updating 'a' should not trigger eviction
    cache.set('a', 10);
    expect(cache.get('a')).toBe(10);
    expect(cache.get('b')).toBe(2);
    expect(cache.size).toBe(2);
    cache.destroy();
  });

  it('should report correct size', () => {
    const cache = new TTLCache<string, number>({ maxSize: 10, ttlMs: 60_000 });
    expect(cache.size).toBe(0);
    cache.set('a', 1);
    expect(cache.size).toBe(1);
    cache.set('b', 2);
    expect(cache.size).toBe(2);
    cache.delete('a');
    expect(cache.size).toBe(1);
    cache.destroy();
  });

  it('should support has()', () => {
    vi.useFakeTimers();
    const cache = new TTLCache<string, number>({ maxSize: 10, ttlMs: 1000, cleanupIntervalMs: 500 });
    cache.set('a', 1);
    expect(cache.has('a')).toBe(true);
    expect(cache.has('b')).toBe(false);

    vi.advanceTimersByTime(1001);
    expect(cache.has('a')).toBe(false);
    cache.destroy();
  });

  it('should return non-expired values from values()', () => {
    vi.useFakeTimers();
    const cache = new TTLCache<string, number>({ maxSize: 10, ttlMs: 1000, cleanupIntervalMs: 5000 });
    cache.set('a', 1);
    cache.set('b', 2);

    expect(cache.values()).toEqual([1, 2]);

    vi.advanceTimersByTime(1001);
    expect(cache.values()).toEqual([]);
    cache.destroy();
  });

  it('should clear all entries on clear()', () => {
    const cache = new TTLCache<string, number>({ maxSize: 10, ttlMs: 60_000 });
    cache.set('a', 1);
    cache.set('b', 2);
    cache.clear();
    expect(cache.size).toBe(0);
    expect(cache.get('a')).toBeUndefined();
    cache.destroy();
  });

  it('should clean up interval on destroy()', () => {
    vi.useFakeTimers();
    const cache = new TTLCache<string, number>({ maxSize: 10, ttlMs: 1000, cleanupIntervalMs: 500 });
    cache.set('a', 1);
    cache.destroy();
    expect(cache.size).toBe(0);
    // Should not throw when timers advance after destroy
    vi.advanceTimersByTime(5000);
  });

  it('should delete individual entries', () => {
    const cache = new TTLCache<string, number>({ maxSize: 10, ttlMs: 60_000 });
    cache.set('a', 1);
    expect(cache.delete('a')).toBe(true);
    expect(cache.get('a')).toBeUndefined();
    expect(cache.delete('nonexistent')).toBe(false);
    cache.destroy();
  });

  it('should run periodic eviction of expired entries', () => {
    vi.useFakeTimers();
    const cache = new TTLCache<string, number>({ maxSize: 10, ttlMs: 500, cleanupIntervalMs: 300 });
    cache.set('a', 1);
    cache.set('b', 2);

    // Entries should still be present before TTL
    vi.advanceTimersByTime(400);
    expect(cache.size).toBe(2);

    // After TTL + cleanup interval, entries should be evicted
    vi.advanceTimersByTime(200);
    // Cleanup interval at 300ms, 600ms fires cleanup. TTL is 500ms, so entries expired.
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBeUndefined();
    cache.destroy();
  });
});
