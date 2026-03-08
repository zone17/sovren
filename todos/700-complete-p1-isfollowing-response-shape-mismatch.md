---
status: pending
priority: p1
issue_id: '700'
tags: [code-review, frontend, backend, bug, slice-8]
dependencies: []
---

# isFollowing response shape mismatch breaks follow button

## Problem Statement

The backend and frontend disagree on the response shape for the follow status check. The backend returns `{ isFollowing: boolean }` but the frontend reads `res.following`. This means the follow button will ALWAYS show "Follow" even when the user is already following, because `res.following` is always `undefined`.

**Agent consensus: 2/9** (Architecture, TypeScript)

## Fix

Two files need alignment:

- Backend: `packages/backend/src/routes/v2/follow.routes.ts` returns `{ isFollowing: boolean }`
- Frontend: `packages/frontend/src/features/creator-network/hooks/useFollow.ts` reads `res.following`

Change the frontend to read `res.isFollowing` to match the backend response shape. Alternatively, update the backend to return `{ following: boolean }` — pick one and align both sides. Prefer `isFollowing` as it's more descriptive.
