/**
 * Simple bounded Map with TTL eviction.
 * Entries expire after ttlMs and the map never exceeds maxSize.
 * On overflow, the oldest entry is evicted (FIFO).
 * Optional onEvict callback fires when entries are removed by TTL or overflow.
 */
export class TTLCache<K, V> {
  private map = new Map<K, { value: V; expiresAt: number }>();
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
    return entry.value;
  }

  set(key: K, value: V): void {
    if (this.map.size >= this.maxSize && !this.map.has(key)) {
      const firstKey = this.map.keys().next().value;
      if (firstKey !== undefined) {
        const evicted = this.map.get(firstKey);
        this.map.delete(firstKey);
        if (evicted) this.onEvict?.(firstKey, evicted.value);
      }
    }
    this.map.set(key, { value, expiresAt: Date.now() + this.ttlMs });
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

  get size(): number {
    return this.map.size;
  }

  values(): V[] {
    const now = Date.now();
    const result: V[] = [];
    for (const [key, entry] of this.map) {
      if (now > entry.expiresAt) {
        this.map.delete(key);
        this.onEvict?.(key, entry.value);
      } else {
        result.push(entry.value);
      }
    }
    return result;
  }

  private evictExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.map) {
      if (now > entry.expiresAt) {
        this.map.delete(key);
        this.onEvict?.(key, entry.value);
      }
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
