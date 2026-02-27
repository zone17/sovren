---
status: complete
priority: p2
issue_id: '544'
tags: [code-review, duplication, test-infrastructure, pr-102]
dependencies: ['541']
---

# P2: Extract duplicate test helpers (failed payment response, getPaymentHistory override)

## Problem Statement

Two patterns are duplicated across multiple test locations with near-identical code, violating DRY and making future shape changes require multi-location updates.

## Findings

**Agent consensus: 1/8 agents (Pattern Recognition P2) — clear duplication**

### Duplicate 1: Failed payment response (4 copies)

SubscriptionService.test.ts lines 849, 956, 1008, 1047 — each is a 7-line object literal with the same shape, only `error` string varies.

### Duplicate 2: getPaymentHistory override (9 copies)

PaymentAnalyticsService.test.ts lines 202, 216, 502, 634, 1056, 1079, 1100, 1114, 1432 — same monkey-patch pattern with different transaction arrays.

## Proposed Solutions

### Solution A: Extract file-local helpers (Recommended)

**Effort:** Small (15 min) | **Risk:** None

1. In SubscriptionService.test.ts:

```typescript
function installFailedPaymentShim(harness: PaymentTestHarness, error = 'Payment failed'): void {
  (harness.paymentService as any).processPayment = async () => ({
    success: false,
    error,
    transactionId: '',
    amount: 0,
    fee: 0,
    status: PaymentStatus.FAILED,
    timestamp: new Date(),
  });
}
```

2. In PaymentAnalyticsService.test.ts:

```typescript
function overridePaymentHistory(harness: PaymentTestHarness, txs: PaymentTransaction[]): void {
  (harness.paymentService as any).getPaymentHistory = async () => txs;
}
```

Reduces 4 blocks + 9 blocks to 1-line calls.

## Acceptance Criteria

- [ ] Failed payment response defined in exactly 1 location
- [ ] getPaymentHistory override defined in exactly 1 location
- [ ] All 317 tests still pass

## Technical Details

**Affected files:**

- `packages/backend/src/services/payment/__tests__/SubscriptionService.test.ts`
- `packages/backend/src/services/payment/__tests__/PaymentAnalyticsService.test.ts`

## Resources

- Pattern Recognition Specialist: Findings #4a, #4b
