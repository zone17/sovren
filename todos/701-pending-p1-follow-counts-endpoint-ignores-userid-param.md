---
status: pending
priority: p1
issue_id: '701'
tags: [code-review, backend, bug, slice-8]
dependencies: []
---

# follow-counts endpoint ignores :userId param

## Problem Statement

The `/follow-counts` route defines a `:userId` URL parameter but the handler always uses `req.user.id` (the authenticated user's ID) instead. The frontend calls `followApi.getFollowCounts(userId)` expecting to get the target user's follower/following counts, but always receives the authenticated user's counts instead.

**Agent consensus: 4/9** (Architecture, Pattern, Data Integrity, Agent-Native)

## Fix

In `packages/backend/src/routes/v2/follow.routes.ts`, update the `/follow-counts/:userId` handler to use `req.params.userId` instead of `req.user.id`. Add validation that `userId` is a valid UUID or pubkey format before querying.
