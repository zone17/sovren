---
status: pending
priority: p3
issue_id: '213'
tags: [code-review, pr-85, security]
---

# RLS FOR ALL Policies Missing WITH CHECK Clause

## Problem Statement

FOR ALL policies on all 5 tables lack WITH CHECK clause. INSERT operations could potentially set a different creator_id than the session user.

## Findings

- Files: All 5 `supabase/migrations/20260216200*_epic009_*.sql`
- RLS policies use `FOR ALL` with a `USING` clause but no `WITH CHECK` clause
- Without `WITH CHECK`, the `USING` clause applies to SELECT/UPDATE/DELETE but INSERT operations are not constrained to match the session user
- A user could potentially insert rows with a different `creator_id` than their own `auth.uid()`

## Proposed Solutions

1. Add `WITH CHECK (creator_id = auth.uid())` clause to each FOR ALL policy, matching the existing USING clause
2. Split FOR ALL policies into separate SELECT, INSERT, UPDATE, DELETE policies with appropriate checks for each operation

## Acceptance Criteria

- [ ] All FOR ALL RLS policies include a WITH CHECK clause that prevents users from setting creator_id to a value other than their own auth.uid()
- [ ] INSERT operations are verified to reject rows where creator_id does not match the session user
- [ ] Existing SELECT/UPDATE/DELETE behavior is unchanged
