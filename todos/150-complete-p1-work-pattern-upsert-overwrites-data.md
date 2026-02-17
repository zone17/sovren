---
status: pending
priority: p1
issue_id: '150'
tags: [code-review, pr-82, phase-7, data-integrity, data-loss, wellness]
dependencies: []
---

# Work Pattern Upsert Overwrites Instead of Accumulating

## Problem Statement

`WellnessService.trackWorkPattern()` in `packages/backend/src/services/wellness/WellnessService.ts` (lines 36-72) uses an upsert that replaces existing work pattern data instead of accumulating it. When a creator logs a second work session on the same day, the first session's data is silently lost.

## Findings

- Upsert logic replaces the entire row on conflict (same creator_id + date)
- Session duration, energy level, and focus metrics from earlier sessions are lost
- Creator sees only their latest session, not accumulated daily totals
- Burnout scoring algorithm depends on accumulated patterns — single-session data gives wrong scores
- No audit trail of individual sessions within a day
- Flagged by: data-integrity-guardian, pattern-recognition-specialist

## Proposed Solutions

### Option 1: Accumulate on Conflict (Recommended)

**Approach:** Change upsert to `ON CONFLICT DO UPDATE SET duration = existing.duration + new.duration, session_count = existing.session_count + 1, ...` to accumulate daily totals.
**Pros:** Preserves all data, simple SQL change, fixes burnout scoring
**Cons:** Individual session details not preserved (only totals)
**Effort:** 1 hour
**Risk:** Low

### Option 2: Separate Session Records

**Approach:** Remove the unique constraint on (creator_id, date). Store each session as a separate row. Aggregate at query time.
**Pros:** Full session-level detail preserved
**Cons:** More complex queries, schema change needed
**Effort:** 2-3 hours
**Risk:** Medium

## Technical Details

**Affected files:**

- `packages/backend/src/services/wellness/WellnessService.ts` lines 36-72

## Acceptance Criteria

- [ ] Multiple work sessions per day accumulate (not overwrite)
- [ ] Daily totals reflect all sessions
- [ ] Burnout scoring receives accumulated data
- [ ] Existing data is not corrupted by the fix

## Resources

- **PR:** #82
- **Agents:** data-integrity-guardian, pattern-recognition-specialist

## Work Log

### 2026-02-14 - Discovery

**By:** Claude Code Review (8-agent synthesis)
**Actions:** Identified data loss pattern during data integrity review
