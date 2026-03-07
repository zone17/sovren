---
status: pending
priority: p2
issue_id: 740
tags: [code-review, slice-8, performance, database, postgresql, wal, migrations]
dependencies: []
---

# #740 - REPLICA IDENTITY FULL on Notifications Table

## Problem Statement

The notifications migration sets `ALTER TABLE notifications REPLICA IDENTITY FULL`. This causes PostgreSQL to write the entire row (before and after image) to the Write-Ahead Log for every UPDATE operation. The notifications table has high UPDATE frequency (marking notifications as read), making this a significant WAL amplification source that increases storage I/O, replication lag, and backup size.

## Findings

Single agent finding during Slice 8 Creator Network review.

- `supabase/migrations/20260306000000_notifications.sql` contains `ALTER TABLE notifications REPLICA IDENTITY FULL`
- `REPLICA IDENTITY FULL` is required only for logical replication when the table has no primary key or when replication needs to identify rows by non-PK columns
- The notifications table has a primary key (`id UUID`)
- The default `REPLICA IDENTITY DEFAULT` (writes only the PK to WAL) is sufficient for standard Supabase Realtime subscriptions
- `markAsRead` and `markAllRead` are frequent update operations that benefit disproportionately from removing `FULL`
- Supabase Realtime for notifications does not require `FULL` — it uses the PK to identify changed rows

## Proposed Solutions

Remove the `REPLICA IDENTITY FULL` setting. If it was added to support Supabase Realtime, it is not needed — Realtime works with the default `REPLICA IDENTITY DEFAULT` for tables with a primary key.

Option A — Remove from migration file (if migration has not yet been applied to production):

```sql
-- Remove this line from 20260306000000_notifications.sql:
-- ALTER TABLE notifications REPLICA IDENTITY FULL;
```

Option B — Add a reverting migration (if migration is already applied):

```sql
-- New migration: 20260307000002_fix_notifications_replica_identity.sql
ALTER TABLE notifications REPLICA IDENTITY DEFAULT;
```

## Technical Details

- **File**: `supabase/migrations/20260306000000_notifications.sql`
- **PostgreSQL behavior**: `REPLICA IDENTITY FULL` writes old+new full row to WAL on every UPDATE/DELETE
- **Cost**: Proportional to row width × update frequency — notifications table is wide and updated frequently
- **When `FULL` IS needed**: Tables without PK used in logical replication, or when needing old column values in replication slots
- **Supabase Realtime**: Uses `REPLICA IDENTITY DEFAULT` (PK only) by default; does not require `FULL`

## Acceptance Criteria

- [ ] `REPLICA IDENTITY FULL` removed from notifications table
- [ ] Default `REPLICA IDENTITY` (PK-based) applied via migration or migration edit
- [ ] Supabase Realtime subscription for notifications still works after the change (tested locally)
- [ ] Migration applies cleanly
- [ ] No regression in notification delivery or read-status updates
