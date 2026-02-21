---
status: pending
priority: p2
issue_id: 373
tags:
  - code-review
  - frontend
  - race-condition
dependencies: []
---

# Frontend Sequential Invite Loop in CollaborativeContentService

## Problem Statement

CollaborativeContentService invite flow sends invites in a for-loop without proper sequencing. Multiple concurrent mutations can interfere with React Query cache, causing stale UI state or lost updates.

## Findings

**Source agents:** frontend-agent, race-condition-agent, code-review-agent

**Evidence:**

- File: `packages/frontend/src/features/creator-network/hooks/useCollaboration.ts`
- Issue: Invite loop fires mutations without awaiting or batching, causing concurrent React Query cache mutations that can interfere with each other.

## Proposed Solutions

### Option A: Parallel invites with Promise.all()

- **Approach:** Use `Promise.all()` to send all invites in parallel with a single loading state. Invalidate the query cache once after all invites complete.
- **Effort:** Small
- **Risk:** Low

### Option B: Sequential await with progress

- **Approach:** Await each invite sequentially with a progress indicator showing "Sending invite 3 of 5..."
- **Effort:** Small
- **Risk:** Low

## Recommended Action

_To be filled during triage_

## Technical Details

**Affected files:**

- `packages/frontend/src/features/creator-network/hooks/useCollaboration.ts`

## Acceptance Criteria

- [ ] Invites are sent either fully parallel (Promise.all) or properly sequential (await each)
- [ ] Loading state is shown during the entire batch operation
- [ ] React Query cache is invalidated once after all invites complete, not per-invite

## Work Log

| Date       | Action  | Notes                      |
| ---------- | ------- | -------------------------- |
| 2026-02-19 | Created | PR #86 code review finding |

## Resources

- PR: https://github.com/zone17/sovren/pull/86
