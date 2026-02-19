---
status: pending
priority: p2
issue_id: 322
tags: [code-review, performance]
---

# Unbounded `TaxService.getExpenses` — no `.limit()`

## Problem Statement

The `getExpenses` query in TaxService is the only list query in Wave 2 that lacks a `.limit()` clause. All other list queries use `.limit(50)` or `.limit(100)`. Without a limit, a user with many expenses could trigger an unbounded result set, causing performance degradation and excessive memory usage.

## Findings

- `packages/backend/src/services/finance/TaxService.ts:101-118` — `getExpenses` query chain ends with `.order()` but no `.limit()`
- All other Wave 2 list queries consistently apply `.limit(50)` or `.limit(100)`

## Proposed Solutions

1. Add `.limit(100)` after the `.order()` call in `getExpenses`
2. Add pagination support (offset/limit) to match other list endpoints

## Technical Details

- **Affected Files**: packages/backend/src/services/finance/TaxService.ts

## Acceptance Criteria

- [ ] `.limit(100)` added to the `getExpenses` query chain after `.order()`
- [ ] Query cannot return unbounded result sets
- [ ] Existing tests pass
