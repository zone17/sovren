/**
 * Mock Cache for Testing
 * Simple in-memory cache implementation
 */

import type { ICacheService } from '../../interfaces/shared/ICacheService';

export function createMockCache(config?: { real?: boolean }): ICacheService {
  const cache = new Map<string, { value: any; expiresAt?: number }>();

  return {
    get: async <T>(key: string): Promise<T | null> => {
      const entry = cache.get(key);
      if (!entry) return null;
      if (entry.expiresAt && entry.expiresAt < Date.now()) {
        cache.delete(key);
        return null;
      }
      return entry.value;
    },

    set: async <T>(key: string, value: T, ttl?: number): Promise<void> => {
      cache.set(key, {
        value,
        expiresAt: ttl ? Date.now() + ttl * 1000 : undefined
      });
    },

    delete: async (key: string): Promise<boolean> => {
      return cache.delete(key);
    },

    clear: async (): Promise<void> => {
      cache.clear();
    },

    exists: async (key: string): Promise<boolean> => {
      return cache.has(key);
    },

    ttl: async (key: string): Promise<number> => {
      const entry = cache.get(key);
      if (!entry || !entry.expiresAt) return -1;
      const remaining = Math.floor((entry.expiresAt - Date.now()) / 1000);
      return remaining > 0 ? remaining : -2;
    },

    increment: async (key: string, amount = 1): Promise<number> => {
      const current = (await cache.get(key)) || 0;
      const newValue = (current as number) + amount;
      await cache.set(key, newValue);
      return newValue;
    },

    getSize: () => cache.size,
    getKeys: () => Array.from(cache.keys())
  };
}
