---
status: pending
priority: p1
issue_id: "190"
tags: [code-review, pr-85, api-completeness]
---

# Missing Cancel Cross-Post API Route

## Problem Statement
`CrossPostService` has cancel logic but no route exposes it. The frontend cannot cancel a scheduled or queued cross-post. For an agent-native platform: any action a user can take, an agent must also be able to take via API. Without this route, neither users nor agents can cancel a pending cross-post, making scheduled publishing irreversible.

## Findings
- **File**: `packages/backend/src/routes/v2/distribute.routes.ts`
  - No `DELETE /api/v2/distribute/:crossPostId` route exists
  - No `POST /api/v2/distribute/:crossPostId/cancel` route exists
  - Only create/list routes are defined for cross-posts
- **File**: `packages/backend/src/services/distribution/CrossPostService.ts`
  - Contains cancel method that updates cross_post status to `'cancelled'`
  - This method is unreachable from any HTTP endpoint
  - The service logic exists but is dead code from an API perspective

## Proposed Solutions

### Solution 1: Add POST /:crossPostId/cancel Route (Recommended)
Add a new route `POST /api/v2/distribute/:crossPostId/cancel` with:
1. `authenticate` middleware (verify JWT/session)
2. `requireCreator` middleware (verify the requesting user owns the cross_post)
3. Validate crossPostId parameter
4. Call `CrossPostService.cancel(crossPostId, creatorId)`
5. Return 200 with cancelled cross_post, or 404 if not found, or 409 if already published

**Pros**: RESTful, clear intent, follows existing route patterns
**Cons**: Adds a new endpoint to document and test

### Solution 2: Add DELETE /:crossPostId Route
Use `DELETE /api/v2/distribute/:crossPostId` following REST conventions for resource removal.

**Pros**: Standard REST semantics
**Cons**: DELETE implies permanent removal; cancellation is a state change, not deletion. Could be confused with hard-delete.

## Acceptance Criteria
- [ ] A route exists to cancel a queued or scheduled cross_post
- [ ] Route requires authentication and verifies the caller owns the cross_post
- [ ] Cancelling an already-published cross_post returns appropriate error (409 Conflict)
- [ ] Cancelling a non-existent cross_post returns 404
- [ ] Frontend can call the cancel endpoint successfully
- [ ] API documentation or OpenAPI spec is updated to include the new route
- [ ] Integration test covers cancel of queued, scheduled, published, and non-existent cross_posts
