---
status: pending
priority: p3
issue_id: "409"
tags: [code-review, quality, types, pr-87]
dependencies: []
---

# PromiseFulfilledResult<any> in useCollaboration hook

## Problem Statement

The `useCollaboration.ts` hook uses `PromiseFulfilledResult<any>` in its type guard filter after `Promise.allSettled()`. This introduces a new `any` type in frontend source code, which would be flagged by the anti-pattern scanner's check 1a.

## Findings

- `useCollaboration.ts:38`: `.filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')`
- The return type of `collaborationApi.inviteCollaborator()` should be used instead of `any`
- This is a minor type safety gap -- the `any` propagates through `.map(r => r.value)`

## Proposed Solutions

### Option 1: Type the PromiseFulfilledResult properly

**Approach:** Import or infer the return type of `inviteCollaborator` and use it: `PromiseFulfilledResult<CollaboratorInviteResult>` (or whatever the actual type is).

**Pros:**
- Full type safety
- No `any` in source

**Cons:**
- Need to look up the exact return type

**Effort:** 10 minutes

**Risk:** Low

## Recommended Action

Replace `any` with the actual return type of `inviteCollaborator`.

## Technical Details

**Affected files:**
- `packages/frontend/src/features/creator-network/hooks/useCollaboration.ts:38`

## Acceptance Criteria

- [ ] `PromiseFulfilledResult<any>` replaced with proper type
- [ ] Anti-pattern scanner check 1a does not flag this file

## Work Log

### 2026-02-20 - Code Review Discovery

**By:** Claude Code (PR #87 review)

## Resources

- **PR:** #87
