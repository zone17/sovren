---
status: pending
priority: p2
issue_id: '119'
tags:
  - code-review
  - agent-native
  - api
  - user
dependencies: []
---

# 119: User Relationship API 87% Missing — 13 of 15 Operations Not Exposed

## Problem Statement

`UserRelationshipService` has 15+ public methods but only `followUser` and `unfollowUser` are exposed via v1 API routes at `/packages/backend/src/routes/v1/user.routes.ts` (lines 72-87). Missing: block, unblock, mute, unmute, getFollowers, getFollowing, getBlockedUsers, getRelationshipStats, sendFriendRequest, respondToFriendRequest, getRecommendations, exportRelationships, importFollows, updatePrivacySettings. A `GetRelationshipsSchema` validator exists at `/packages/backend/src/validators/user/index.ts` (lines 138-142) but no route uses it.

## Findings

87% of UserRelationshipService functionality is inaccessible via API. Only 2 of 15 operations exposed. Validators exist without corresponding routes.

## Proposed Solutions

1. **Option A**: Add all missing endpoints to user.routes.ts. Effort: Medium, Risk: Low.
2. **Option B**: Prioritize safety-critical ones (block, mute, followers/following) first. Effort: Small, Risk: Low.

## Acceptance Criteria

- [ ] All UserRelationshipService methods accessible via v1 API
- [ ] Validators wired to routes
- [ ] Integration tests for new endpoints

## Work Log

| Date       | Action                                      | Learnings                                                                           |
| ---------- | ------------------------------------------- | ----------------------------------------------------------------------------------- |
| 2026-02-14 | Identified in code review round 6 of PR #73 | Large service with minimal API exposure indicates incomplete feature implementation |
