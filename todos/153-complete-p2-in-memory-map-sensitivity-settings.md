---
status: pending
priority: p2
issue_id: "153"
tags: [code-review, pr-82, phase-7, data-persistence, in-memory, data-loss]
dependencies: []
---

# In-Memory Map for Sensitivity Settings Loses Data on Restart

## Problem Statement
`BurnoutScoringService` stores sensitivity settings in a `Map<string, SensitivityLevel>` (line 51 of `BurnoutScoringService.ts`). This data is lost on every server restart, meaning creators must reconfigure their sensitivity preferences after each deployment.

## Findings
- `packages/backend/src/services/wellness/BurnoutScoringService.ts` line 51: `private sensitivitySettings = new Map<string, SensitivityLevel>()`
- No persistence to database or cache
- Lost on restart, deployment, or crash
- Flagged by 4+ agents: security-sentinel, performance-oracle, data-integrity-guardian, pattern-recognition-specialist
- ADR-019 noted this as "accepted risk for MVP" but flagged for production

## Proposed Solutions
### Option 1: Persist to Database (Recommended)
**Approach:** Add `creator_sensitivity_settings` table or column on existing wellness table. Read on first access, cache in memory with TTL.
**Pros:** Survives restarts, standard persistence pattern
**Cons:** Requires migration
**Effort:** 2-3 hours
**Risk:** Low

### Option 2: Persist to Supabase KV / JSON Column
**Approach:** Store as JSON in existing creator profile or wellness_preferences table.
**Pros:** No new table needed
**Cons:** Less queryable, JSON column management
**Effort:** 1-2 hours
**Risk:** Low

## Technical Details
- `packages/backend/src/services/wellness/BurnoutScoringService.ts` line 51

## Acceptance Criteria
- [ ] Sensitivity settings persist across restarts
- [ ] Settings load on first access with reasonable performance
- [ ] Default sensitivity used when no setting exists

## Resources
- **PR:** #82, ADR-019
- **Agents:** security-sentinel, performance-oracle, data-integrity-guardian, pattern-recognition-specialist

## Work Log
### 2026-02-14 - Discovery
**By:** Claude Code Review
Tags: data-persistence, in-memory, data-loss
