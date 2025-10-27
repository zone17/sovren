# US-224: Analytics Dependencies - Engineer Training Guide

**Document Type**: Engineer Training Guide
**Target Audience**: Frontend Engineers, Full-Stack Engineers
**Training Level**: Intermediate to Advanced
**Duration**: 2-3 hours
**Version**: 1.0.0
**Date**: December 30, 2024

---

## 🎯 **LEARNING OBJECTIVES**

By completing this training, engineers will be able to:

1. **Configure and use @tanstack/react-query** for analytics data management
2. **Implement proper dependency management** with version locking and security
3. **Write comprehensive tests** for React Query integration
4. **Debug and troubleshoot** dependency-related issues
5. **Follow best practices** for analytics component development

---

## 📚 **PREREQUISITES**

### **Required Knowledge**

- React functional components and hooks
- TypeScript fundamentals
- JavaScript Promise handling
- Testing with Jest and React Testing Library
- Basic npm/package management

### **Recommended Experience**

- State management patterns (Redux/Zustand)
- Error boundary implementation
- Performance optimization techniques
- CI/CD pipeline understanding

---

## 🧠 **MODULE 1: React Query Fundamentals**

### **Core Concepts**

#### **QueryClient Configuration**

```typescript
// Optimal QueryClient setup for analytics
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // Data fresh for 5 minutes
      gcTime: 10 * 60 * 1000, // Cache for 10 minutes
      retry: 3, // Retry failed requests
      refetchOnWindowFocus: false, // Prevent excessive refetching
    },
  },
});
```

#### **Provider Integration**

```typescript
// Proper provider hierarchy
<QueryClientProvider client={queryClient}>
  <Provider store={store}>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </Provider>
  <ReactQueryDevtools initialIsOpen={false} />
</QueryClientProvider>
```

### **Hands-on Exercise 1: Basic Setup**

**Task**: Set up React Query in a new component

```typescript
// Exercise: Create useEngagementMetrics hook
export const useEngagementMetrics = (creatorId: string) => {
  return useQuery({
    queryKey: ['engagement', creatorId],
    queryFn: () => fetchEngagementData(creatorId),
    enabled: !!creatorId,
    // Add appropriate configuration
  });
};

// Exercise: Use the hook in a component
const EngagementWidget = ({ creatorId }: { creatorId: string }) => {
  const { data, isLoading, error } = useEngagementMetrics(creatorId);

  // Implement loading, error, and success states
  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;

  return <MetricsDisplay data={data} />;
};
```

**Solution Points**:

- Proper query key structure
- Enabled condition for dynamic queries
- Loading and error state handling
- Data transformation with `select`

---

## 🔧 **MODULE 2: Advanced Query Patterns**

### **Query Key Strategies**

#### **Hierarchical Keys**

```typescript
// Best practice: Query key factories
export const analyticsKeys = {
  all: ['analytics'] as const,
  engagement: (creatorId: string) => [...analyticsKeys.all, 'engagement', creatorId] as const,
  metrics: (creatorId: string, timeRange: TimeRange) =>
    [...analyticsKeys.all, 'metrics', creatorId, timeRange] as const,
};
```

#### **Cache Invalidation Strategies**

```typescript
// Strategic cache invalidation
const invalidateAnalytics = (queryClient: QueryClient, creatorId: string) => {
  // Invalidate all analytics for creator
  queryClient.invalidateQueries({
    queryKey: ['analytics', creatorId],
  });

  // Remove specific data
  queryClient.removeQueries({
    queryKey: ['analytics', 'engagement', creatorId],
    exact: true,
  });
};
```

### **Hands-on Exercise 2: Mutation and Cache Management**

**Task**: Implement optimistic updates for analytics settings

```typescript
// Exercise: Create optimistic update mutation
export const useUpdateAnalyticsSettings = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateSettings,
    onMutate: async (newSettings) => {
      // 1. Cancel outgoing refetches
      // 2. Snapshot previous value
      // 3. Optimistically update cache
      // 4. Return context for rollback
    },
    onError: (err, newSettings, context) => {
      // Rollback optimistic update
    },
    onSettled: () => {
      // Refetch to ensure consistency
    },
  });
};
```

---

## 🧪 **MODULE 3: Testing React Query Components**

### **Test Setup**

#### **QueryClient Test Configuration**

```typescript
// Test-specific QueryClient
export const createTestQueryClient = (): QueryClient => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
    },
    logger: { log: () => {}, warn: () => {}, error: () => {} },
  });
};
```

#### **Wrapper Component**

```typescript
// Test wrapper with providers
export const renderWithQueryClient = (
  ui: ReactElement,
  { queryClient = createTestQueryClient() } = {}
) => {
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
};
```

### **Hands-on Exercise 3: Component Testing**

**Task**: Write comprehensive tests for analytics component

```typescript
// Exercise: Test analytics dashboard component
describe('EngagementAnalyticsDashboard', () => {
  it('should display loading state initially', async () => {
    // Render component with loading state
    // Assert loading indicator is shown
  });

  it('should display data when query succeeds', async () => {
    // Mock successful API response
    // Render component
    // Wait for data to load
    // Assert data is displayed correctly
  });

  it('should handle error states gracefully', async () => {
    // Mock API error
    // Render component
    // Assert error message is shown
    // Test retry functionality
  });

  it('should invalidate cache on settings update', async () => {
    // Test mutation and cache invalidation
  });
});
```

---

## 🔒 **MODULE 4: Dependency Management**

### **Security Best Practices**

#### **Version Locking**

```json
// package.json - Use exact versions for stability
{
  "dependencies": {
    "@tanstack/react-query": "5.83.0",
    "@tanstack/react-query-devtools": "5.83.0"
  }
}
```

#### **Security Scanning**

```bash
# Regular security audits
npm audit
npm audit fix --dry-run

# Use security scanning in CI/CD
npm ci
npm audit --audit-level moderate
```

### **Hands-on Exercise 4: Dependency Audit**

**Task**: Perform dependency security audit

```bash
# Exercise steps:
1. Run npm audit
2. Identify vulnerabilities
3. Research fix options
4. Apply fixes safely
5. Verify functionality
6. Update documentation
```

---

## 📊 **MODULE 5: Performance Optimization**

### **Bundle Size Management**

#### **Lazy Loading**

```typescript
// Lazy load analytics components
const EngagementDashboard = lazy(() =>
  import('./components/EngagementDashboard')
);

// Use with Suspense
<Suspense fallback={<AnalyticsLoading />}>
  <EngagementDashboard />
</Suspense>
```

#### **Query Optimization**

```typescript
// Optimize with select and enabled
const useOptimizedAnalytics = (creatorId: string, enabled: boolean) => {
  return useQuery({
    queryKey: ['analytics', creatorId],
    queryFn: () => fetchAnalytics(creatorId),
    enabled: enabled && !!creatorId,
    select: (data) => ({
      // Transform only needed data
      engagementRate: data.engagementRate,
      topPosts: data.posts.slice(0, 5),
    }),
    staleTime: 5 * 60 * 1000,
  });
};
```

### **Hands-on Exercise 5: Performance Monitoring**

**Task**: Implement performance monitoring for analytics queries

```typescript
// Exercise: Add performance tracking
const useAnalyticsWithPerformance = (creatorId: string) => {
  const startTime = useRef<number>();

  return useQuery({
    queryKey: ['analytics', creatorId],
    queryFn: async () => {
      startTime.current = performance.now();
      const data = await fetchAnalytics(creatorId);
      const duration = performance.now() - startTime.current;

      // Log performance metrics
      console.log(`Analytics query took ${duration}ms`);

      return data;
    },
    onSuccess: () => {
      // Track success metrics
    },
    onError: () => {
      // Track error metrics
    },
  });
};
```

---

## 🚨 **MODULE 6: Debugging and Troubleshooting**

### **Common Issues and Solutions**

#### **1. Query Not Updating**

```typescript
// Problem: Query not refetching when it should
// Solution: Check query key dependencies
const { data } = useQuery({
  queryKey: ['analytics', creatorId, timeRange], // Include all dependencies
  queryFn: () => fetchAnalytics(creatorId, timeRange),
});
```

#### **2. Memory Leaks**

```typescript
// Problem: Queries continuing after component unmount
// Solution: Proper cleanup and enabled conditions
const { data } = useQuery({
  queryKey: ['analytics', creatorId],
  queryFn: () => fetchAnalytics(creatorId),
  enabled: !!creatorId && componentMounted,
});
```

#### **3. Error Boundaries**

```typescript
// Problem: Unhandled query errors crashing app
// Solution: Error boundary with query reset
<QueryErrorResetBoundary>
  {({ reset }) => (
    <ErrorBoundary onReset={reset}>
      <AnalyticsComponent />
    </ErrorBoundary>
  )}
</QueryErrorResetBoundary>
```

### **Debugging Tools**

#### **React Query Devtools**

```typescript
// Enable detailed debugging
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

// In development only
{process.env.NODE_ENV === 'development' && (
  <ReactQueryDevtools
    initialIsOpen={false}
    position="bottom-right"
  />
)}
```

#### **Custom Logging**

```typescript
// Add custom query logging
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      onError: (error, query) => {
        console.error('Query error:', {
          queryKey: query.queryKey,
          error: error.message,
          variables: query.variables,
        });
      },
      onSuccess: (data, query) => {
        console.log('Query success:', {
          queryKey: query.queryKey,
          dataSize: JSON.stringify(data).length,
        });
      },
    },
  },
});
```

---

## 🎯 **PRACTICAL EXERCISES**

### **Exercise Set A: Implementation**

1. **Set up React Query** in a new analytics feature
2. **Create custom hooks** for different analytics endpoints
3. **Implement error handling** with retry logic
4. **Add optimistic updates** for user interactions
5. **Write comprehensive tests** for all scenarios

### **Exercise Set B: Optimization**

1. **Analyze bundle size** impact of dependencies
2. **Implement lazy loading** for analytics components
3. **Optimize query patterns** for performance
4. **Add performance monitoring** and logging
5. **Configure proper caching** strategies

### **Exercise Set C: Maintenance**

1. **Perform security audit** of dependencies
2. **Update dependencies** following best practices
3. **Document dependency** changes and rationale
4. **Set up automated** dependency monitoring
5. **Create troubleshooting** runbooks

---

## ✅ **KNOWLEDGE CHECK**

### **Quiz Questions**

1. **What is the optimal staleTime for analytics data?**

   - a) 0 minutes
   - b) 5 minutes
   - c) 30 minutes
   - d) It depends on data freshness requirements

2. **When should you use exact version pinning?**

   - a) Always
   - b) Never
   - c) For production dependencies
   - d) Only for major versions

3. **What's the best practice for query keys?**

   - a) Use random strings
   - b) Use hierarchical arrays
   - c) Use function names
   - d) Use timestamps

4. **How should you handle query errors?**
   - a) Ignore them
   - b) Show generic error message
   - c) Use error boundaries and specific handling
   - d) Crash the application

**Answers**: 1-d, 2-c, 3-b, 4-c

### **Practical Assessment**

**Task**: Build a complete analytics dashboard with:

- React Query data fetching
- Error handling and loading states
- Optimistic updates for user actions
- Comprehensive test coverage
- Performance monitoring
- Proper dependency management

**Evaluation Criteria**:

- ✅ Correct React Query configuration
- ✅ Proper error handling implementation
- ✅ Comprehensive test coverage (>95%)
- ✅ Performance optimization applied
- ✅ Security best practices followed
- ✅ Documentation quality

---

## 📚 **ADDITIONAL RESOURCES**

### **Documentation**

- [TanStack Query Official Docs](https://tanstack.com/query/latest)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Jest Testing Framework](https://jestjs.io/docs/getting-started)

### **Tools**

- [React Query Devtools](https://tanstack.com/query/latest/docs/react/devtools)
- [Bundle Analyzer](https://www.npmjs.com/package/webpack-bundle-analyzer)
- [npm audit](https://docs.npmjs.com/cli/v9/commands/npm-audit)

### **Advanced Topics**

- [Query Key Factories](https://tanstack.com/query/latest/docs/react/guides/query-keys)
- [Optimistic Updates](https://tanstack.com/query/latest/docs/react/guides/optimistic-updates)
- [Infinite Queries](https://tanstack.com/query/latest/docs/react/guides/infinite-queries)

---

## 🎓 **CERTIFICATION**

Upon successful completion of all modules and exercises, engineers will receive:

- **Analytics Dependencies Specialist** certification
- **React Query Proficiency** badge
- **Dependency Security** certification
- **Testing Excellence** recognition

---

**Next Steps**:

1. Complete all hands-on exercises
2. Pass the practical assessment
3. Apply knowledge to current projects
4. Share learnings with team members
5. Stay updated with dependency security alerts

---

_Training Version: 1.0.0_
_Last Updated: December 30, 2024_
_Next Review: February 28, 2025_
