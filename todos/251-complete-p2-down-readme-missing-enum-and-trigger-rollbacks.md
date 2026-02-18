# Todo 251: Down migrations README missing enum unification and trigger rollback steps

**Priority**: P2
**Category**: Data Integrity / Operations
**Source**: Data integrity review of commit d928918

## Problem

`supabase/migrations/down/README.md` documents rollback order for migrations 200000-200600 but omits two later migrations:

- `20260217000000_unify_platform_enum_down.sql` — reverts platform CHECK constraints
- `20260217000100_add_updated_at_triggers_down.sql` — removes updated_at triggers

The down migration **files exist** and are correct, but the README instructions would leave an operator unaware they need to run these first.

## Impact

- Operations risk: A developer following the README to roll back Epic 009 would leave orphaned CHECK constraints (with 'nostr' included) and triggers on tables that no longer exist (CASCADE would handle triggers, but enum constraints on dropped tables would error)
- More critically: If rolling back just the enum unification (not the tables), the README gives no guidance

## Fix

Update `supabase/migrations/down/README.md` to include all 8 down migrations in correct reverse order:

```bash
# 1. Remove triggers first
psql "$DATABASE_URL" -f 20260217000100_add_updated_at_triggers_down.sql

# 2. Revert platform enum unification
psql "$DATABASE_URL" -f 20260217000000_unify_platform_enum_down.sql

# 3. Remove foreign keys and constraints
psql "$DATABASE_URL" -f 20260216200600_add_foreign_keys_down.sql

# 4. Drop tables in reverse order
psql "$DATABASE_URL" -f 20260216200400_epic009_platform_metrics_history_down.sql
psql "$DATABASE_URL" -f 20260216200300_epic009_inbox_messages_down.sql
psql "$DATABASE_URL" -f 20260216200200_epic009_repurposed_content_down.sql
psql "$DATABASE_URL" -f 20260216200100_epic009_cross_posts_down.sql
psql "$DATABASE_URL" -f 20260216200000_epic009_platform_connections_down.sql
```

## Files

- `supabase/migrations/down/README.md`
