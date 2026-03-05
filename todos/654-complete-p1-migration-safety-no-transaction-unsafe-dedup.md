---
status: complete
priority: p1
issue_id: 654
tags: [code-review, migration, p1, data-integrity]
dependencies: []
---

## Problem Statement

The Slice 7 wellness schema gap migration (`20260305000000_slice7_wellness_schema_gaps.sql`) has four critical safety issues: no transaction wrapper, O(n^2) non-deterministic dedup logic, missing burnout_risk_history dedup before UNIQUE constraint, and missing NOT NULL on the week column. A partial failure leaves the database in an inconsistent state with no rollback path.

## Findings

**Consensus**: 6/8 agents (data-migration-expert, data-integrity-guardian, deployment-verification, performance-oracle, data-migration-expert, data-integrity-guardian)

**File**: `supabase/migrations/20260305000000_slice7_wellness_schema_gaps.sql`

1. **No BEGIN/COMMIT wrapper** — If the migration fails partway through (e.g., after dedup DELETE but before UNIQUE constraint), the database is left in an inconsistent intermediate state. Supabase migrations run each file as a single transaction only if the SQL is wrapped explicitly; otherwise, each statement executes independently.

2. **Dedup DELETE uses NOT IN** — The current dedup approach (`DELETE FROM table WHERE id NOT IN (SELECT MIN(id) ...)`) is O(n^2) on large tables and non-deterministic when rows have identical timestamps. The subquery picks `MIN(id)` which is arbitrary when multiple rows tie on the dedup key.

3. **No dedup on burnout_risk_history** — The migration adds a UNIQUE constraint to burnout_risk_history but does not first remove duplicate rows. Rows with NULL in the `week` column bypass the UNIQUE constraint entirely (NULL != NULL in SQL), so duplicates persist silently. The constraint creation will fail if non-NULL duplicates exist.

4. **No NOT NULL on week column** — Without `ALTER COLUMN week SET NOT NULL`, rows can continue to be inserted with NULL week values, which bypass the UNIQUE constraint and break upsert logic that relies on conflict detection.

## Proposed Solutions

### Option A: CTE-Based Atomic Migration (Recommended)

Rewrite the entire migration inside BEGIN/COMMIT with CTE + ROW_NUMBER for deterministic dedup.

```sql
BEGIN;

-- 1. Dedup wellness_pulses deterministically
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY creator_id, DATE(created_at)
    ORDER BY created_at DESC, id DESC
  ) AS rn
  FROM wellness_pulses
)
DELETE FROM wellness_pulses WHERE id IN (
  SELECT id FROM ranked WHERE rn > 1
);

-- 2. Dedup burnout_risk_history deterministically
-- First delete NULL-week rows (they bypass UNIQUE)
DELETE FROM burnout_risk_history WHERE week IS NULL;

WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY creator_id, week
    ORDER BY calculated_at DESC, id DESC
  ) AS rn
  FROM burnout_risk_history
)
DELETE FROM burnout_risk_history WHERE id IN (
  SELECT id FROM ranked WHERE rn > 1
);

-- 3. Add NOT NULL constraint on week
ALTER TABLE burnout_risk_history ALTER COLUMN week SET NOT NULL;

-- 4. Add UNIQUE constraints
ALTER TABLE wellness_pulses ADD CONSTRAINT uq_wellness_pulses_creator_day
  UNIQUE (creator_id, DATE(created_at));

ALTER TABLE burnout_risk_history ADD CONSTRAINT uq_burnout_risk_creator_week
  UNIQUE (creator_id, week);

COMMIT;
```

- **Pros**: Fully atomic, deterministic (keeps latest row by timestamp then ID), handles NULL week rows, prevents future NULLs.
- **Cons**: Slightly more complex SQL. CTE + ROW_NUMBER requires understanding of window functions.
- **Effort**: Small (1-2 hours)
- **Risk**: Low — standard PostgreSQL patterns. Test on staging with production-like data volume.

### Option B: Two-Phase Migration (Safe but Slower)

Split into two migrations: first dedup + NOT NULL, then add UNIQUE constraints in a second migration.

- **Pros**: Each migration is simpler. If dedup is wrong, constraints migration catches it.
- **Cons**: Two files to manage. Window between migrations where duplicates could be re-inserted.
- **Effort**: Small (1-2 hours)
- **Risk**: Low-Medium — gap between migrations allows new duplicates.

### Option C: Application-Level Dedup + Migration Constraint Only

Skip SQL dedup entirely. Add UNIQUE constraint with `IF NOT EXISTS` and let it fail if duplicates exist, then handle dedup in application code.

- **Pros**: No complex SQL.
- **Cons**: Violates infrastructure-as-code principle. Migration becomes non-deterministic. Application dedup is harder to verify.
- **Effort**: Medium (3-4 hours)
- **Risk**: High — migration may fail in production, requiring manual intervention.

## Recommended Action

<!-- To be filled by tech lead -->

## Technical Details

- **PostgreSQL ROW_NUMBER()** is deterministic when the ORDER BY clause includes a unique tiebreaker (e.g., `id DESC`).
- **NOT IN with NULLs** is a known PostgreSQL footgun: if the subquery returns any NULL, `NOT IN` evaluates to NULL (not FALSE), potentially deleting all rows. The CTE approach avoids this entirely.
- **Supabase migrations** do NOT auto-wrap in transactions. Each statement runs independently unless explicitly wrapped in BEGIN/COMMIT.
- **NULL and UNIQUE constraints**: PostgreSQL treats NULLs as distinct in UNIQUE constraints, so `(creator_id, NULL)` can appear unlimited times. This is why NOT NULL must be set before the UNIQUE constraint.
- The `DATE(created_at)` in the UNIQUE constraint for wellness_pulses requires a functional index or expression index — verify Supabase supports this syntax or use a generated column.

## Acceptance Criteria

- [ ] Migration is wrapped in BEGIN/COMMIT (atomic)
- [ ] Dedup uses CTE + ROW_NUMBER with deterministic ordering (tiebreaker on id)
- [ ] burnout_risk_history rows with NULL week are deleted before UNIQUE constraint
- [ ] `week` column has NOT NULL constraint added before UNIQUE constraint
- [ ] Both UNIQUE constraints are created successfully
- [ ] Migration tested on staging with production-like data (including duplicates and NULL values)
- [ ] Rollback migration exists (DROP CONSTRAINT, DROP NOT NULL)
- [ ] No data loss — dedup keeps the most recent row per partition

## Work Log

<!-- Append entries as work progresses -->

## Resources

- [PostgreSQL ROW_NUMBER](https://www.postgresql.org/docs/current/functions-window.html)
- [Supabase migration transactions](https://supabase.com/docs/guides/database/migrations)
- [NULL and UNIQUE constraints](https://www.postgresql.org/docs/current/ddl-constraints.html#DDL-CONSTRAINTS-UNIQUE-CONSTRAINTS)
- common-solutions.md #79 (post-rebase import verification)
- critical-patterns.md #11 (PostgREST filter escape)
