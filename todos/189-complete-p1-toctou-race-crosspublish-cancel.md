---
status: pending
priority: p1
issue_id: "189"
tags: [code-review, pr-85, concurrency]
---

# TOCTOU Race Condition in CrossPublishProcessor Cancel Check

## Problem Statement
`CrossPublishProcessor.process()` updates the cross_post status to `'publishing'` THEN checks if the status is `'cancelled'`. The cancellation check always sees `'publishing'` (its own write), so a cancel request that arrives between pickup and publish is silently ignored. The cross_post publishes even though the user cancelled it.

## Findings
- **File**: `packages/backend/src/services/distribution/CrossPublishProcessor.ts`, lines 37-51
  - Line ~37-40: Status is updated to `'publishing'` unconditionally via `UPDATE cross_posts SET status = 'publishing' WHERE id = X`
  - Line ~45-51: Code checks `if (crossPost.status === 'cancelled') return` but `crossPost` now reflects the `'publishing'` status from the previous write
  - This is a classic Time-of-Check-Time-of-Use (TOCTOU) race condition
  - The cancel operation (from user action) writes `status = 'cancelled'` to the database, but the processor overwrites it with `'publishing'` before checking

## Proposed Solutions

### Solution 1: Conditional Update with Row Check (Recommended)
Replace the unconditional status update with a conditional one:
```sql
UPDATE cross_posts
SET status = 'publishing'
WHERE id = $1 AND status NOT IN ('cancelled', 'failed')
RETURNING id
```
If no rows are returned, the cross_post was cancelled (or failed) — skip processing.

**Pros**: Atomic, no race window, single query, idiomatic PostgreSQL
**Cons**: Requires checking the return value (minor code change)

### Solution 2: Check Before Update
Reverse the order: read the current status first, check for cancellation, then update to publishing. Use `SELECT ... FOR UPDATE` to lock the row during the check.

**Pros**: Explicit locking, clear intent
**Cons**: Heavier (row lock), still two queries, slightly more complex

## Acceptance Criteria
- [ ] Cancel check happens atomically with the status transition (no window where cancel can be overwritten)
- [ ] A cross_post cancelled while queued is never published
- [ ] A cross_post cancelled during the processing window between pickup and publish is not published
- [ ] Unit test: cancel a cross_post, then call process() — verify it is not published
- [ ] The fix does not introduce deadlocks or excessive row locking under concurrent processing
