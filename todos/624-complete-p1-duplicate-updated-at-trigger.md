---
status: pending
priority: p1
issue_id: '624'
tags: [code-review, database, migration, supabase]
dependencies: []
---

# Duplicate updated_at trigger in supplementary migration

## Problem Statement

The supplementary migration at `supabase/migrations/20260304000001_comments_supplementary.sql` creates a second `updated_at` trigger on the comments table. The baseline migration already creates one. This results in the `updated_at` column being set twice on every UPDATE, which is wasteful and could mask timing issues.

## Findings

- Data Integrity Guardian flagged as P1
- Having two triggers on the same event with identical behavior is a PostgreSQL anti-pattern
- Could cause confusion when debugging trigger execution order

## Proposed Solutions

### Option A: Add IF NOT EXISTS guard (Recommended)

Wrap the trigger creation in a check: `DROP TRIGGER IF EXISTS ... ; CREATE TRIGGER ...`

- Pros: Idempotent, safe for both fresh and incremental migrations
- Cons: None
- Effort: Small

### Option B: Remove from supplementary migration

If baseline already handles it, simply remove the duplicate CREATE TRIGGER statement.

- Pros: Cleanest
- Cons: Need to verify baseline migration covers it
- Effort: Small

## Acceptance Criteria

- [ ] Only one `updated_at` trigger exists on comments table after all migrations run
- [ ] Migration is idempotent (can run fresh or incremental)
