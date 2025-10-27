/**
 * Cache Service Interface
 * User Story: US-E5-010
 * Interface for caching with TTL management and pattern-based invalidation
 * Part of Epic 005 - Backend Service Layer Refactoring
 */

export interface CacheOptions {
  ttl?: number;
  tags?: string[];
}

export interface ICacheService {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number, options?: CacheOptions): Promise<void>;
  delete(key: string): Promise<boolean>;
  exists(key: string): Promise<boolean>;
  invalidate(pattern: string): Promise<number>;
  invalidateByTags(tags: string[]): Promise<number>;
  flush(): Promise<void>;
  getTtl(key: string): Promise<number>;
  setTtl(key: string, ttl: number): Promise<boolean>;
  getMany<T>(keys: string[]): Promise<Map<string, T | null>>;
  setMany<T>(entries: Array<{ key: string; value: T; ttl?: number }>): Promise<void>;
  remember<T>(key: string, factory: () => Promise<T>, ttl?: number): Promise<T>;
  healthCheck(): Promise<boolean>;
  dispose(): Promise<void>;
}
