---
status: pending
priority: p2
issue_id: '196'
tags: [code-review, pr-85, database]
---

# CREATE INDEX and CREATE POLICY Statements Not Idempotent

## Problem Statement

CREATE INDEX and CREATE POLICY statements in all 5 migrations lack IF NOT EXISTS / DROP IF EXISTS guards. Migration re-run after partial failure will error.

## Findings

- **Files**: All 5 `supabase/migrations/20260216200*_epic009_*.sql` migration files
- `CREATE INDEX` statements do not use `IF NOT EXISTS` clause
- `CREATE POLICY` statements do not have corresponding `DROP POLICY IF EXISTS` guards before creation
- If a migration partially completes (e.g., indexes created but policies fail), re-running the migration will fail on the already-created indexes/policies
- This makes disaster recovery and migration debugging significantly harder

## Proposed Solutions

1. Add `IF NOT EXISTS` to all `CREATE INDEX` statements and add `DROP POLICY IF EXISTS` before each `CREATE POLICY` statement
2. Wrap each migration in a transaction block so partial failures roll back completely (though Supabase migrations may already do this — verify)

## Acceptance Criteria

- [ ] All CREATE INDEX statements use `CREATE INDEX IF NOT EXISTS`
- [ ] All CREATE POLICY statements are preceded by `DROP POLICY IF EXISTS` for the same policy name
- [ ] Migrations can be re-run after partial failure without errors
- [ ] Existing data is not affected by the idempotency guards
