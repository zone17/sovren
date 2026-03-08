---
status: pending
priority: p2
issue_id: '574'
tags: [code-review, pr-108, backend, consistency]
---

# Align sortBy/sort naming between shared type and API contract

## Problem Statement

The shared type uses `sortBy` (`DiscoveryFilters.sortBy`) while the backend Zod schema uses `sort`. The hook maps between them, but the shared type doesn't accurately describe the API query parameters. Someone reading the shared type to understand the API would send `sortBy` and it would be silently ignored.

## Findings

- `shared/src/types/discovery.ts`: `sortBy?: 'relevance' | 'followers' | 'newest'`
- `discovery.routes.ts` Zod schema: `sort: z.enum([...])`
- Hook maps: `sort: effectiveFilters.sortBy`

## Proposed Solutions

**Option A: Rename Zod field to `sortBy` to match shared type**
**Option B: Add separate `DiscoveryQueryParams` type for API contract, keep `DiscoveryFilters` as frontend-only**

## Acceptance Criteria

- [ ] Shared type and API query parameter names are consistent
- [ ] No silent parameter dropping
