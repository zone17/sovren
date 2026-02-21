---
status: complete
priority: p1
issue_id: 306
tags: [code-review, database, migration]
---

# RPC type mismatch — `p_content_id TEXT` should be `UUID`

## Problem Statement

Both `update_revenue_split_atomic` and `record_revenue_split_ledger_atomic` declare `p_content_id TEXT` but the target columns are UUID type. Comparison and insert operations will fail due to type mismatch.

## Findings

- `supabase/migrations/20260220300100_fix_review_264_atomicity_rpc.sql` line 32: `update_revenue_split_atomic` declares `p_content_id TEXT`
- `supabase/migrations/20260220300100_fix_review_264_atomicity_rpc.sql` line 54: `record_revenue_split_ledger_atomic` declares `p_content_id TEXT`
- Target columns in both referenced tables are `UUID` type
- Calls to either RPC with a UUID value will fail on type comparison/insert

## Proposed Solutions

1. Change parameter type from `TEXT` to `UUID` in both functions:

```sql
-- Before
CREATE OR REPLACE FUNCTION update_revenue_split_atomic(
  p_content_id TEXT,
  ...

-- After
CREATE OR REPLACE FUNCTION update_revenue_split_atomic(
  p_content_id UUID,
  ...
```

Apply the same change to `record_revenue_split_ledger_atomic`.

## Technical Details

- **Affected Files**: `supabase/migrations/20260220300100_fix_review_264_atomicity_rpc.sql`
- **Components**: `update_revenue_split_atomic`, `record_revenue_split_ledger_atomic` RPC functions

## Acceptance Criteria

- [ ] Both RPC functions use `UUID` parameter type for `p_content_id`
- [ ] RPCs can be called with UUID content IDs without type errors
