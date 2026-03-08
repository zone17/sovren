---
status: pending
priority: p1
issue_id: '726'
tags: [code-review, slice-8, backend, database, migration, rls]
dependencies: []
---

# RLS policies not idempotent (migration replay failure)

## Problem Statement

Migration files in `supabase/migrations/` use `CREATE POLICY` without first issuing `DROP POLICY IF EXISTS`. PostgreSQL does not support `CREATE OR REPLACE POLICY` (unlike functions). If a migration is replayed — due to `supabase db reset`, CI pipeline re-runs, or disaster recovery — it will fail with `ERROR: policy "policy_name" for table "table_name" already exists`. This blocks all migration-based deployments after the first run.

**Agent consensus: migration failure**

## Findings

Both migration files added in Slice 8 contain `CREATE POLICY` statements without corresponding `DROP POLICY IF EXISTS` guards:

- `supabase/migrations/20260306000000_notifications.sql`
- Additional Slice 8 migration files (verify with grep)

Example of the pattern found:

```sql
-- FRAGILE — fails on second run:
CREATE POLICY "users_can_read_notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);
```

PostgreSQL requires you to drop a policy before recreating it. Unlike `CREATE OR REPLACE FUNCTION`, there is no `CREATE OR REPLACE POLICY` syntax.

## Proposed Solutions

Add `DROP POLICY IF EXISTS` before every `CREATE POLICY` in the affected migrations:

```sql
-- IDEMPOTENT — safe on every run:
DROP POLICY IF EXISTS "users_can_read_notifications" ON notifications;
CREATE POLICY "users_can_read_notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);
```

Apply this pattern to every `CREATE POLICY` in every Slice 8 migration file.

Also verify whether `CREATE INDEX` statements in the same files have the same issue (see common-solutions.md #196 — `CREATE INDEX CONCURRENTLY IF NOT EXISTS` is the correct form).

## Technical Details

- Affected files: all migration files under `supabase/migrations/` added in Slice 8
- Run `grep -n "CREATE POLICY" supabase/migrations/` to enumerate all affected statements
- The fix is purely in the migration SQL — no application code changes
- After applying the fix, test idempotency: run `supabase db reset` twice in sequence and confirm both succeed
- `DROP POLICY IF EXISTS` syntax: `DROP POLICY IF EXISTS "policy_name" ON table_name;`
  - Policy name must match exactly (case-sensitive, including quotes)
  - Table name must match exactly
- `CREATE INDEX IF NOT EXISTS` can be used for indexes to achieve the same idempotency

## Acceptance Criteria

- [ ] Every `CREATE POLICY` in Slice 8 migration files is preceded by a matching `DROP POLICY IF EXISTS` on the same table
- [ ] Every `CREATE INDEX` in Slice 8 migration files uses `CREATE INDEX IF NOT EXISTS` (or `CREATE INDEX CONCURRENTLY IF NOT EXISTS`)
- [ ] Running `supabase db reset` twice in sequence succeeds both times without errors
- [ ] No policy names are missing or mismatched between the DROP and CREATE statements
- [ ] CI migration pipeline passes on fresh project creation
