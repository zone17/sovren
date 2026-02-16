---
status: pending
priority: p1
issue_id: '149'
tags: [code-review, pr-82, phase-7, data-integrity, race-condition, concurrency]
dependencies: []
---

# Alert Status TOCTOU Race Condition

## Problem Statement

`AlertService.updateAlertStatus()` in `packages/backend/src/services/provenance/AlertService.ts` (lines 129-172) performs a read-then-write pattern without locking. Two concurrent requests can both read the same alert status and both attempt transitions, leading to invalid state machine violations (e.g., going from 'new' directly to 'resolved' skipping 'investigating').

## Findings

- Lines 129-140: Reads current alert status
- Lines 141-155: Validates transition is allowed
- Lines 156-172: Updates status
- No optimistic locking (version column) or `SELECT ... FOR UPDATE`
- Concurrent requests during the window between read and write can corrupt state
- State machine: new → investigating → resolved/dismissed. Race could skip states or create conflicting transitions
- Flagged by: data-integrity-guardian, pattern-recognition-specialist

## Proposed Solutions

### Option 1: Optimistic Locking with Version Column (Recommended)

**Approach:** Add `version` integer column to content_alerts. Read includes version, update uses `WHERE id = $id AND version = $version`. If 0 rows updated, retry (someone else modified it).
**Pros:** No database locks, scales well, standard pattern
**Cons:** Requires migration for version column
**Effort:** 1-2 hours
**Risk:** Low

### Option 2: Database-Level Constraint

**Approach:** Create a Postgres trigger that validates state transitions. Invalid transitions raise an exception.
**Pros:** Database-enforced, works regardless of application code
**Cons:** Business logic in database, harder to test and maintain
**Effort:** 2-3 hours
**Risk:** Medium

## Technical Details

**Affected files:**

- `packages/backend/src/services/provenance/AlertService.ts` lines 129-172
- New migration: add `version` column to `content_alerts` table

## Acceptance Criteria

- [ ] Concurrent status updates don't skip state machine steps
- [ ] Optimistic locking detects and handles conflicts
- [ ] Conflicting updates return appropriate error (409 Conflict)
- [ ] State machine transitions are enforced

## Resources

- **PR:** #82
- **Agents:** data-integrity-guardian, pattern-recognition-specialist

## Work Log

### 2026-02-14 - Discovery

**By:** Claude Code Review (8-agent synthesis)
**Actions:** Identified TOCTOU race during data integrity and pattern recognition review
