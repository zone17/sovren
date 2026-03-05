---
status: pending
priority: p2
issue_id: '627'
tags: [code-review, database, migration, data-integrity]
dependencies: []
---

# Reply count trigger missing DELETE handler and status restoration

## Problem Statement

The `update_reply_count()` trigger in `supabase/migrations/20260304000001_comments_supplementary.sql` only handles INSERT and UPDATE of `parent_comment_id`. It does not handle:

1. Hard DELETE of a reply (reply_count would not decrement)
2. Status restoration (a reply changing from 'deleted' back to 'active' would not increment reply_count)

## Findings

- Security Sentinel and Data Integrity Guardian both flagged
- Current trigger: AFTER INSERT OR UPDATE on comments
- Missing: AFTER DELETE case, and bidirectional status transition handling

## Proposed Solutions

### Option A: Add DELETE handler and bidirectional status logic (Recommended)

Extend trigger to handle DELETE (decrement) and both directions of status changes.

- Pros: Correct reply counts in all scenarios
- Cons: More complex trigger
- Effort: Medium

## Acceptance Criteria

- [ ] reply_count decrements on hard DELETE of a reply
- [ ] reply_count handles bidirectional status transitions (active<->deleted)
- [ ] Trigger fires on INSERT, UPDATE, and DELETE
