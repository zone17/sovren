---
status: pending
priority: p3
issue_id: 748
tags: [code-review, slice-8, database, triggers, creators]
dependencies: []
---

# P3: Trigger silent on missing creators row

## Problem Statement

The `follow_count` trigger that updates the creators table performs an UPDATE operation without checking if the target row exists. If a follow record is created for a non-existent creator (data inconsistency), the trigger silently fails to update anything, providing no visibility into the problem.

## Findings

- File: `supabase/migrations/20260306000001_follow_count_trigger.sql`
- Trigger: `follow_count` (or similar)
- Current behavior: UPDATE on creators table doesn't verify the row was actually updated
- Risk: Silent failure masks data integrity issues; orphaned follow records go undetected

## Proposed Solutions

Option 1 (Recommended): Add explicit error handling:

```sql
UPDATE creators SET follow_count = follow_count + 1
WHERE id = NEW.creator_id;

IF NOT FOUND THEN
  RAISE WARNING 'follow_count trigger: creator % does not exist', NEW.creator_id;
END IF;
```

Option 2: Pre-check with foreign key enforcement:

- Ensure foreign key constraint on `follows.creator_id` exists
- Constraint prevents creation of orphaned records at source

## Technical Details

- PL/pgSQL `IF NOT FOUND` clause runs after UPDATE to detect no rows affected
- RAISE WARNING logs visible in Postgres logs without stopping transaction
- Foreign key constraint is stronger and prevents the issue entirely
- Check both solutions and apply the one that fits your design

## Acceptance Criteria

- [ ] Trigger includes explicit handling for missing creator rows
- [ ] Either IF NOT FOUND warning added OR foreign key constraint verified
- [ ] Trigger behavior tested with non-existent creator_id
- [ ] Postgres logs confirm warning appears on edge case
- [ ] Documentation updated if behavior changes from silent failure
