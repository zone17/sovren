# Todo 250: creator_id format CHECK constraint only on platform_connections

**Priority**: P2
**Category**: Data Integrity
**Source**: Data integrity review of commit d928918

## Problem

Migration `20260216200600_add_foreign_keys.sql` adds `chk_creator_id_format` (64 hex chars) to `platform_connections` only, but 4 other Epic 009 tables also have `creator_id TEXT NOT NULL` columns without this validation:

- `cross_posts`
- `repurposed_content`
- `inbox_messages`
- `platform_metrics_history`

Invalid creator IDs (wrong length, non-hex chars) can be inserted into these tables, leading to join mismatches and orphaned data.

## Impact

- Data integrity: Rows with malformed `creator_id` would silently fail JOINs with `platform_connections`
- The composite FK on `cross_posts(creator_id, platform)` provides implicit validation for that table, but `inbox_messages`, `repurposed_content`, and `platform_metrics_history` have no FK or format check

## Fix

Add the same CHECK constraint to all 4 tables:

```sql
ALTER TABLE cross_posts
  ADD CONSTRAINT chk_cross_posts_creator_id_format
  CHECK (LENGTH(creator_id) = 64 AND creator_id ~ '^[0-9a-f]+$');

ALTER TABLE repurposed_content
  ADD CONSTRAINT chk_repurposed_creator_id_format
  CHECK (LENGTH(creator_id) = 64 AND creator_id ~ '^[0-9a-f]+$');

ALTER TABLE inbox_messages
  ADD CONSTRAINT chk_inbox_creator_id_format
  CHECK (LENGTH(creator_id) = 64 AND creator_id ~ '^[0-9a-f]+$');

ALTER TABLE platform_metrics_history
  ADD CONSTRAINT chk_metrics_creator_id_format
  CHECK (LENGTH(creator_id) = 64 AND creator_id ~ '^[0-9a-f]+$');
```

## Files

- `supabase/migrations/20260216200600_add_foreign_keys.sql` (line 22-24)
- New migration needed for the additional constraints
