---
status: complete
priority: p1
issue_id: 362
tags:
  - code-review
  - data-integrity
  - race-condition
dependencies: []
---

# Mentorship Acceptance TOCTOU Race Condition on Capacity

## Problem Statement

Race condition exists between checking a mentor's current mentee count and accepting a new mentorship request. Concurrent acceptances can exceed the mentor's max_mentees setting. This can overcommit a mentor's time and violate their configured availability limits.

## Findings

**Source agents:** concurrency-review, data-integrity-review

**Evidence:**

- File: `packages/backend/src/services/community/MentorshipService.ts`
- Issue: Accept mentorship flow reads the current count of active mentees, compares against max_mentees, then updates the mentorship request to 'accepted'. Concurrent acceptances both see capacity available and both succeed, exceeding the limit. Same TOCTOU pattern as the circle join race (issue #361).

## Proposed Solutions

### Option A: Supabase RPC with row locking

- **Approach:** Create a Supabase RPC function that uses SELECT FOR UPDATE on the mentor's profile row, counts active mentees within the transaction, and updates the mentorship status atomically. Similar pattern to circle join TOCTOU fix.
- **Effort:** Medium
- **Risk:** Low

### Option B: DB-level count constraint

- **Approach:** Add a database trigger on mentorship status updates that checks the count of active mentees against max_mentees and raises an exception if exceeded.
- **Effort:** Medium
- **Risk:** Low

## Recommended Action

_To be filled during triage_

## Technical Details

**Affected files:**

- `packages/backend/src/services/community/MentorshipService.ts`

## Acceptance Criteria

- [ ] Concurrent mentorship acceptances cannot exceed max_mentees
- [ ] Single acceptance still succeeds when mentor has capacity
- [ ] Acceptance returns appropriate error (409 or 422) when mentor is at capacity
- [ ] Load test with 10 concurrent acceptances against a mentor with 1 remaining slot results in exactly 1 success and 9 rejections

## Work Log

| Date       | Action  | Notes                      |
| ---------- | ------- | -------------------------- |
| 2026-02-19 | Created | PR #86 code review finding |

## Resources

- PR: https://github.com/zone17/sovren/pull/86
