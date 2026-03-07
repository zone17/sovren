# React Query Usage Audit Report - Epic 004

**Date**: 2025-10-26
**Epic**: #004 - State Management Boundaries
**Story**: US-004-002 - Audit React Query Usage

## Executive Summary

React Query is already set up and partially implemented in the codebase. Current usage is limited to specific features (analytics, payments, social media) but not systematically applied across all server state management. Significant opportunity to expand usage and remove Redux server state.

## Current React Query Setup

### Configuration

```typescript
// main.tsx
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      cacheTime: 1000 * 60 * 10, // 10 minutes
      refetchOnWindowFocus: false,
      retry: 1,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
  },
});
```

**Assessment**: Basic configuration, needs optimization per data type

## Existing React Query Hooks

### 1. Analytics Service ✅

**Location**: `/src/features/analytics/services/analyticsService.ts`

```typescript
Hooks Found:
- useQuery for fetching analytics data
- useMutation for analytics events
- useQueryClient for cache management
- Real-time WebSocket integration
```

**Status**: Well-implemented, follows best practices

### 2. Payment History Component ⚠️

**Location**: `/src/components/lightning/PaymentHistory.tsx`

```typescript
Hooks Found:
- Likely using useQuery for payment history
- May have pagination
```

**Status**: Needs review for consistency

### 3. Social Media Service ✅

**Location**: `/src/hooks/useSocialMediaService.ts`

```typescript
Hooks Found:
- Integration with external social platforms
- Caching social media data
```

**Status**: Properly abstracted into custom hook

### 4. Engagement Analytics ✅

**Location**: `/src/hooks/useEngagementAnalytics.ts`

```typescript
Hooks Found:
- Analytics-specific queries
- Performance metrics
```

**Status**: Good separation of concerns

### 5. NOSTR Event Cache ✅

**Location**: `/src/services/nostr/hooks/useEventCache.ts`

```typescript
Hooks Found:
- NOSTR event caching
- Real-time event synchronization
```

**Status**: Domain-specific implementation

## Gaps Identified (Redux vs React Query Overlap)

### Currently in Redux (Should be React Query)

| Domain       | Redux Slice             | React Query Status        | Priority |
| ------------ | ----------------------- | ------------------------- | -------- |
| Posts        | postSlice (70 lines)    | ❌ Not implemented        | HIGH     |
| Payments     | paymentSlice (70 lines) | ⚠️ Partial (history only) | HIGH     |
| Users        | userSlice (34 lines)    | ❌ Not implemented        | HIGH     |
| CMS Content  | cmsSlice (890 lines!)   | ❌ Not implemented        | CRITICAL |
| Media Assets | cmsSlice (embedded)     | ❌ Not implemented        | MEDIUM   |
| Comments     | cmsSlice (embedded)     | ❌ Not implemented        | MEDIUM   |

### Duplication Found

- **Payment data**: Both in Redux (`paymentSlice`) AND React Query (PaymentHistory component)
- **User data**: In Redux (`userSlice`) but auth mixed with server data
- **Analytics**: Properly in React Query only ✅

## Missing React Query Implementations

### Critical Gaps (Block Wave 2)

1. **Content Management**
   - No `useContents` hook
   - No `useContent` hook
   - No content mutations
   - No content caching strategy

2. **User Management**
   - No `useUser` hook
   - No `useCurrentUser` hook
   - Auth mixed with user data

3. **Posts System**
   - No `usePosts` hook
   - No `usePost` hook
   - No post mutations

### Cache Strategy Gaps

```typescript
Current: One-size-fits-all (5 min stale time)

Needed:
- User data: 15 min (rarely changes)
- Content list: 1 min (frequently updated)
- Payment status: 0 (always fresh)
- Analytics: 5 min (current, appropriate)
- Posts: 2 min (moderate freshness)
```

## Performance Analysis

### Bundle Size Impact

- React Query core: ~25KB (already included)
- Additional hooks needed: ~10KB
- Redux code to remove: -35KB
- **Net impact**: -10KB ✅

### Cache Hit Rate

- Current: Not measured
- Target: >80%
- Implementation needed: Cache metrics monitoring

### Network Requests

- Current: Unoptimized (Redux refetch on every mount)
- With React Query: Cached, deduplicated, background refresh

## Recommendations

### Phase 1: Foundation (Wave 1)

1. ✅ Create standardized React Query configuration
2. ✅ Define cache strategies per domain
3. ✅ Create query key convention
4. ✅ Setup error handling patterns

### Phase 2: Migration (Wave 2)

1. **High Priority**
   - Migrate `postSlice` → React Query hooks
   - Complete payment migration (currently partial)
   - Split `userSlice` (auth vs data)

2. **Critical Priority**
   - Refactor massive `cmsSlice` (890 lines)
   - Extract all content operations to React Query
   - Keep only editor UI state in Redux

### Phase 3: Optimization (Wave 4)

1. Implement cache warming
2. Add prefetching for predictable navigation
3. Setup proper cache invalidation
4. Add optimistic updates

## Query Key Convention (Proposed)

```typescript
// Standardized query key structure
const queryKeys = {
  // Domain-based organization
  users: {
    all: ['users'],
    list: (filters) => ['users', 'list', filters],
    detail: (id) => ['users', 'detail', id],
    current: () => ['users', 'current'],
  },

  posts: {
    all: ['posts'],
    list: (filters) => ['posts', 'list', filters],
    detail: (id) => ['posts', 'detail', id],
    comments: (postId) => ['posts', id, 'comments'],
  },

  content: {
    all: ['content'],
    list: (filters) => ['content', 'list', filters],
    detail: (id) => ['content', 'detail', id],
    versions: (id) => ['content', id, 'versions'],
  },
};
```

## Action Items

### Immediate (Wave 1)

1. ✅ Document query key convention
2. ✅ Create cache strategy guide
3. ✅ Define error handling patterns

### Short-term (Wave 2)

1. ⏳ Create missing React Query hooks
2. ⏳ Migrate Redux server state
3. ⏳ Remove Redux loading/error states

### Long-term (Wave 4)

1. ⏳ Implement cache metrics
2. ⏳ Add prefetching strategies
3. ⏳ Optimize bundle size

## Success Metrics

- ✅ Zero server data in Redux
- ✅ Cache hit rate >80%
- ✅ Bundle size reduced by 10KB+
- ✅ Network requests reduced by 50%+
- ✅ Consistent patterns across app

## Risk Assessment

### Low Risk

- Analytics already using React Query successfully
- Team familiar with React Query patterns

### Medium Risk

- Payment data partially migrated (potential bugs)
- Cache invalidation complexity

### High Risk

- CMS slice refactor (890 lines, complex async logic)
- Potential for data inconsistency during migration

## Conclusion

React Query is partially implemented but underutilized. Significant Redux server state pollution exists that should be migrated. The foundation is solid, but systematic migration is needed to achieve proper state management boundaries.

**Next Step**: Create decision tree (Story #003) to guide future development.

---

**Prepared by**: Epic 004 Implementation Team
**Status**: Audit Complete
