---
status: complete
priority: p3
issue_id: '545'
tags: [code-review, quality, cosmetic, pr-102]
dependencies: []
---

# P3: Cosmetic cleanup bundle — expect(true), enum import, deterministic IDs, regex, query constants

## Problem Statement

Collection of low-severity findings from 8-agent review that individually don't warrant dedicated todos.

## Findings

### 1. Remove `expect(true).toBe(true)` (6 instances) — Simplicity + Pattern Recognition

PaymentAnalyticsService.test.ts lines 135, 620, 822, 867, 1025, 1035. Tests pass without these assertions (no-throw is implicit).

### 2. Use `PaymentFailureReason.INSUFFICIENT_FUNDS` enum — Kieran TS

PaymentAnalyticsService.test.ts line 84: `'insufficient_funds' as any` → import and use the enum.

### 3. Use deterministic event IDs — Pattern Recognition

PaymentAnalyticsService.test.ts line 27: `Math.random()` → counter for reproducibility.

### 4. Escape regex in invalidate() — Security + Data Integrity

payment-test-harness.ts line 78: pattern chars like `.+?` are unescaped. Test-only code but easily fixable.

### 5. Extract analytics query constants — Pattern Recognition

PaymentAnalyticsService.test.ts: 11+ duplicate `{ period: AnalyticsPeriod.DAILY, startDate, endDate }` objects → `DAILY_JAN_QUERY` constant.

### 6. Standardize test file headers — Pattern Recognition

"Integration Tests" vs "Tests" vs "Test Suite" — pick one convention.

### 7. `cancelled` vs `canceled` spelling — Pattern Recognition

IEventBus.ts: `REFUND_CANCELED` (American) vs pre-existing `SUBSCRIPTION_CANCELLED` (British). Document choice.

## Proposed Solutions

### Fix all in one pass

**Effort:** Small (20 min) | **Risk:** None

## Acceptance Criteria

- [ ] No `expect(true).toBe(true)` remaining
- [ ] Enum imported for failureReason
- [ ] Deterministic event IDs
- [ ] All 317 tests still pass

## Resources

- Simplicity Reviewer, Pattern Recognition, Kieran TS, Security Sentinel, Data Integrity Guardian
