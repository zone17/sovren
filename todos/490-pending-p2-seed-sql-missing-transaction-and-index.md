---
status: pending
priority: p2
issue_id: 490
tags: [code-review, database, seed-data]
dependencies: []
---

# Seed SQL missing transaction wrapper and wellness_snapshots index

## Problem Statement

The seed SQL (`packages/backend/src/database/seed.sql`) runs DELETE+INSERT statements without a transaction wrapper. Partial failure leaves inconsistent state. Additionally, `wellness_snapshots` table has no index on `creator_id` — if this DDL is promoted to a migration, queries will full-scan.

## Findings

- **File:** `packages/backend/src/database/seed.sql`
- DELETE ordering respects FK constraints (child before parent) — correct
- No `BEGIN; ... COMMIT;` wrapper — partial state possible on failure
- `creator_work_patterns` has `UNIQUE(creator_id, date)` which creates implicit index — OK
- `wellness_snapshots` has no index on `creator_id` — sequential scan at scale
- Tables created via `CREATE TABLE IF NOT EXISTS` in seed, not in migrations — schema drift risk
- `db:seed` npm script points to `src/scripts/seed.ts` which does not exist (broken)

## Proposed Solutions

### Option A: Wrap in transaction + add index (Recommended)

```sql
BEGIN;
-- ... existing DELETEs and INSERTs ...
CREATE INDEX IF NOT EXISTS idx_wellness_snapshots_creator_id
  ON wellness_snapshots(creator_id);
COMMIT;
```

- **Effort:** Small (10 min)

## Acceptance Criteria

- [ ] Seed SQL wrapped in `BEGIN; ... COMMIT;`
- [ ] `wellness_snapshots` has index on `creator_id`
- [ ] `db:seed` npm script either fixed or removed

## Work Log

| Date       | Action                         | Learnings                                        |
| ---------- | ------------------------------ | ------------------------------------------------ |
| 2026-02-24 | Created from /workflows:review | Data integrity + performance agents both flagged |
