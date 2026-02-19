---
status: complete
priority: p1
issue_id: 305
tags: [code-review, database, migration]
---

# RPC column name mismatch — `revenue_share_bps` vs `revenue_split_bps`

## Problem Statement

The `update_revenue_split_atomic` RPC inserts into `revenue_share_bps` but the actual column is named `revenue_split_bps` (defined in migration 20260220100200 line 18). This will crash at runtime with a column-not-found error.

## Findings

- `supabase/migrations/20260220300100_fix_review_264_atomicity_rpc.sql` line 40 references `revenue_share_bps`
- `supabase/migrations/20260220100200` line 18 defines the column as `revenue_split_bps`
- Any call to the `update_revenue_split_atomic` RPC will fail with a PostgreSQL error

## Proposed Solutions

1. Change line 40 in the RPC migration from `revenue_share_bps` to `revenue_split_bps`:

```sql
-- Before
revenue_share_bps = p_bps
-- After
revenue_split_bps = p_bps
```

## Technical Details

- **Affected Files**: `supabase/migrations/20260220300100_fix_review_264_atomicity_rpc.sql`
- **Components**: `update_revenue_split_atomic` RPC function

## Acceptance Criteria

- [ ] RPC function references correct column name `revenue_split_bps`
- [ ] RPC can be called without column-not-found error
