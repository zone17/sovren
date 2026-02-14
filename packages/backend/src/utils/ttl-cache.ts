/**
 * Simple bounded Map with TTL eviction.
 * Entries expire after ttlMs and the map never exceeds maxSize.
 * On overflow, the oldest entry is evicted (FIFO).
 */
export class TTLCache<K, V> {
  private map = new Map<K, { value: V; expiresAt: number }>();
  private maxSize: number;
  private ttlMs: number;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(opts: { maxSize: number; ttlMs: number; cleanupIntervalMs?: number }) {
    this.maxSize = opts.maxSize;
    this.ttlMs = opts.ttlMs;

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
      return undefined;
    }
    return entry.value;
  }

  set(key: K, value: V): void {
    if (this.map.size >= this.maxSize && !this.map.has(key)) {
      const firstKey = this.map.keys().next().value;
      if (firstKey !== undefined) this.map.delete(firstKey);
    }
    this.map.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  has(key: K): boolean {
    return this.get(key) !== undefined;
  }

  delete(key: K): boolean {
    return this.map.delete(key);
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
