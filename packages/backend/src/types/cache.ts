export interface CacheOptions {
  ttl?: number;
  tags?: string[];
  [key: string]: any;
}

export interface CacheStats {
  hits: number;
  misses: number;
  keys: number;
  memoryUsage?: number;
  [key: string]: any;
}

export interface CacheConfiguration {
  defaultTtl: number;
  maxEntries?: number;
  prefix?: string;
  [key: string]: any;
}

export interface CacheInvalidationPattern {
  pattern: string;
  type: 'prefix' | 'glob' | 'regex';
  [key: string]: any;
}

export interface CacheWarmupStrategy {
  keys: string[];
  factory: (key: string) => Promise<any>;
  ttl?: number;
  [key: string]: any;
}
