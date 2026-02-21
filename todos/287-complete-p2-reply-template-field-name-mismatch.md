---
status: complete
priority: p2
issue_id: '287'
tags: [code-review, data-integrity, schema-drift]
dependencies: []
---

# ReplyTemplate Field Name Mismatch

## Problem Statement

Frontend ReplyTemplate type uses `templateBody` but the SQL migration defines the column as `body`. Supabase queries will fail or return undefined for the mismatched field name.

## Findings

- `supabase/migrations/20260220000000_epic009b_adaptive_polling.sql:70` — column named `body`
- `packages/frontend/src/features/multi-platform/types/` — uses `templateBody`
- `packages/backend/src/services/inbox/` — may use either name

## Proposed Solutions

### Option 1: Align TypeScript to SQL column name

**Approach:** Rename `templateBody` to `body` in all TypeScript types and code.
**Effort:** 30min **Risk:** Low

## Acceptance Criteria

- [ ] Field name matches between SQL and TypeScript
- [ ] All references updated
- [ ] Queries return correct data

## Work Log

### 2026-02-18 - Code Review Discovery

**By:** Claude Code (13-agent parallel review)
