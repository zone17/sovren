/**
 * 🎣 React Query Hooks for NOSTR Event Cache
 * US-317: NOSTR Caching Layer - Subtask 2
 *
 * React Query integration for EventCacheService
 * Provides declarative caching with automatic refetching and invalidation
 *
 * Features:
 * - Query hooks for events and profiles
 * - Mutation hooks for cache updates
 * - Optimistic updates
 * - Background refetching
 * - Automatic TTL management
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
  type UseMutationOptions,
} from '@tanstack/react-query';
import type { NostrEvent, NostrFilter } from '@shared/types/nostr';
import { getEventCache } from '../EventCacheService';

// ========================================
// Query Key Factories
// ========================================

/**
 * Query key factory for consistent cache keys
 */
export const eventCacheKeys = {
  all: ['nostr-events'] as const,
  event: (id: string) => [...eventCacheKeys.all, 'event', id] as const,
  events: (filter: NostrFilter) => [...eventCacheKeys.all, 'filter', filter] as const,
  profile: (pubkey: string) => [...eventCacheKeys.all, 'profile', pubkey] as const,
  profiles: () => [...eventCacheKeys.all, 'profiles'] as const,
  metadata: (pubkey: string) => [...eventCacheKeys.all, 'metadata', pubkey] as const,
  nip05: (nip05: string) => [...eventCacheKeys.all, 'nip05', nip05] as const,
  stats: () => [...eventCacheKeys.all, 'stats'] as const,
};

// ========================================
// Event Hooks
// ========================================

/**
 * Hook to fetch a single event by ID
 * TTL: 5 minutes (default for events)
 */
export function useEvent(
  eventId: string,
  options?: Omit<UseQueryOptions<NostrEvent | null>, 'queryKey' | 'queryFn'>
) {
  const cache = getEventCache();

  return useQuery({
    queryKey: eventCacheKeys.event(eventId),
    queryFn: async () => {
      const event = await cache.get(eventId);
      return event;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
    ...options,
  });
}

/**
 * Hook to fetch multiple events by IDs
 * TTL: 5 minutes
 */
export function useEvents(
  eventIds: string[],
  options?: Omit<UseQueryOptions<NostrEvent[]>, 'queryKey' | 'queryFn'>
) {
  const cache = getEventCache();

  return useQuery({
    queryKey: [...eventCacheKeys.all, 'events', eventIds.join(',')],
    queryFn: async () => {
      const events = await cache.getMany(eventIds);
      return events;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    enabled: eventIds.length > 0,
    ...options,
  });
}

/**
 * Hook to query events by filter
 * TTL: 5 minutes for general queries
 */
export function useEventQuery(
  filter: NostrFilter,
  options?: Omit<UseQueryOptions<NostrEvent[]>, 'queryKey' | 'queryFn'>
) {
  const cache = getEventCache();

  return useQuery({
    queryKey: eventCacheKeys.events(filter),
    queryFn: async () => {
      const events = await cache.query(filter);
      return events;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    ...options,
  });
}

// ========================================
// Profile Hooks (Kind 0 Events)
// ========================================

/**
 * Hook to fetch user profile (kind 0 event)
 * TTL: 1 hour (profiles change less frequently)
 */
export function useProfile(
  pubkey: string,
  options?: Omit<UseQueryOptions<NostrEvent | null>, 'queryKey' | 'queryFn'>
) {
  const cache = getEventCache();

  return useQuery({
    queryKey: eventCacheKeys.profile(pubkey),
    queryFn: async () => {
      // Query for kind 0 (metadata) event
      const events = await cache.query({
        kinds: [0],
        authors: [pubkey],
        limit: 1,
      });
      return events[0] || null;
    },
    staleTime: 60 * 60 * 1000, // 1 hour
    gcTime: 2 * 60 * 60 * 1000, // 2 hours
    ...options,
  });
}

/**
 * Hook to fetch multiple profiles
 * TTL: 1 hour
 */
export function useProfiles(
  pubkeys: string[],
  options?: Omit<UseQueryOptions<NostrEvent[]>, 'queryKey' | 'queryFn'>
) {
  const cache = getEventCache();

  return useQuery({
    queryKey: [...eventCacheKeys.profiles(), pubkeys.join(',')],
    queryFn: async () => {
      const events = await cache.query({
        kinds: [0],
        authors: pubkeys,
      });
      return events;
    },
    staleTime: 60 * 60 * 1000,
    gcTime: 2 * 60 * 60 * 1000,
    enabled: pubkeys.length > 0,
    ...options,
  });
}

// ========================================
// NIP-05 Verification Cache
// ========================================

/**
 * Hook to cache NIP-05 verification results
 * TTL: 24 hours (verification results are stable)
 */
export function useNIP05Verification(
  nip05: string,
  options?: Omit<UseQueryOptions<any>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: eventCacheKeys.nip05(nip05),
    queryFn: async () => {
      // This would integrate with NIP05Service
      // For now, return cached metadata
      return { nip05, verified: false, lastChecked: Date.now() };
    },
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
    gcTime: 48 * 60 * 60 * 1000, // 48 hours
    ...options,
  });
}

// ========================================
// Cache Mutation Hooks
// ========================================

/**
 * Hook to add/update event in cache
 */
export function useSetEvent(
  options?: UseMutationOptions<void, Error, { event: NostrEvent; metadata?: any }>
) {
  const cache = getEventCache();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ event, metadata }) => {
      await cache.set(event, metadata);
    },
    onSuccess: (_data, variables) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({
        queryKey: eventCacheKeys.event(variables.event.id),
      });

      // Invalidate author queries
      queryClient.invalidateQueries({
        queryKey: [...eventCacheKeys.all, 'filter'],
        predicate: (query) => {
          const filter = query.queryKey[2] as NostrFilter;
          return filter?.authors?.includes(variables.event.pubkey) ?? false;
        },
      });

      // Invalidate kind queries
      queryClient.invalidateQueries({
        queryKey: [...eventCacheKeys.all, 'filter'],
        predicate: (query) => {
          const filter = query.queryKey[2] as NostrFilter;
          return filter?.kinds?.includes(variables.event.kind) ?? false;
        },
      });

      // If it's a profile update (kind 0), invalidate profile cache
      if (variables.event.kind === 0) {
        queryClient.invalidateQueries({
          queryKey: eventCacheKeys.profile(variables.event.pubkey),
        });
      }
    },
    ...options,
  });
}

/**
 * Hook to batch add events to cache
 */
export function useSetEvents(
  options?: UseMutationOptions<void, Error, NostrEvent[]>
) {
  const cache = getEventCache();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (events: NostrEvent[]) => {
      await cache.setMany(events);
    },
    onSuccess: (_data, variables) => {
      // Invalidate all filter queries
      queryClient.invalidateQueries({
        queryKey: [...eventCacheKeys.all, 'filter'],
      });

      // Invalidate individual event queries
      variables.forEach((event) => {
        queryClient.invalidateQueries({
          queryKey: eventCacheKeys.event(event.id),
        });

        // Invalidate profiles for kind 0
        if (event.kind === 0) {
          queryClient.invalidateQueries({
            queryKey: eventCacheKeys.profile(event.pubkey),
          });
        }
      });
    },
    ...options,
  });
}

/**
 * Hook to delete event from cache
 */
export function useDeleteEvent(
  options?: UseMutationOptions<void, Error, string>
) {
  const cache = getEventCache();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (eventId: string) => {
      await cache.delete(eventId);
    },
    onSuccess: (_data, eventId) => {
      queryClient.invalidateQueries({
        queryKey: eventCacheKeys.event(eventId),
      });
    },
    ...options,
  });
}

/**
 * Hook to clear entire cache
 */
export function useClearCache(
  options?: UseMutationOptions<void, Error, void>
) {
  const cache = getEventCache();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await cache.clear();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: eventCacheKeys.all,
      });
    },
    ...options,
  });
}

// ========================================
// Cache Invalidation Hooks
// ========================================

/**
 * Hook to invalidate cache by pattern
 */
export function useInvalidateCache() {
  const cache = getEventCache();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (pattern: string) => {
      await cache.invalidate(pattern);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: eventCacheKeys.all,
      });
    },
  });
}

/**
 * Hook to invalidate cache on event publish
 */
export function useInvalidateOnPublish() {
  const cache = getEventCache();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (event: NostrEvent) => {
      await cache.invalidateOnPublish(event);
    },
    onSuccess: (_data, event) => {
      // Invalidate author and kind queries
      queryClient.invalidateQueries({
        queryKey: [...eventCacheKeys.all, 'filter'],
      });

      if (event.kind === 0) {
        queryClient.invalidateQueries({
          queryKey: eventCacheKeys.profile(event.pubkey),
        });
      }
    },
  });
}

// ========================================
// Cache Statistics Hooks
// ========================================

/**
 * Hook to get cache statistics
 */
export function useCacheStats(
  options?: Omit<UseQueryOptions<any>, 'queryKey' | 'queryFn'>
) {
  const cache = getEventCache();

  return useQuery({
    queryKey: eventCacheKeys.stats(),
    queryFn: async () => {
      const stats = await cache.getStats();
      const metrics = cache.getPerformanceMetrics();
      const hitRate = cache.getHitRate();

      return {
        ...stats,
        metrics,
        hitRate,
      };
    },
    staleTime: 10 * 1000, // 10 seconds
    gcTime: 30 * 1000, // 30 seconds
    refetchInterval: 30 * 1000, // Auto-refresh every 30s
    ...options,
  });
}

// ========================================
// Utility Hooks
// ========================================

/**
 * Hook to warm cache with filters
 */
export function useWarmCache() {
  const cache = getEventCache();

  return useMutation({
    mutationFn: async (filters: NostrFilter[]) => {
      await cache.warmCache(filters);
    },
  });
}

/**
 * Hook to preload specific events
 */
export function usePreloadEvents() {
  const cache = getEventCache();

  return useMutation({
    mutationFn: async (eventIds: string[]) => {
      await cache.preload(eventIds);
    },
  });
}

/**
 * Hook to manually trigger cache cleanup
 */
export function useCacheCleanup() {
  const cache = getEventCache();

  return useMutation({
    mutationFn: async () => {
      await cache.cleanup();
    },
  });
}

// ========================================
// Composite Hooks
// ========================================

/**
 * Hook to fetch event with automatic background refetching
 */
export function useEventLive(
  eventId: string,
  refetchInterval: number = 30000 // 30 seconds
) {
  return useEvent(eventId, {
    refetchInterval,
    refetchOnWindowFocus: true,
  });
}

/**
 * Hook to fetch profile with stale-while-revalidate strategy
 */
export function useProfileOptimistic(pubkey: string) {
  const queryClient = useQueryClient();
  const cache = getEventCache();

  return useQuery({
    queryKey: eventCacheKeys.profile(pubkey),
    queryFn: async () => {
      // Return cached data immediately if available
      const cached = await cache.query({
        kinds: [0],
        authors: [pubkey],
        limit: 1,
      });

      if (cached[0]) {
        return cached[0];
      }

      // If not cached, this would trigger a relay fetch
      // (handled by the calling component)
      return null;
    },
    staleTime: 60 * 60 * 1000, // 1 hour
    gcTime: 2 * 60 * 60 * 1000,
    // Return cached data immediately even if stale
    refetchOnMount: 'always',
    refetchOnReconnect: true,
  });
}

/**
 * Hook to get cache performance metrics with auto-refresh
 */
export function useCachePerformance() {
  return useCacheStats({
    refetchInterval: 10000, // Refresh every 10 seconds
    refetchOnWindowFocus: false,
  });
}

// ========================================
// Export all hooks
// ========================================

export default {
  // Event hooks
  useEvent,
  useEvents,
  useEventQuery,
  useEventLive,

  // Profile hooks
  useProfile,
  useProfiles,
  useProfileOptimistic,

  // NIP-05 hooks
  useNIP05Verification,

  // Mutation hooks
  useSetEvent,
  useSetEvents,
  useDeleteEvent,
  useClearCache,
  useInvalidateCache,
  useInvalidateOnPublish,

  // Statistics hooks
  useCacheStats,
  useCachePerformance,

  // Utility hooks
  useWarmCache,
  usePreloadEvents,
  useCacheCleanup,

  // Query keys
  eventCacheKeys,
};
