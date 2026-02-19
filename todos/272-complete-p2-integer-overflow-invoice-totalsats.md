---
status: complete
priority: p2
issue_id: '272'
tags: [code-review, financial, data-integrity]
dependencies: []
---

# Integer Overflow in Invoice totalSats Computation

## Problem Statement

InvoicingService computes totalSats by summing line items with plain JS arithmetic. For large invoices (many items or high sat values), this can exceed Number.MAX_SAFE_INTEGER causing silent precision loss in financial calculations.

## Findings

- `packages/backend/src/services/finance/InvoicingService.ts` — `items.reduce((sum, i) => sum + i.amount * i.quantity, 0)`
- No BigInt or overflow check

## Proposed Solutions

### Option 1: Use BigInt for sat arithmetic

**Approach:** Convert to BigInt for accumulation, validate result fits in safe integer range before storing.
**Effort:** 1h **Risk:** Low

### Option 2: Add overflow guard

**Approach:** Check each intermediate sum against MAX_SAFE_INTEGER and throw if exceeded.
**Effort:** 30min **Risk:** Low

## Acceptance Criteria

- [ ] No silent precision loss possible
- [ ] Overflow detected and reported as error
- [ ] Existing normal-range invoices unaffected

## Work Log

### 2026-02-18 - Code Review Discovery

**By:** Claude Code (13-agent parallel review)
