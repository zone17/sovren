---
status: pending
priority: p3
issue_id: 747
tags: [code-review, slice-8, database, constraints, notifications]
dependencies: []
---

# P3: Missing entity_type CHECK constraint in migration

## Problem Statement

The `notifications.entity_type` column lacks a CHECK constraint to validate that only expected values are stored. This allows invalid values to be inserted at the database level, increasing the risk of data corruption or inconsistent state if application-layer validation is bypassed.

## Findings

- File: `supabase/migrations/20260306000000_notifications.sql`
- Column: `notifications.entity_type`
- Current state: Column accepts any string without database-level validation
- Expected valid values: `'circle'`, `'mentorship'`, `'follow'`, `'content'`, `'system'`

## Proposed Solutions

Add a CHECK constraint to the migration to enforce valid entity types at the database level:

```sql
ALTER TABLE notifications
  ADD CONSTRAINT check_entity_type_valid
  CHECK (entity_type IN ('circle', 'mentorship', 'follow', 'content', 'system'));
```

This ensures referential integrity and prevents invalid states at the database layer, complementing application-level validation.

## Technical Details

- CHECK constraints are evaluated on INSERT and UPDATE operations
- This is a database-level enforcement that protects data integrity
- Should be added to the initial migration that creates the notifications table
- Zero performance impact; indexes not required

## Acceptance Criteria

- [ ] Migration file updated with CHECK constraint on `notifications.entity_type`
- [ ] Constraint includes all 5 valid values: circle, mentorship, follow, content, system
- [ ] Migration applies successfully to test database
- [ ] Existing notifications data passes constraint validation
- [ ] Constraint name follows convention: `check_entity_type_valid`
