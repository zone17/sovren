---
status: pending
priority: p1
issue_id: '148'
tags: [code-review, pr-82, phase-7, data-integrity, gdpr, transactions, security]
dependencies: []
---

# deleteAllWellnessData Not Atomic — GDPR Partial Deletion Risk

## Problem Statement

`WellnessService.deleteAllWellnessData()` in `packages/backend/src/services/wellness/WellnessService.ts` (lines 316-337) performs 5 sequential DELETE operations without a transaction. If any DELETE fails mid-way, the creator's data is partially deleted — violating GDPR "right to erasure" which requires complete deletion.

## Findings

- 5 sequential `supabase.from(table).delete()` calls with no transaction wrapper
- If delete #3 fails, tables 1-2 are deleted but 3-5 retain data
- No rollback mechanism — partial deletion is permanent and undetectable
- Creator has no way to know deletion was incomplete
- GDPR Article 17 requires complete erasure upon request
- Flagged by: data-integrity-guardian, security-sentinel

## Proposed Solutions

### Option 1: Wrap in Supabase RPC Transaction (Recommended)

**Approach:** Create a Postgres function `delete_all_wellness_data(creator_id)` that performs all 5 deletes in a single transaction. Call via `supabase.rpc('delete_all_wellness_data', { p_creator_id })`.
**Pros:** Atomic — all-or-nothing, GDPR compliant, database-enforced
**Cons:** Requires Supabase migration for the function
**Effort:** 1-2 hours
**Risk:** Low

### Option 2: Sequential with Compensating Rollback

**Approach:** Track which deletes succeeded, and if one fails, attempt to re-insert deleted data from a pre-deletion snapshot.
**Pros:** No migration needed
**Cons:** Complex, error-prone, snapshot storage needed, not truly atomic
**Effort:** 3-4 hours
**Risk:** High

## Technical Details

**Affected files:**

- `packages/backend/src/services/wellness/WellnessService.ts` lines 316-337
- New Supabase migration for `delete_all_wellness_data` RPC function

**Tables affected:**

- wellness_snapshots, creator_work_patterns, wellness_goals, scheduled_breaks, creator_boundaries

## Acceptance Criteria

- [ ] All 5 deletes run in a single transaction
- [ ] If any delete fails, ALL are rolled back
- [ ] Success returns confirmation of complete deletion
- [ ] Failure returns clear error (no partial state)

## Resources

- **PR:** #82
- **Agents:** data-integrity-guardian, security-sentinel

## Work Log

### 2026-02-14 - Discovery

**By:** Claude Code Review (8-agent synthesis)
**Actions:** Identified non-atomic multi-table deletion during data integrity review of PR #82
