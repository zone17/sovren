---
status: pending
priority: p2
issue_id: '587'
tags: [code-review, pr-108, frontend, races]
---

# Debounce-filter desync and keepPreviousData stale content

## Problem Statement

Two related race condition issues:

1. **Debounce-filter desync**: When a user types in search then immediately clicks a category, the debounced query hasn't fired yet. An intermediate fetch fires with the new category but no search query, causing the grid to reshuffle twice.

2. **keepPreviousData across filter changes**: When switching categories, the grid shows the previous category's results under the new category's active state until the fetch completes. This is misleading.

**Flagged by: Frontend Races Reviewer (specialist)**

## Proposed Solutions

**Fix 1**: Pin the debounced query when non-query filters change:

```typescript
const queryOverrideRef = useRef<string | null>(null);
const updateFilters = (patch: Partial<DiscoveryFilters>) => {
  setFilters((prev) => ({ ...prev, ...patch }));
  setPage(1);
  if (!('query' in patch)) {
    queryOverrideRef.current = debouncedQuery;
  }
};
```

**Fix 2**: Only use keepPreviousData for page changes, not filter changes:

```typescript
placeholderData: isPageChangeOnly ? keepPreviousData : undefined,
```

## Acceptance Criteria

- [ ] Category click during typing does not cause double grid reshuffle
- [ ] Filter change shows loading state, not stale data from different filter
