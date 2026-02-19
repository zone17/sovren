---
status: complete
priority: p2
issue_id: '273'
tags: [code-review, data-integrity, migration]
dependencies: []
---

# Missing ON DELETE Clauses on 3 FK Columns

## Problem Statement

Three foreign key columns lack explicit ON DELETE behavior, defaulting to NO ACTION which will throw runtime errors if referenced rows are deleted. Other FKs in the same migrations correctly specify CASCADE or RESTRICT.

## Findings

- `supabase/migrations/20260220100300_epic010_marketplace.sql` — service_orders.listing_id, order_reviews.order_id missing ON DELETE
- `supabase/migrations/20260220100200_epic010_mentorship.sql` — mentorship_sessions.mentorship_id missing ON DELETE

## Proposed Solutions

### Option 1: Add explicit ON DELETE clauses

**Approach:** Add ON DELETE RESTRICT for financial tables (orders, reviews) and ON DELETE CASCADE for sessions. Matches existing patterns in the codebase.
**Effort:** 30min **Risk:** Low

## Acceptance Criteria

- [ ] All FK columns have explicit ON DELETE clause
- [ ] Financial FKs use RESTRICT
- [ ] Session FKs use CASCADE
- [ ] Migration is additive (ALTER, not recreate)

## Work Log

### 2026-02-18 - Code Review Discovery

**By:** Claude Code (13-agent parallel review)
