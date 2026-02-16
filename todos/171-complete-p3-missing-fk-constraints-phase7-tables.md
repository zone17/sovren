---
status: pending
priority: p3
issue_id: "171"
tags: [code-review, pr-82, phase-7, database, referential-integrity, schema]
dependencies: []
---

# Missing Foreign Key Constraints on Phase 7 Tables

## Problem Statement
Phase 7 database schema references creator_id across 7 tables but some lack explicit FK constraints to the users/creators table.

## Findings
- Schema design doc shows creator_id columns but not all have FK constraints
- Orphaned records possible if creator account is deleted
- Missing CASCADE or SET NULL on delete
- Flagged by: data-integrity-guardian

## Proposed Solutions
### Option 1: Add FK Constraints with CASCADE
**Approach:** Add `REFERENCES creators(id) ON DELETE CASCADE` to all creator_id columns.
**Effort:** 1 hour (migration) | **Risk:** Low

## Technical Details
- Tables: wellness_snapshots, creator_work_patterns, wellness_goals, scheduled_breaks, creator_boundaries, content_fingerprints, provenance_records

## Acceptance Criteria
- [ ] All creator_id columns have FK constraints
- [ ] Cascade delete configured appropriately
- [ ] No orphaned records possible

## Work Log
### 2026-02-14 - Discovery
**By:** Claude Code Review
Tags: database, referential-integrity, schema
