---
status: pending
priority: p2
issue_id: "156"
tags: [code-review, pr-82, phase-7, security, rls, data-privacy]
dependencies: []
---

# RLS Policy Exposes All Creator Boundaries Columns

## Problem Statement
The `creator_boundaries` table has `SELECT USING (TRUE)` RLS policy, meaning any authenticated user can read ANY creator's boundary settings including auto_response_template (personal messages), boundary_type, and active schedule.

## Findings
- Phase 7 database schema: `creator_boundaries` table RLS has `SELECT USING (TRUE)`
- Should be `SELECT USING (creator_id = auth.uid())`
- Other wellness tables correctly restrict reads to owner
- Boundary settings contain PII: auto-response messages, schedule patterns, contact preferences
- Flagged by: data-integrity-guardian, security-sentinel

## Proposed Solutions
### Option 1: Fix RLS Policy (Recommended)
**Approach:** Update RLS policy to `SELECT USING (creator_id = auth.uid())`. Only the creator can read their own boundaries.
**Pros:** Consistent with other tables, immediate fix
**Cons:** If public boundary display is needed later, a separate view would be required
**Effort:** 30 minutes
**Risk:** Low

## Technical Details
- `packages/backend/src/services/wellness/` (database schema)
- Supabase migration needed for RLS policy change

## Acceptance Criteria
- [ ] RLS policy restricts SELECT to owner only
- [ ] Other users cannot read creator boundary settings
- [ ] Creator can still read their own boundaries

## Resources
- **PR:** #82
- **Agents:** data-integrity-guardian, security-sentinel

## Work Log
### 2026-02-14 - Discovery
**By:** Claude Code Review
Tags: security, rls, data-privacy
