# Down Migrations

Executable rollback scripts for each up migration. Run in **reverse order** to roll back Epic 009 tables.

## Rollback Order (reverse of application)

```bash
# 1. Remove creator_id format CHECK constraints (20260218)
psql "$DATABASE_URL" -f 20260218000000_add_creator_id_format_checks_down.sql

# 2. Remove updated_at triggers
psql "$DATABASE_URL" -f 20260217000100_add_updated_at_triggers_down.sql

# 3. Revert platform enum unification (removes 'nostr' from CHECK constraints)
psql "$DATABASE_URL" -f 20260217000000_unify_platform_enum_down.sql

# 4. Remove foreign keys and constraints
psql "$DATABASE_URL" -f 20260216200600_add_foreign_keys_down.sql

# 5. Drop tables in reverse order (dependent tables first)
psql "$DATABASE_URL" -f 20260216200400_epic009_platform_metrics_history_down.sql
psql "$DATABASE_URL" -f 20260216200300_epic009_inbox_messages_down.sql
psql "$DATABASE_URL" -f 20260216200200_epic009_repurposed_content_down.sql
psql "$DATABASE_URL" -f 20260216200100_epic009_cross_posts_down.sql
psql "$DATABASE_URL" -f 20260216200000_epic009_platform_connections_down.sql
```

All rollback scripts are idempotent (use `IF EXISTS`).
