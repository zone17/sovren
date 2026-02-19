---
status: complete
priority: p1
issue_id: '268'
tags: [code-review, data-integrity, migration]
dependencies: []
---

# reply_templates.creator_id TEXT vs UUID Mismatch

## Problem Statement

reply_templates defines creator_id as TEXT NOT NULL with no FK to auth.users. All other tables use UUID with proper FK references. RLS casts auth.uid()::text as workaround.

## Findings

- `supabase/migrations/20260220000000_epic009b_adaptive_polling.sql:65` — TEXT NOT NULL, no FK

## Proposed Solutions

### Option 1: Change to UUID with FK

**Approach:** ALTER creator_id to UUID NOT NULL REFERENCES auth.users(id). Safe since table is likely empty.
**Effort:** 30min **Risk:** Low

## Acceptance Criteria

- [ ] creator_id is UUID type
- [ ] FK constraint to auth.users(id)
- [ ] RLS policy simplified (no ::text cast)

## Work Log

### 2026-02-18 - Code Review Discovery

**By:** Claude Code (13-agent parallel review)
