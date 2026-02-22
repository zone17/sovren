---
status: pending
priority: p3
issue_id: 469
tags: [code-review, test-infrastructure]
dependencies: []
---

# Expand supabase mock chain with missing filter methods

## Problem Statement

`createMockChain` only stubs 10 methods but `SupabaseFilterBuilder` defines 12+ additional methods (`gt`, `gte`, `lt`, `lte`, `like`, `ilike`, `is`, `contains`, `containedBy`, `not`, `or`, `filter`, `upsert`). Tests using uncovered methods get runtime "not a function" errors. The return type is also untyped (`Record<string, ...>`).

## Findings

- Source: Architecture strategist (PR #94 review)
- MarketplaceService.test.ts hand-rolled mock includes `not`, `or`, `range` that createMockChain lacks
- No compile-time enforcement — method list is a runtime string array

## Proposed Solutions

### Option A: Add all filter methods to the array + add barrel export

- Effort: Small
- Risk: Low

## Acceptance Criteria

- [ ] All SupabaseFilterBuilder methods stubbed
- [ ] `test-utils/index.ts` barrel export created
- [ ] `test-utils/` excluded from production tsconfig

## Work Log

| Date       | Action                     | Learnings                                       |
| ---------- | -------------------------- | ----------------------------------------------- |
| 2022-02-22 | Created from PR #94 review | Runtime string array can't enforce completeness |
