---
status: pending
priority: p1
issue_id: '685'
tags: [code-review, backend, data-integrity, slice-8]
dependencies: []
---

# Notification entityId always NULL for new_follower events

## Problem Statement

In `NotificationPersistenceService.handleCommunityEvent`, the `COMMUNITY_USER_FOLLOWED` case reads `payload.followId` which does not exist on the event payload. The event emits `{ followerId, followingId }` with `aggregateId: data.id`. The `entityId` is always `undefined`/NULL, making it impossible to navigate from a notification to the follow relationship.

**Agent consensus: 4/8** (Data Integrity, TypeScript, Simplicity, Architecture)

## Findings

- `NotificationPersistenceService.ts:118` — `entityId: payload.followId as string | undefined`
- `FollowService.ts:74` — emits `payload: { followerId, followingId }` with `aggregateId: data.id`
- CommunityEventPayload type has `{ followerId, followingId }` — no `followId` property
- `@ts-nocheck` hid this bug

## Proposed Solutions

### Solution A: Use event.aggregateId (Recommended)

- Expand private method signature to include `aggregateId`
- Set `entityId: event.aggregateId` in the handler
- **Effort:** Small
- **Risk:** None

### Solution B: Add followId to event payload

- `FollowService.ts` adds `followId: data.id` to payload
- Handler destructures `followId` from payload
- **Effort:** Small
- **Risk:** None

## Acceptance Criteria

- [ ] `new_follower` notifications store the follow record UUID as `entity_id`
- [ ] Unit test verifies `entity_id` is not null for follow notifications
