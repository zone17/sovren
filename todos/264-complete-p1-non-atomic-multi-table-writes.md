---
status: complete
priority: p1
issue_id: '264'
tags: [code-review, data-integrity]
dependencies: []
---

# Non-Atomic Multi-Table Writes in 3 Services

## Problem Statement

Three operations perform multi-table inserts without transactions: createCircle (circle + admin member), updateRevenueSplit (multiple rows), recordRevenueSplitLedger (ledger + payments).

## Findings

- `packages/backend/src/services/community/CreatorCircleService.ts` — createCircle not atomic
- `packages/backend/src/services/community/CollaborativeContentService.ts` — updateRevenueSplit, recordRevenueSplitLedger not atomic

## Proposed Solutions

### Option 1: Supabase RPC functions

**Approach:** Wrap multi-table operations in plpgsql functions called via .rpc(). Ensures atomicity at DB level.
**Effort:** 4-6h **Risk:** Medium

## Acceptance Criteria

- [ ] createCircle is atomic (circle + admin member in one transaction)
- [ ] updateRevenueSplit is atomic (all splits update or none)
- [ ] recordRevenueSplitLedger is atomic (ledger + payments together)

## Work Log

### 2026-02-18 - Code Review Discovery

**By:** Claude Code (13-agent parallel review)
