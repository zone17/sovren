---
status: pending
priority: p1
issue_id: "682"
tags: [code-review, backend, security, slice-8]
dependencies: []
---

# Routes pass nostr_pubkey (hex) where UUID FK is required

## Problem Statement

Both `follow.routes.ts` and `notifications.routes.ts` pass `getAuthUser(req).nostr_pubkey` (64-char hex string) to services that use it as `user_id`/`follower_id` (UUID FK columns). PostgreSQL rejects the FK type mismatch at runtime. Every follow and notification operation fails.

**Agent consensus: 3/8** (Security, Pattern, Architecture)

## Findings

- `follow.routes.ts:54,81,108` — passes `nostr_pubkey` as `followerId`
- `notifications.routes.ts:66,91,119,149,174` — passes `nostr_pubkey` as `userId`
- `CommentsService` already solves this with `getUserIdByPubkey()` + TTLCache
- Self-follow guard `followerId === followingId` always false (hex vs UUID)

## Proposed Solutions

### Solution A: Add getUserIdByPubkey() to both services (Recommended)
- Copy the TTLCache pattern from `CommentsService` (lines 64-97)
- Resolve pubkey → UUID at start of each method
- **Effort:** Medium
- **Risk:** Low — proven pattern

### Solution B: Resolve at route layer
- Extract a shared `resolveUserIdFromPubkey()` helper
- Call before invoking service methods
- **Effort:** Medium
- **Risk:** Low — keeps services UUID-only

## Technical Details

**Affected files:**
- `packages/backend/src/routes/v2/follow.routes.ts` (lines 54, 81, 108)
- `packages/backend/src/routes/v2/notifications.routes.ts` (lines 66, 91, 119, 149, 174)
- `packages/backend/src/services/community/FollowService.ts` (add getUserIdByPubkey)
- `packages/backend/src/services/community/NotificationPersistenceService.ts` (add getUserIdByPubkey)

## Acceptance Criteria

- [ ] All service methods receive resolved UUIDs, not hex pubkeys
- [ ] Self-follow guard works correctly
- [ ] Notification queries return correct user's notifications
