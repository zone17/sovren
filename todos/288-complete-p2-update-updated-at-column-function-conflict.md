---
status: complete
priority: p2
issue_id: '288'
tags: [code-review, migration, naming-conflict]
dependencies: []
---

# update_updated_at_column() Function Name Conflict

## Problem Statement

Multiple migrations define `CREATE OR REPLACE FUNCTION update_updated_at_column()`. While OR REPLACE prevents errors, the last migration to run wins, potentially changing behavior for all tables using this trigger function.

## Findings

- `supabase/migrations/20260220000000_epic009b_adaptive_polling.sql` — defines the function
- `supabase/migrations/20260220100100_epic010_circles.sql` — redefines the function
- Earlier migrations may also define it

## Proposed Solutions

### Option 1: Define once in base migration, skip in later ones

**Approach:** Use `CREATE FUNCTION IF NOT EXISTS` pattern or guard with DO $$ block checking pg_proc. Remove duplicate definitions from later migrations.
**Effort:** 30min **Risk:** Low

## Acceptance Criteria

- [ ] Function defined exactly once
- [ ] Later migrations don't redefine it
- [ ] All triggers still work correctly

## Work Log

### 2026-02-18 - Code Review Discovery

**By:** Claude Code (13-agent parallel review)
