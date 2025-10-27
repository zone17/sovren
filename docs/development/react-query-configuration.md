# React Query Configuration Guide

**Document Type**: Technical Configuration Guide
**Version**: 1.0.0
**Date**: December 30, 2024
**Author**: Elite Engineering Team

---

## 📚 **OVERVIEW**

Complete configuration guide for @tanstack/react-query implementation in Sovren analytics components, providing optimal data fetching, caching, and synchronization.

## ⚙️ **CONFIGURATION SETUP**

### **QueryClient Configuration**

```typescript
// packages/frontend/src/main.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
      retry: 3, // Retry failed requests 3 times
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      refetchOnWindowFocus: false, // Don't refetch on window focus
      refetchOnReconnect: true, // Refetch when network reconnects
      refetchOnMount: true, // Refetch when component mounts
    },
    mutations: {
      retry: 1, // Retry mutations once
      onError: (error) => {
        // Global error handling for mutations
        console.error('Mutation error:', error);
      },
    },
  },
});
```

### **Provider Setup**

```typescript
// Application root with proper provider hierarchy
<QueryClientProvider client={queryClient}>
  <Provider store={store}>
    <BrowserRouter>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </BrowserRouter>
  </Provider>
  {process.env.NODE_ENV === 'development' && (
    <ReactQueryDevtools initialIsOpen={false} />
  )}
</QueryClientProvider>
```

---

## 🎯 **HOOK PATTERNS**

### **Analytics Data Fetching**

```typescript
// useEngagementAnalytics hook pattern
export const useEngagementAnalytics = (creatorId: string) => {
  return useQuery({
    queryKey: ['engagement-analytics', creatorId],
    queryFn: () => fetchEngagementMetrics(creatorId),
    enabled: !!creatorId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    select: (data) => ({
      ...data,
      processedAt: new Date().toISOString(),
    }),
  });
};
```

### **Mutation Patterns**

```typescript
// Analytics action mutations
export const useUpdateAnalyticsSettings = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateAnalyticsSettings,
    onSuccess: () => {
      // Invalidate related queries
      queryClient.invalidateQueries({
        queryKey: ['analytics-settings'],
      });
    },
    onError: (error) => {
      // Handle specific error cases
      console.error('Settings update failed:', error);
    },
  });
};
```

---

## 📊 **QUERY KEY STRATEGIES**

### **Hierarchical Query Keys**

```typescript
// Organized query key structure
const queryKeys = {
  analytics: ['analytics'] as const,
  engagement: (creatorId: string) => ['analytics', 'engagement', creatorId] as const,
  metrics: (creatorId: string, timeRange: string) =>
    ['analytics', 'metrics', creatorId, timeRange] as const,
  insights: (creatorId: string) => ['analytics', 'insights', creatorId] as const,
};
```

### **Query Key Factories**

```typescript
// Centralized query key management
export const analyticsKeys = {
  all: ['analytics'] as const,
  lists: () => [...analyticsKeys.all, 'list'] as const,
  list: (filters: string) => [...analyticsKeys.lists(), { filters }] as const,
  details: () => [...analyticsKeys.all, 'detail'] as const,
  detail: (id: string) => [...analyticsKeys.details(), id] as const,
};
```

---

## 🔄 **CACHE MANAGEMENT**

### **Strategic Invalidation**

```typescript
// Targeted cache invalidation
const invalidateAnalyticsData = (queryClient: QueryClient, creatorId: string) => {
  // Invalidate all analytics queries for creator
  queryClient.invalidateQueries({
    queryKey: ['analytics', creatorId],
  });

  // Remove specific cached data
  queryClient.removeQueries({
    queryKey: ['analytics', 'engagement', creatorId],
    exact: true,
  });
};
```

### **Optimistic Updates**

```typescript
// Optimistic update pattern for better UX
export const useOptimisticEngagementUpdate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateEngagement,
    onMutate: async (newData) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: ['engagement-analytics', newData.creatorId],
      });

      // Snapshot previous value
      const previousData = queryClient.getQueryData(['engagement-analytics', newData.creatorId]);

      // Optimistically update cache
      queryClient.setQueryData(['engagement-analytics', newData.creatorId], (old: any) => ({
        ...old,
        ...newData,
      }));

      return { previousData };
    },
    onError: (err, newData, context) => {
      // Rollback on error
      queryClient.setQueryData(['engagement-analytics', newData.creatorId], context?.previousData);
    },
    onSettled: (data, error, variables) => {
      // Always refetch after mutation
      queryClient.invalidateQueries({
        queryKey: ['engagement-analytics', variables.creatorId],
      });
    },
  });
};
```

---

## 🧪 **TESTING CONFIGURATION**

### **Test QueryClient Setup**

```typescript
// packages/frontend/src/test-utils/react-query-test-utils.tsx
export const createTestQueryClient = (): QueryClient => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
    logger: {
      log: () => {},
      warn: () => {},
      error: () => {},
    },
  });
};
```

### **Mock Server Integration**

```typescript
// MSW integration for testing
import { rest } from 'msw';

export const analyticsHandlers = [
  rest.get('/api/analytics/engagement/:creatorId', (req, res, ctx) => {
    return res(
      ctx.json({
        views: 1250,
        likes: 89,
        shares: 23,
        comments: 15,
        engagementRate: 0.102,
      })
    );
  }),
];
```

---

## 🎛️ **PERFORMANCE OPTIMIZATION**

### **Query Deduplication**

```typescript
// Automatic request deduplication for identical queries
// React Query handles this automatically, but be aware of:
// - Multiple components making same query
// - Rapid re-renders triggering same query
// - Network request optimization
```

### **Background Refetching**

```typescript
// Smart background updates
const useEngagementWithBackground = (creatorId: string) => {
  return useQuery({
    queryKey: ['engagement', creatorId],
    queryFn: () => fetchEngagement(creatorId),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 30 * 60 * 1000, // Refetch every 30 minutes
    refetchIntervalInBackground: true, // Continue in background
  });
};
```

### **Pagination Support**

```typescript
// Infinite queries for large datasets
export const useInfiniteAnalyticsData = (creatorId: string) => {
  return useInfiniteQuery({
    queryKey: ['analytics', 'infinite', creatorId],
    queryFn: ({ pageParam = 0 }) => fetchAnalyticsPage(creatorId, pageParam),
    getNextPageParam: (lastPage, pages) => lastPage.nextCursor,
    initialPageParam: 0,
  });
};
```

---

## 🔧 **DEVTOOLS CONFIGURATION**

### **Development Setup**

```typescript
// Enhanced devtools for development
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

// Only in development
{process.env.NODE_ENV === 'development' && (
  <ReactQueryDevtools
    initialIsOpen={false}
    position="bottom-right"
    toggleButtonProps={{
      style: {
        marginLeft: '5px',
        transform: 'scale(0.8)',
      },
    }}
  />
)}
```

---

## 🚨 **ERROR HANDLING**

### **Global Error Handling**

```typescript
// QueryClient error handling
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      onError: (error: any) => {
        if (error?.status === 401) {
          // Handle authentication errors
          redirectToLogin();
        } else if (error?.status >= 500) {
          // Handle server errors
          showErrorNotification('Server error occurred');
        }
      },
    },
  },
});
```

### **Component Error Boundaries**

```typescript
// Error boundary for query errors
<QueryErrorResetBoundary>
  {({ reset }) => (
    <ErrorBoundary
      onReset={reset}
      fallbackRender={({ resetErrorBoundary }) => (
        <div>
          <p>Analytics data failed to load</p>
          <button onClick={resetErrorBoundary}>Try again</button>
        </div>
      )}
    >
      <EngagementAnalyticsDashboard />
    </ErrorBoundary>
  )}
</QueryErrorResetBoundary>
```

---

## 📈 **MONITORING AND DEBUGGING**

### **Query Performance Monitoring**

```typescript
// Custom monitoring for query performance
const useQueryPerformanceMonitor = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleQueryStart = (query: any) => {
      performance.mark(`query-start-${query.queryHash}`);
    };

    const handleQueryEnd = (query: any) => {
      performance.mark(`query-end-${query.queryHash}`);
      performance.measure(
        `query-duration-${query.queryHash}`,
        `query-start-${query.queryHash}`,
        `query-end-${query.queryHash}`
      );
    };

    // Monitor query lifecycle
    queryClient.getQueryCache().subscribe(handleQueryStart);

    return () => {
      queryClient.getQueryCache().unsubscribe(handleQueryStart);
    };
  }, [queryClient]);
};
```

---

## 🎯 **BEST PRACTICES**

1. **Query Key Consistency**: Use factory functions for query keys
2. **Selective Updates**: Use `select` option to transform data
3. **Error Recovery**: Implement retry logic with exponential backoff
4. **Cache Optimization**: Set appropriate staleTime and gcTime
5. **Background Sync**: Enable background refetching for fresh data
6. **Testing**: Always test with mock data and error scenarios

---

## 📚 **REFERENCES**

- [TanStack Query Documentation](https://tanstack.com/query/latest)
- [React Query Best Practices](https://tanstack.com/query/latest/docs/react/guides/best-practices)
- [Query Key Factories](https://tanstack.com/query/latest/docs/react/guides/query-keys#query-key-factories)

---

_Last Updated: December 30, 2024_
_Next Review: January 30, 2025_
