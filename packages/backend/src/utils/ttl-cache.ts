/**
 * Simple bounded Map with TTL eviction.
 * Entries expire after ttlMs and the map never exceeds maxSize.
 * On overflow, the least recently accessed entry is evicted (LRU).
 * Optional onEvict callback fires when entries are removed by TTL or overflow.
 */
export class TTLCache<K, V> {
  private map = new Map<K, { value: V; expiresAt: number; lastAccessed: number }>();
  private maxSize: number;
  private ttlMs: number;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private onEvict?: (key: K, value: V) => void;

  constructor(opts: {
    maxSize: number;
    ttlMs: number;
    cleanupIntervalMs?: number;
    onEvict?: (key: K, value: V) => void;
  }) {
    this.maxSize = opts.maxSize;
    this.ttlMs = opts.ttlMs;
    this.onEvict = opts.onEvict;

    const cleanupMs = opts.cleanupIntervalMs ?? Math.min(opts.ttlMs, 60_000);
    this.cleanupInterval = setInterval(() => this.evictExpired(), cleanupMs);
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  get(key: K): V | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.map.delete(key);
      this.onEvict?.(key, entry.value);
      return undefined;
    }
    entry.lastAccessed = Date.now();
    return entry.value;
  }

  set(key: K, value: V): void {
    if (this.map.size >= this.maxSize && !this.map.has(key)) {
      // LRU eviction: find entry with oldest lastAccessed
      let oldestKey: K | undefined;
      let oldestAccess = Infinity;
      for (const [k, entry] of this.map) {
        if (entry.lastAccessed < oldestAccess) {
          oldestAccess = entry.lastAccessed;
          oldestKey = k;
        }
      }
      if (oldestKey !== undefined) {
        const evicted = this.map.get(oldestKey);
        this.map.delete(oldestKey);
        if (evicted) this.onEvict?.(oldestKey, evicted.value);
      }
    }
    const now = Date.now();
    this.map.set(key, { value, expiresAt: now + this.ttlMs, lastAccessed: now });
  }

  has(key: K): boolean {
    return this.get(key) !== undefined;
  }

  delete(key: K): boolean {
    const entry = this.map.get(key);
    const deleted = this.map.delete(key);
    if (deleted && entry) {
      this.onEvict?.(key, entry.value);
    }
    return deleted;
  }

  clear(): void {
    this.map.clear();
  }

  /** Returns the count of non-expired entries. */
  get size(): number {
    const now = Date.now();
    let count = 0;
    for (const entry of this.map.values()) {
      if (now <= entry.expiresAt) {
        count++;
      }
    }
    return count;
  }

  values(): V[] {
    const now = Date.now();
    const result: V[] = [];
    const expiredKeys: K[] = [];
    for (const [key, entry] of this.map) {
      if (now > entry.expiresAt) {
        expiredKeys.push(key);
      } else {
        result.push(entry.value);
      }
    }
    // Delete expired entries after iteration to avoid mutation during iteration
    for (const key of expiredKeys) {
      const entry = this.map.get(key);
      this.map.delete(key);
      if (entry) this.onEvict?.(key, entry.value);
    }
    return result;
  }

  /** Remove all expired entries. */
  cleanExpired(): void {
    this.evictExpired();
  }

  private evictExpired(): void {
    const now = Date.now();
    const expiredKeys: K[] = [];
    for (const [key, entry] of this.map) {
      if (now > entry.expiresAt) {
        expiredKeys.push(key);
      }
    }
    for (const key of expiredKeys) {
      const entry = this.map.get(key);
      this.map.delete(key);
      if (entry) this.onEvict?.(key, entry.value);
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.map.clear();
  }
}
