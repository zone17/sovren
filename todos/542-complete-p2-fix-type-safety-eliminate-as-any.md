---
status: complete
priority: p2
issue_id: '542'
tags: [code-review, typescript, type-safety, pr-102]
dependencies: []
---

# P2: Fix type safety — eliminate ~25 unnecessary `as any` casts

## Problem Statement

Multiple avoidable `as any` casts erode type safety across the test files. The largest cluster (20 casts) comes from `makeCreatorPlan()`/`makeProPlan()` return type mismatch with `createPlan()`. Additional casts in the shim params and failure reason enum are trivially fixable.

## Findings

**Agent consensus: 3/8 agents (Kieran TS P1+P2, Pattern Recognition P2, Architecture P3)**

### Category 1: Plan factory return types (20 casts)

`makeCreatorPlan()` returns `Omit<SubscriptionPlan, 'id'> & { id?: string }` but `createPlan()` expects `Omit<SubscriptionPlan, 'id' | 'createdAt' | 'updatedAt'>`. Fix: remove `createdAt`/`updatedAt` from factory, align return type.

### Category 2: Shim response shape (1 location)

`installSubscriptionPaymentShim` returns `{ currency, status }` (not in `PaymentResult`) and omits `fee` (is in `PaymentResult`). Fix: match `PaymentResult` exactly.

### Category 3: Shim params (1 location)

`(params: any)` could be typed as `{ userId: string; amount: number; currency: Currency; description: string }`.

### Category 4: auditLog phantom interface (2 locations)

`auditLog as any` — use concrete `AuditLogService` type instead of phantom `IAuditLogService`.

### Category 5: Trivial enum import (1 location)

`failureReason: 'insufficient_funds' as any` → `PaymentFailureReason.INSUFFICIENT_FUNDS`.

## Proposed Solutions

### Solution A: Fix all categories (Recommended)

**Effort:** Small (20 min) | **Risk:** None

1. Fix `makeCreatorPlan()`/`makeProPlan()` return types → eliminates 20 casts
2. Fix shim response shape → add `fee: 0`, remove phantom `currency`/`status`
3. Type shim params with local `SubscriptionPaymentParams` interface
4. Change `PaymentTestHarness.auditLog` type to `AuditLogService` (concrete)
5. Import and use `PaymentFailureReason.INSUFFICIENT_FUNDS`

## Acceptance Criteria

- [ ] `as any` count reduced from ~85 to ~60 (remaining are justified: private access, monkey-patching)
- [ ] All 317 tests still pass
- [ ] No new type errors

## Technical Details

**Affected files:**

- `packages/backend/src/services/payment/__tests__/SubscriptionService.test.ts` (plan factories, shim)
- `packages/backend/src/services/payment/__tests__/PaymentAnalyticsService.test.ts` (enum)
- `packages/backend/src/test-utils/payment-test-harness.ts` (auditLog type)

## Resources

- Kieran TypeScript Reviewer: Findings #1, #3, #4, #5
- Pattern Recognition: Finding #2b
