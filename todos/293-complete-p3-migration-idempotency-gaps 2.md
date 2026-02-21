---
status: complete
priority: p3
issue_id: '293'
tags: [code-review, migration, safety]
dependencies: []
---

# Migration Idempotency Gaps

## Problem Statement

Most migrations use CREATE TABLE without IF NOT EXISTS. Re-running migrations (e.g., during recovery) will fail with "table already exists" errors.

## Findings

- 8 of 11 migration files use plain CREATE TABLE
- Only 3 use CREATE TABLE IF NOT EXISTS

## Proposed Solutions

### Option 1: Add IF NOT EXISTS to all CREATE TABLE statements

**Approach:** Update all migrations to use IF NOT EXISTS for tables, indexes, and functions.
**Effort:** 1h **Risk:** Low

## Acceptance Criteria

- [ ] All CREATE TABLE use IF NOT EXISTS
- [ ] All CREATE INDEX use IF NOT EXISTS
- [ ] Migrations are re-runnable

## Work Log

### 2026-02-18 - Code Review Discovery

**By:** Claude Code (13-agent parallel review)
