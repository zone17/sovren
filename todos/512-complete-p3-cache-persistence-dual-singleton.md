---
status: pending
priority: p3
issue_id: 512
tags: [code-review, frontend, singleton, design]
dependencies: [507]
---

# P3: CachePersistenceService dual singleton paths

## Problem Statement

`CachePersistenceService` has two independent singleton access paths: `CachePersistenceService.getInstance()` (static) and `getCachePersistence()` (module-level lazy variable). This creates confusion about which to use and caused the stale singleton bug (#507).

## Findings

**File:** `packages/frontend/src/services/nostr/CachePersistenceService.ts`

Two separate singleton mechanisms coexist:

1. `static getInstance()` — class-level singleton
2. `getCachePersistence()` — module-level lazy singleton wrapping getInstance()

## Proposed Solutions

### Option A: Consolidate to one path after #507 is fixed

- Remove `getCachePersistence()`, update all callers to use `getInstance()`
- Pros: Single source of truth
- Cons: Touches multiple import sites
- Effort: Medium
- Risk: Low

### Option B: Keep both, ensure they stay in sync

- Fix #507 first, add comment documenting the dual path
- Pros: No caller changes
- Cons: Design smell remains
- Effort: Small
- Risk: Low

## Technical Details

- **Affected files:** `packages/frontend/src/services/nostr/CachePersistenceService.ts`, all callers

## Acceptance Criteria

- [ ] Single clear singleton access pattern, or documented reason for dual paths

## Work Log

| Date       | Action                                 | Learnings                                    |
| ---------- | -------------------------------------- | -------------------------------------------- |
| 2026-02-25 | Identified during manual PR #98 review | Dual singletons are a recurring anti-pattern |

## Resources

- PR #98: fix/backend-startup
- Depends on: #507 (stale singleton fix)
