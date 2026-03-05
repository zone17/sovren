---
status: complete
priority: p3
issue_id: 676
tags: [code-review, slice-7, migration, rollback, database]
dependencies: []
---

## Problem Statement

The rollback section of the Slice 7 wellness schema migration omits `creator_boundaries` column drops and does not document which operations are non-reversible (e.g., backfill data loss).

## Findings

- **File**: `supabase/migrations/20260305000000_slice7_wellness_schema_gaps.sql:90-100`
- The migration adds columns to the `creator_boundaries` table (or creates it) and includes a backfill operation
- The rollback/down section at the bottom of the migration file does not include corresponding `DROP COLUMN` or `DROP TABLE` statements for `creator_boundaries` changes
- Non-reversible operations (data backfill) are not documented with WARNING comments explaining that rollback will lose backfilled data
- This is a documentation/operational gap — the existing pattern (common-solutions.md #12, todo #212, #251) expects rollback sections to be complete even if commented out

## Proposed Solutions

1. Add commented `DROP COLUMN` statements for each column added to `creator_boundaries`:
   ```sql
   -- ROLLBACK (manual):
   -- WARNING: Backfilled data in creator_boundaries will be lost and cannot be recovered.
   -- ALTER TABLE creator_boundaries DROP COLUMN IF EXISTS <column_1>;
   -- ALTER TABLE creator_boundaries DROP COLUMN IF EXISTS <column_2>;
   ```
2. Add `WARNING` comments for non-reversible operations:
   ```sql
   -- WARNING: The following backfill is non-reversible. Original NULL values cannot be restored.
   -- If rollback is needed, the columns will revert to their DEFAULT values, not the pre-migration state.
   ```
3. If the migration creates the entire table, the rollback should include `DROP TABLE IF EXISTS creator_boundaries CASCADE;`

## Recommended Action

## Technical Details

- Supabase migrations are forward-only in production, but rollback documentation serves as operational runbook for incidents
- The project convention (established in todo #212, #251, #293) is to include commented rollback SQL at the bottom of every migration file
- Non-reversible operations must be explicitly called out so operators know the implications before attempting rollback
- The `IF EXISTS` guard on DROP statements prevents errors if rollback is run against a database that never applied the migration

## Acceptance Criteria

- [ ] Rollback section includes commented `DROP COLUMN` (or `DROP TABLE`) statements for all `creator_boundaries` schema changes
- [ ] Non-reversible operations (backfill) have `WARNING` comments explaining data loss implications
- [ ] Rollback statements use `IF EXISTS` guards for idempotency
- [ ] Rollback section is consistent with the project's migration rollback convention

## Work Log

## Resources

- `supabase/migrations/20260305000000_slice7_wellness_schema_gaps.sql:90-100`
- Todo #212 (down migrations comments only)
- Todo #251 (down readme missing enum and trigger rollbacks)
- Todo #293 (migration idempotency gaps)
- common-solutions.md #12
