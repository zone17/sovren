---
status: complete
priority: p1
issue_id: 307
tags: [code-review, security, database]
---

# SECURITY DEFINER RPCs missing search_path + REVOKE/GRANT + auth check

## Problem Statement

Three SECURITY DEFINER functions (`create_circle_atomic`, `update_revenue_split_atomic`, `record_revenue_split_ledger_atomic`) are missing critical security hardening: no `SET search_path`, no REVOKE/GRANT, and no auth.uid() verification. This allows search_path injection, anonymous invocation, and impersonation.

## Findings

- `supabase/migrations/20260220300100_fix_review_264_atomicity_rpc.sql` lines 7-76 defines all three functions
- None of the three functions set `search_path = ''` — allows search_path injection attack
- None have `REVOKE ALL FROM PUBLIC` / `GRANT TO authenticated` — callable by anonymous/anon role
- `create_circle_atomic` accepts `p_created_by` without verifying `auth.uid()` match — impersonation risk
- The project's own `get_user_circle_ids` (migration `20260220100000` line 43) correctly implements all three protections, providing a reference pattern

## Proposed Solutions

1. Add `SET search_path = ''` to each function definition:

```sql
CREATE OR REPLACE FUNCTION create_circle_atomic(...)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
```

2. Add REVOKE/GRANT after each function:

```sql
REVOKE ALL ON FUNCTION create_circle_atomic(...) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_circle_atomic(...) TO authenticated;
```

3. Add auth check in `create_circle_atomic`:

```sql
IF p_created_by != auth.uid() THEN
  RAISE EXCEPTION 'Cannot create circle for another user';
END IF;
```

## Technical Details

- **Affected Files**: `supabase/migrations/20260220300100_fix_review_264_atomicity_rpc.sql`
- **Components**: `create_circle_atomic`, `update_revenue_split_atomic`, `record_revenue_split_ledger_atomic`

## Acceptance Criteria

- [ ] All 3 RPCs have `SET search_path = ''`
- [ ] All 3 RPCs have `REVOKE ALL FROM PUBLIC` and `GRANT EXECUTE TO authenticated`
- [ ] `create_circle_atomic` validates `p_created_by = auth.uid()`
