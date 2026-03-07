---
status: pending
priority: p3
issue_id: '215'
tags: [code-review, pr-85, database]
---

# Missing updated_at Triggers on New Tables

## Problem Statement

New tables lack database-level updated_at triggers. Baseline schema uses triggers but new tables rely on application-level timestamp setting.

## Findings

- Files: `supabase/migrations/20260216200*_epic009_*.sql`
- Baseline schema tables use `moddatetime` triggers to automatically update `updated_at` on row modification
- New Epic 009 tables define `updated_at` columns but do not create corresponding triggers
- Application code must manually set `updated_at` on every update, which is error-prone and inconsistent with the existing schema pattern

## Proposed Solutions

1. Add `moddatetime` triggers to all new tables, consistent with the baseline schema pattern
2. Create a new migration file that adds the missing triggers to all Epic 009 tables

## Acceptance Criteria

- [ ] All new tables with updated_at columns have moddatetime triggers installed
- [ ] Triggers are verified to automatically update the updated_at column on row modification
- [ ] Pattern is consistent with existing baseline schema triggers
