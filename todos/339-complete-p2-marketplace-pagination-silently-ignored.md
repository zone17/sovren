---
status: pending
priority: p2
issue_id: 339
tags: [code-review, api, performance]
---

# Marketplace pagination silently ignored by backend

## Problem Statement

The frontend sends pagination parameters (page/limit) to the marketplace listings endpoint, and the UI renders pagination controls, but the backend ignores these parameters and returns all results. This means users see pagination controls that do nothing, and the backend sends unnecessarily large payloads.

## Findings

- `packages/backend/src/routes/v2/marketplace.routes.ts:153-172` — handler receives page/limit from query params but does not pass them to the service layer
- Frontend sends pagination parameters and renders pagination UI
- Backend returns all listings regardless of page/limit values

## Proposed Solutions

1. Extract `page` and `limit` from query parameters in the route handler
2. Pass pagination parameters to the MarketplaceService method
3. Apply `.range()` or `.limit()` + offset in the Supabase query
4. Return total count in response for frontend pagination calculation
5. Default to `limit=20, page=1` if not provided

## Technical Details

- **Affected Files**: packages/backend/src/routes/v2/marketplace.routes.ts, packages/backend/src/services/community/MarketplaceService.ts

## Acceptance Criteria

- [ ] Backend reads page/limit query parameters
- [ ] Service applies pagination to Supabase query
- [ ] Response includes total count for pagination calculation
- [ ] Default pagination applied when parameters not provided
- [ ] Frontend pagination controls work correctly end-to-end
