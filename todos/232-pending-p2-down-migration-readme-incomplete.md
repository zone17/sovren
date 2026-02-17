# Todo 232: Down migration README missing 2 newest migrations

**Priority**: P2
**Status**: pending
**Category**: Database / Operations
**Found by**: Architecture review of P3 remediation commit d928918

## Problem

The `supabase/migrations/down/README.md` documents rollback order for only 6 scripts (the Epic 009 base tables and foreign keys). It does not include:

- `20260217000000_unify_platform_enum_down.sql` (reverts 'nostr' addition to CHECK constraints)
- `20260217000100_add_updated_at_triggers_down.sql` (drops updated_at triggers)

An operator following the README would execute rollbacks in this order:
1. Foreign keys
2. Drop tables

But they would miss reverting the enum unification and triggers first. The triggers reference tables that get dropped in step 2, so they would be implicitly dropped — but the enum constraints on the remaining tables would be left in an inconsistent state if only some tables are rolled back.

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

## Impact

Operational risk during incident rollback. An operator under pressure will follow the README and produce an incomplete rollback.
