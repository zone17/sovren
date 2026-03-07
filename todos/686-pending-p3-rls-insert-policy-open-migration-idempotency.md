---
status: pending
priority: p3
issue_id: "686"
tags: [code-review, security, database, migration, slice-8]
dependencies: []
---

# RLS INSERT policy allows any user to forge notifications + migration not idempotent

## Problem Statement

Two critical migration issues: (1) `notifications_insert_service` policy uses `WITH CHECK (TRUE)` with no role restriction — any authenticated user can insert notifications for any target user via direct PostgREST calls. (2) `CREATE TRIGGER` and `CREATE POLICY` statements are not idempotent — re-running migrations fails.

**Agent consensus: 2/8** (Security, Data Integrity)

## Findings

### RLS INSERT policy (P1 — security)
- `20260306000000_notifications.sql:41-42` — `WITH CHECK (TRUE)` allows `anon`/`authenticated` to insert
- Attack: `POST /rest/v1/notifications` with arbitrary `user_id` and spoofed `actor_id`
- Comment says "Service role inserts" but policy is not restricted to service_role

### Migration idempotency (P2 — operational)
- `20260306000001_follow_count_trigger.sql:27-29` — bare `CREATE TRIGGER` fails on re-run
- Both migration files use `CREATE POLICY` without `DROP POLICY IF EXISTS`
- `notifications_update_own` policy missing `WITH CHECK` clause — user can change `user_id` on UPDATE

### Backfill race (P2 — correctness)
- `20260306000001_follow_count_trigger.sql:40-43` — backfill runs without SHARE ROW EXCLUSIVE lock
- Concurrent inserts during migration can double-count

## Proposed Solutions

### Fix all migration issues
1. Remove `notifications_insert_service` policy (service_role bypasses RLS by default)
2. Add `DROP TRIGGER IF EXISTS` before `CREATE TRIGGER`
3. Add `DROP POLICY IF EXISTS` before each `CREATE POLICY`
4. Add `WITH CHECK (auth.uid() = user_id)` to `notifications_update_own`
5. Add `LOCK TABLE followers IN SHARE ROW EXCLUSIVE MODE` before backfill

**Effort:** Small
**Risk:** Low

## Acceptance Criteria

- [ ] No open INSERT policy on notifications table
- [ ] All CREATE TRIGGER/POLICY preceded by DROP IF EXISTS
- [ ] notifications_update_own has WITH CHECK clause
- [ ] Backfill uses table lock for consistency
- [ ] Migration can be re-run without errors
