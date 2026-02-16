---
status: pending
priority: p1
issue_id: '151'
tags: [code-review, pr-82, phase-7, error-handling, observability, data-integrity]
dependencies: []
---

# BurnoutScoringService Silently Swallows Database Query Errors

## Problem Statement

`BurnoutScoringService` in `packages/backend/src/services/wellness/BurnoutScoringService.ts` catches all database query errors and returns fallback/default values instead of propagating errors. This masks real database failures as "no data yet" — the creator sees a healthy baseline score when their data is actually inaccessible.

## Findings

- Lines 60-63: `getWorkPatterns()` catch returns empty array
- Lines 90-103: `getWellnessSnapshots()` catch returns empty array
- Lines 125-130: `calculateScore()` catch returns default 50 (medium risk)
- A database outage looks identical to "new creator with no data"
- Burnout alerts based on this score would be wrong (false negatives)
- No logging of caught errors — failures are invisible to monitoring
- Flagged by: pattern-recognition-specialist, architecture-strategist

## Proposed Solutions

### Option 1: Propagate Errors with Structured Fallback (Recommended)

**Approach:** Let database errors propagate. Catch only at the controller/route level. Return 503 when database is unavailable instead of fake data. Add `logger.error()` in each catch block as a secondary safeguard.
**Pros:** Honest error reporting, monitoring visibility, correct user experience
**Cons:** Creator sees error page instead of (wrong) data
**Effort:** 1-2 hours
**Risk:** Low

### Option 2: Fallback with Error Flag

**Approach:** Return data with a `{ dataAvailable: false, reason: 'database_error' }` flag so the frontend can show "data unavailable" instead of fake scores.
**Pros:** Graceful degradation, frontend can differentiate states
**Cons:** More complex API contract
**Effort:** 2-3 hours
**Risk:** Low

## Technical Details

**Affected files:**

- `packages/backend/src/services/wellness/BurnoutScoringService.ts` lines 60-63, 90-103, 125-130

## Acceptance Criteria

- [ ] Database errors are logged (not silently caught)
- [ ] API returns appropriate error status (503) on DB failure
- [ ] Creator does not see fake "healthy" scores when DB is down
- [ ] Monitoring can detect database query failures

## Resources

- **PR:** #82
- **Agents:** pattern-recognition-specialist, architecture-strategist

## Work Log

### 2026-02-14 - Discovery

**By:** Claude Code Review (8-agent synthesis)
**Actions:** Identified silent error swallowing during pattern recognition review
