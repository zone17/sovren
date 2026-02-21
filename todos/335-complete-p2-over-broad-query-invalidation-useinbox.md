---
status: pending
priority: p2
issue_id: 335
tags: [code-review, frontend, performance]
---

# Over-broad query invalidation in useInbox.ts

## Problem Statement

The useInbox hook invalidates the broad `['inbox']` query key after mutations, which causes ALL inbox-related queries to refetch simultaneously. This includes message lists, counts, platform stats, and any other queries under the `inbox` key prefix. This leads to unnecessary network requests and UI flickering.

## Findings

- `packages/frontend/src/features/multi-platform/hooks/useInbox.ts` — mutation `onSuccess` callbacks invalidate `['inbox']` (the root key)
- This triggers refetch of every query that starts with `['inbox', ...]`

## Proposed Solutions

1. Use specific invalidation keys like `['inbox', 'messages']`, `['inbox', 'counts']`, etc.
2. Only invalidate the queries that are actually affected by the mutation
3. Consider using `queryClient.setQueryData()` for optimistic updates where appropriate

## Technical Details

- **Affected Files**: packages/frontend/src/features/multi-platform/hooks/useInbox.ts

## Acceptance Criteria

- [ ] Mutation invalidations use specific query keys instead of broad `['inbox']`
- [ ] Only affected queries are refetched after each mutation
- [ ] No unnecessary network requests after inbox mutations
- [ ] UI does not flicker from over-fetching
