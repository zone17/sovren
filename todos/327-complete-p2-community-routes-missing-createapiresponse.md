---
status: pending
priority: p2
issue_id: 327
tags: [code-review, consistency]
---

# Community routes missing `createApiResponse()` helper

## Problem Statement

Four community route files use hand-rolled `{ success: true, data }` response objects instead of the `createApiResponse()` helper that is consistently used by finance and inbox routes. This inconsistency means community routes miss any future enhancements to the standard response helper (e.g., request ID, metadata).

## Findings

- `packages/backend/src/routes/v2/circles.routes.ts` — uses `{ success: true, data }` pattern
- `packages/backend/src/routes/v2/mentorship.routes.ts` — uses `{ success: true, data }` pattern
- `packages/backend/src/routes/v2/collaboration.routes.ts` — uses `{ success: true, data }` pattern
- `packages/backend/src/routes/v2/marketplace.routes.ts` — uses `{ success: true, data }` pattern
- Finance routes and inbox routes correctly use `createApiResponse(req, data)`

## Proposed Solutions

1. Import `createApiResponse` in all 4 community route files
2. Replace all `{ success: true, data }` with `createApiResponse(req, data)`
3. Verify response shape is compatible with frontend expectations

## Technical Details

- **Affected Files**: packages/backend/src/routes/v2/circles.routes.ts, packages/backend/src/routes/v2/mentorship.routes.ts, packages/backend/src/routes/v2/collaboration.routes.ts, packages/backend/src/routes/v2/marketplace.routes.ts

## Acceptance Criteria

- [ ] All 4 community route files use `createApiResponse()` helper
- [ ] No hand-rolled `{ success: true, data }` remains in community routes
- [ ] Response shape verified compatible with frontend consumers
- [ ] Existing tests pass
