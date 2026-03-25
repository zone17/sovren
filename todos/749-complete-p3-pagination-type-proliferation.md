---
status: pending
priority: p3
issue_id: 749
tags: [code-review, slice-8, types, consolidation, pagination]
dependencies: []
---

# P3: Pagination type proliferation

## Problem Statement

Three separate pagination types exist across the codebase (`PaginatedResult`, `PaginatedData`, `PaginatedResponse`), each with slightly different structures. This type fragmentation increases cognitive overhead, makes API contracts inconsistent, and creates maintenance burden when pagination logic changes.

## Findings

- Current types: `PaginatedResult`, `PaginatedData`, `PaginatedResponse`
- Scope: Various shared types files across `@shared/types/`
- Impact: Frontend hooks, API services, backend responses all reference different pagination types
- Technical debt: Multiple source of truth for pagination shape

## Proposed Solutions

1. Define a single canonical `PaginatedResult<T>` type in `@shared/types/pagination.ts`:

```typescript
export interface PaginatedResult<T> {
  data: T[];
  cursor?: string; // or offset, based on your pagination strategy
  hasMore: boolean;
  total?: number; // optional total count if available
}
```

2. Deprecate `PaginatedData` and `PaginatedResponse`; replace all usages with `PaginatedResult<T>`

3. Update all API responses to conform to single shape

## Technical Details

- Single source of truth simplifies type inference in hooks
- Enables generic hook like `usePaginatedQuery<T>()` instead of multiple variants
- Reduces bundle size by eliminating duplicate type definitions
- All new pagination endpoints should use this canonical type

## Acceptance Criteria

- [ ] `PaginatedResult<T>` defined in `@shared/types/pagination.ts`
- [ ] All three old types either deprecated or removed
- [ ] Frontend hooks updated to use `PaginatedResult<T>`
- [ ] Backend API responses aligned to single pagination shape
- [ ] Tests updated to expect `PaginatedResult<T>`
- [ ] No remaining references to `PaginatedData` or `PaginatedResponse` in codebase
