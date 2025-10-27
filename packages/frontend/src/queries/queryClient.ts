/**
 * React Query Client Configuration with Elite Caching Strategies
 * US-E4-011: Implement Caching Strategies
 *
 * Optimized caching configuration for different data types:
 * - Static data: Long cache (1 hour)
 * - User data: Medium cache (5 minutes)
 * - Real-time data: Short cache (30 seconds)
 * - Financial data: No cache (always fresh)
 */

import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';

// Cache time configurations (in milliseconds)
export const CACHE_TIMES = {
  // Static/Reference Data (1 hour)
  STATIC: {
    staleTime: 60 * 60 * 1000, // 1 hour
    cacheTime: 24 * 60 * 60 * 1000, // 24 hours in cache
  },

  // User Profile Data (5 minutes)
  USER: {
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 30 * 60 * 1000, // 30 minutes in cache
  },

  // Content Data (2 minutes)
  CONTENT: {
    staleTime: 2 * 60 * 1000, // 2 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes in cache
  },

  // Real-time Data (30 seconds)
  REALTIME: {
    staleTime: 30 * 1000, // 30 seconds
    cacheTime: 5 * 60 * 1000, // 5 minutes in cache
  },

  // Financial/Payment Data (always fresh)
  FINANCIAL: {
    staleTime: 0, // Always stale, refetch on mount
    cacheTime: 0, // Don't cache
  },

  // Analytics Data (10 minutes)
  ANALYTICS: {
    staleTime: 10 * 60 * 1000, // 10 minutes
    cacheTime: 60 * 60 * 1000, // 1 hour in cache
  },
} as const;

// Retry configuration based on error type
const getRetryConfig = (failureCount: number, error: any) => {
  // Don't retry on 4xx errors (client errors)
  if (error?.status >= 400 && error?.status < 500) {
    return false;
  }

  // Retry up to 3 times for network errors
  if (failureCount < 3) {
    // Exponential backoff: 1s, 2s, 4s
    return failureCount * 1000;
  }

  return false;
};

// Create the QueryClient with optimized defaults
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Default to content cache times
      staleTime: CACHE_TIMES.CONTENT.staleTime,
      cacheTime: CACHE_TIMES.CONTENT.cacheTime,

      // Retry configuration
      retry: getRetryConfig,

      // Refetch on window focus for fresh data
      refetchOnWindowFocus: true,

      // Don't refetch on reconnect by default (can be overridden)
      refetchOnReconnect: 'always',

      // Keep previous data while fetching new data
      keepPreviousData: true,

      // Structural sharing for optimal re-renders
      structuralSharing: true,
    },
    mutations: {
      // Retry failed mutations once
      retry: 1,

      // Optimistic updates should be reverted on error
      onError: (error: any, variables: any, context: any) => {
        // Show error toast
        toast.error(error?.message || 'An error occurred');

        // Log error for debugging
        console.error('Mutation error:', {
          error,
          variables,
          context,
        });
      },

      // Show success toast for mutations
      onSuccess: (data: any, variables: any, context: any) => {
        // Show success toast if message is provided
        if (data?.message) {
          toast.success(data.message);
        }
      },
    },
  },

  // Query cache configuration
  queryCache: new QueryCache({
    onError: (error: any, query) => {
      // Only show error toast for user-initiated queries
      if (query.meta?.showErrorToast !== false) {
        toast.error(`Error fetching ${query.queryKey[0]}: ${error?.message}`);
      }
    },

    // Global success handler for queries
    onSuccess: (data: any, query) => {
      // Track successful queries for analytics
      if (typeof window !== 'undefined' && window.analytics) {
        window.analytics.track('query_success', {
          queryKey: query.queryKey,
          dataSize: JSON.stringify(data).length,
        });
      }
    },
  }),

  // Mutation cache configuration
  mutationCache: new MutationCache({
    onError: (error: any, variables, context, mutation) => {
      // Track failed mutations for debugging
      console.error('Global mutation error:', {
        mutationKey: mutation.options.mutationKey,
        error,
        variables,
      });
    },

    onSuccess: (data, variables, context, mutation) => {
      // Track successful mutations for analytics
      if (typeof window !== 'undefined' && window.analytics) {
        window.analytics.track('mutation_success', {
          mutationKey: mutation.options.mutationKey,
        });
      }
    },
  }),
});

// Cache invalidation helpers
export const cacheInvalidation = {
  // Invalidate all queries with a specific key
  invalidateQueries: (queryKey: string[]) => {
    return queryClient.invalidateQueries({ queryKey });
  },

  // Invalidate and refetch immediately
  invalidateAndRefetch: (queryKey: string[]) => {
    return queryClient.invalidateQueries({
      queryKey,
      refetchType: 'active',
    });
  },

  // Reset specific queries (remove from cache)
  resetQueries: (queryKey: string[]) => {
    return queryClient.resetQueries({ queryKey });
  },

  // Prefetch data for better UX
  prefetchQuery: (queryKey: string[], fetcher: () => Promise<any>, options?: any) => {
    return queryClient.prefetchQuery({
      queryKey,
      queryFn: fetcher,
      ...options,
    });
  },

  // Update cache manually (optimistic updates)
  setQueryData: (queryKey: string[], data: any) => {
    queryClient.setQueryData(queryKey, data);
  },

  // Get cached data
  getQueryData: (queryKey: string[]) => {
    return queryClient.getQueryData(queryKey);
  },
};

// Smart cache warming for common routes
export const warmCache = async () => {
  const warmingQueries = [
    // Prefetch user profile
    {
      key: ['user', 'profile'],
      fetcher: () => fetch('/api/user/profile').then(r => r.json()),
      options: CACHE_TIMES.USER,
    },

    // Prefetch recent content
    {
      key: ['content', 'recent'],
      fetcher: () => fetch('/api/content?limit=10').then(r => r.json()),
      options: CACHE_TIMES.CONTENT,
    },

    // Prefetch analytics summary
    {
      key: ['analytics', 'summary'],
      fetcher: () => fetch('/api/analytics/summary').then(r => r.json()),
      options: CACHE_TIMES.ANALYTICS,
    },
  ];

  // Run prefetch queries in parallel
  await Promise.allSettled(
    warmingQueries.map(query =>
      cacheInvalidation.prefetchQuery(query.key, query.fetcher, query.options)
    )
  );
};

// Garbage collection for old cache entries
export const cleanupCache = () => {
  // Remove queries older than 24 hours
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours

  queryClient.getQueryCache().getAll().forEach(query => {
    const lastFetch = query.state.dataUpdatedAt;
    if (lastFetch && now - lastFetch > maxAge) {
      queryClient.removeQueries({ queryKey: query.queryKey });
    }
  });
};

// Set up periodic cache cleanup (every hour)
if (typeof window !== 'undefined') {
  setInterval(cleanupCache, 60 * 60 * 1000); // Every hour
}

// DevTools helper for debugging
export const debugCache = () => {
  const cache = queryClient.getQueryCache();
  const queries = cache.getAll();

  console.group('React Query Cache Debug');
  console.log('Total queries in cache:', queries.length);

  queries.forEach(query => {
    const state = query.state;
    console.group(`Query: ${JSON.stringify(query.queryKey)}`);
    console.log('Status:', state.status);
    console.log('Data updated at:', new Date(state.dataUpdatedAt || 0).toLocaleString());
    console.log('Is stale:', query.isStale());
    console.log('Is fetching:', state.isFetching);
    console.log('Data size:', JSON.stringify(state.data || {}).length, 'bytes');
    console.groupEnd();
  });

  console.groupEnd();
};

// Export for use in React Query DevTools
if (typeof window !== 'undefined') {
  (window as any).queryClient = queryClient;
  (window as any).debugCache = debugCache;
  (window as any).cacheInvalidation = cacheInvalidation;
}

export default queryClient;