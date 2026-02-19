---
status: complete
priority: p1
issue_id: 361
tags:
  - code-review
  - data-integrity
  - race-condition
dependencies: []
---

# Circle Join TOCTOU Race Condition on Member Count

## Problem Statement

Race condition exists between checking circle member count and inserting new membership. Two simultaneous join requests can both pass the capacity check and exceed max_members. This violates the creator's configured circle capacity and can cause billing or access issues for paid circles.

## Findings

**Source agents:** concurrency-review, data-integrity-review

**Evidence:**

- File: `packages/backend/src/services/community/CreatorCircleService.ts`
- Issue: Join flow performs a SELECT to count current members, compares against max_members, then INSERTs if under capacity. The gap between SELECT and INSERT allows concurrent requests to both see capacity available and both insert, exceeding the limit.

## Proposed Solutions

### Option A: Supabase RPC with row locking

- **Approach:** Create a Supabase RPC function that uses SELECT FOR UPDATE on the circle row, checks current member count within the transaction, and inserts the membership atomically. The row lock prevents concurrent joins from reading stale counts.
- **Effort:** Medium
- **Risk:** Low

### Option B: DB trigger with count constraint

- **Approach:** Add a database trigger on circle_members INSERT that checks the current count against max_members and raises an exception if exceeded. Migration 20260220300200 can include this trigger.
- **Effort:** Medium
- **Risk:** Low

## Recommended Action

_To be filled during triage_

## Technical Details

**Affected files:**

- `packages/backend/src/services/community/CreatorCircleService.ts`

## Acceptance Criteria

- [ ] Concurrent circle join requests cannot exceed max_members
- [ ] Single join request still succeeds when capacity is available
- [ ] Join request returns appropriate error (409 or 422) when circle is at capacity
- [ ] Load test with 10 concurrent joins against a circle with 1 remaining slot results in exactly 1 success and 9 rejections

## Work Log

| Date       | Action  | Notes                      |
| ---------- | ------- | -------------------------- |
| 2026-02-19 | Created | PR #86 code review finding |

## Resources

- PR: https://github.com/zone17/sovren/pull/86
