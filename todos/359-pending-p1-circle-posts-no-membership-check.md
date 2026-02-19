---
status: pending
priority: p1
issue_id: 359
tags:
  - code-review
  - security
  - authorization
dependencies: []
---

# Circle Posts Endpoint Missing Membership Check

## Problem Statement

The circle posts endpoint (GET /circles/:id/posts) does not verify the requesting user is a member of the circle. Anyone with a valid auth token can read private circle content. This is a direct authorization bypass that exposes content intended to be restricted to paying or approved members.

## Findings

**Source agents:** security-audit, authorization-review

**Evidence:**

- File: `packages/backend/src/routes/v2/circles.routes.ts`
- Issue: GET /circles/:id/posts route handler calls service method without membership verification
- File: `packages/backend/src/services/community/CreatorCircleService.ts`
- Issue: getPosts() or equivalent method does not check circle_members table for requesting user's membership status before returning posts

## Proposed Solutions

### Option A: Middleware-level membership guard

- **Approach:** Create a `requireCircleMembership` middleware that queries circle_members for the authenticated user and circle ID before the route handler executes. Attach to all circle-scoped endpoints.
- **Effort:** Small
- **Risk:** Low

### Option B: Service-level membership check

- **Approach:** Add membership verification inside CreatorCircleService.getPosts() before querying posts. Query circle_members for user's membership, return 403 if not found.
- **Effort:** Small
- **Risk:** Low

## Recommended Action

_To be filled during triage_

## Technical Details

**Affected files:**

- `packages/backend/src/routes/v2/circles.routes.ts`
- `packages/backend/src/services/community/CreatorCircleService.ts`

## Acceptance Criteria

- [ ] GET /circles/:id/posts returns 403 for authenticated users who are not members of the circle
- [ ] GET /circles/:id/posts returns posts normally for authenticated circle members
- [ ] Circle creators can always access their own circle's posts
- [ ] Integration test covers non-member access attempt returning 403

## Work Log

| Date       | Action  | Notes                      |
| ---------- | ------- | -------------------------- |
| 2026-02-19 | Created | PR #86 code review finding |

## Resources

- PR: https://github.com/zone17/sovren/pull/86
