---
status: pending
priority: p2
issue_id: '569'
tags: [code-review, pr-108, backend, consistency]
---

# Add hasNext/hasPrev to discovery pagination response

## Problem Statement

The existing `Pagination` type in `shared/src/types/index.ts` includes `hasNext` and `hasPrev` booleans. Every other paginated endpoint includes these. The discovery response omits them, creating contract inconsistency.

## Findings

- `shared/src/types/discovery.ts`: pagination has `page, limit, total, totalPages` only
- `shared/src/types/index.ts` PaginationSchema: includes `hasNext, hasPrev`
- All other paginated endpoints include these fields

## Proposed Solutions

Add to both the type and the route handler:

```typescript
hasNext: page < Math.ceil(total / limit),
hasPrev: page > 1,
```

## Acceptance Criteria

- [ ] `hasNext` and `hasPrev` added to DiscoveryResponse.pagination type
- [ ] Backend computes and returns both fields
