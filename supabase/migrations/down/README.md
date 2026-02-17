# Down Migrations

Executable rollback scripts for each up migration. Run in **reverse order** to roll back Epic 009 tables.

## Rollback Order (reverse of application)

```bash
# 1. Remove foreign keys and constraints first
psql "$DATABASE_URL" -f 20260216200600_add_foreign_keys_down.sql

# 2. Drop tables in reverse order (dependent tables first)
psql "$DATABASE_URL" -f 20260216200400_epic009_platform_metrics_history_down.sql
psql "$DATABASE_URL" -f 20260216200300_epic009_inbox_messages_down.sql
psql "$DATABASE_URL" -f 20260216200200_epic009_repurposed_content_down.sql
psql "$DATABASE_URL" -f 20260216200100_epic009_cross_posts_down.sql
psql "$DATABASE_URL" -f 20260216200000_epic009_platform_connections_down.sql
```

All rollback scripts are idempotent (use `IF EXISTS`).
