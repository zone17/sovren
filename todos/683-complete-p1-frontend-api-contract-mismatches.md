---
status: pending
priority: p1
issue_id: '683'
tags: [code-review, frontend, backend, api, slice-8]
dependencies: []
---

# Frontend-backend API contract mismatches (5 broken endpoints)

## Problem Statement

Multiple frontend API methods call wrong URLs, use wrong HTTP methods, or call non-existent routes. Every affected operation silently fails with 404/405.

**Agent consensus: 5-6/8** per finding

## Findings

### 1. `followApi.isFollowing()` calls wrong URL (4/8 agents)

- **File:** `followApi.ts:23`
- Calls `GET /${userId}/follow` — no GET handler exists
- Should call `GET /${userId}/follow-status`

### 2. Missing `GET /follow-counts` route (6/8 agents)

- **File:** `follow.routes.ts` — no route defined
- `followApi.getFollowCounts()` at line 41 calls non-existent endpoint
- `IFollowService.getFollowCounts()` is implemented but never wired to HTTP

### 3. `notificationsApi.markRead()` wrong method + URL (5/8 agents)

- **File:** `notificationsApi.ts:19`
- Calls `apiClient.put(${BASE}/${id}/read)` — PUT to wrong path
- Backend expects `PATCH /${id}` with body `{ read: true }`
- `apiClient` may not have a `patch` method

### 4. Missing `notificationsApi.getUnreadCount()` (3/8 agents)

- Backend `GET /unread-count` exists but frontend never calls it

### 5. Missing `notificationsApi.delete()` (3/8 agents)

- Backend `DELETE /:id` exists but frontend has no method

### 6. Response field mismatch on follow-status (1/8 agents)

- Backend returns `{ isFollowing: boolean }`, frontend expects `{ following: boolean }`

## Proposed Solutions

### Fix all 6 issues in a single pass

1. Fix `followApi.isFollowing()` URL → `/follow-status`
2. Add `GET /follow-counts` route to `follow.routes.ts`
3. Fix `notificationsApi.markRead()` → use correct method + URL
4. Add `notificationsApi.getUnreadCount()` method
5. Add `notificationsApi.delete()` method
6. Align response field name or frontend selector

**Effort:** Small-Medium
**Risk:** Low — straightforward fixes

## Technical Details

**Affected files:**

- `packages/frontend/src/features/creator-network/services/followApi.ts`
- `packages/frontend/src/features/notifications/services/notificationsApi.ts`
- `packages/backend/src/routes/v2/follow.routes.ts` (add follow-counts route)
- Potentially `packages/frontend/src/services/api/apiClient.ts` (add PATCH method)

## Acceptance Criteria

- [ ] `followApi.isFollowing()` calls correct `/follow-status` URL
- [ ] `GET /follow-counts` route exists and returns correct data
- [ ] `notificationsApi.markRead()` uses correct HTTP method and URL
- [ ] `notificationsApi.getUnreadCount()` exists and calls `/unread-count`
- [ ] `notificationsApi.delete()` exists and calls `DELETE /:id`
- [ ] Response field names align between frontend and backend
