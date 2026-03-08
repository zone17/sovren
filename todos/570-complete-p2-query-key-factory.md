---
status: pending
priority: p2
issue_id: '570'
tags: [code-review, pr-108, frontend, patterns]
---

# Create discovery query key factory and stabilize object reference

## Problem Statement

The hook uses inline string array `['discovery', 'creators', effectiveFilters]` for the query key. The codebase has an established pattern for query key factories (see `useEventCache.ts`). Additionally, `effectiveFilters` is recreated on every render, causing unnecessary React Query refetches.

**Consensus: 2/9 agents (Pattern Recognition, Performance Oracle)**

## Findings

- `useDiscovery.ts`, line 15: `queryKey: ['discovery', 'creators', effectiveFilters]`
- `effectiveFilters` object recreated every render (unstable reference)
- `useEventCache.ts` establishes key factory pattern: `eventCacheKeys.event(id)`

## Proposed Solutions

```typescript
export const discoveryKeys = {
  all: ['discovery'] as const,
  creators: (filters: DiscoveryFilters) => [...discoveryKeys.all, 'creators', filters] as const,
};
```

Plus `useMemo` for `effectiveFilters`.

## Acceptance Criteria

- [ ] Query key factory created for discovery
- [ ] effectiveFilters wrapped in useMemo to stabilize reference
