---
status: complete
priority: p1
issue_id: '539'
tags: [code-review, performance, test-infrastructure, pr-102]
dependencies: []
---

# P1: PaymentTestHarness dispose() leaks ~1200 timer handles

## Problem Statement

`createPaymentTestHarness().dispose()` only cleans up 4 of 8 services. Four services with active `setInterval`/`setTimeout` handles are never disposed, leaking ~4 timer handles per test across 317 tests (~1268 leaked handles total). This prevents clean Node.js exit, holds GC references, and will surface as flaky `--detectOpenHandles` failures.

## Findings

**Agent consensus: 2/8 agents (Performance Oracle P1, Data Integrity P2)**

### Missing dispose() calls:

1. `paymentService.dispose()` — `startExpirationCheck()` creates `setInterval(300000)` (5min)
2. `currencyService.dispose()` — `startAutoRefresh()` creates `setInterval(300000)` + `setTimeout(1000)` warmup
3. `auditLog.dispose()` — `startArchiveProcess()` creates daily `setInterval`
4. `analyticsService.dispose()` — stores realtime subscriptions + aggregation `setTimeout`

### Current dispose():

```typescript
const dispose = async (): Promise<void> => {
  await refundService.dispose();
  await subscriptionService.dispose();
  await eventBus.dispose();
  await cache.dispose();
};
```

## Proposed Solutions

### Solution A: Add missing dispose calls (Recommended)

**Effort:** Small (5 min) | **Risk:** None

```typescript
const dispose = async (): Promise<void> => {
  await analyticsService.dispose();
  await refundService.dispose();
  await subscriptionService.dispose();
  await currencyService.dispose();
  await (paymentService as any).dispose();
  await (auditLog as any).dispose();
  await eventBus.dispose();
  await cache.dispose();
};
```

Order: dependents before dependencies. `as any` needed because harness types via interfaces.

### Solution B: Additionally pass `{ autoRefresh: false }` to CurrencyService

**Effort:** Small (10 min) | **Risk:** Low — need to verify constructor accepts config

Eliminates 2 timers per test at construction time. Even with dispose(), preventing unnecessary timers is cleaner.

## Acceptance Criteria

- [ ] All 8 services disposed in correct dependency order
- [ ] 317 tests still pass
- [ ] No leaked timer handles (verify with `--detectOpenHandles` if available)

## Technical Details

**Affected files:**

- `packages/backend/src/test-utils/payment-test-harness.ts` (lines 258-263)

## Resources

- Performance Oracle analysis: leaked setInterval from PaymentProcessingService.startExpirationCheck()
- Data Integrity Guardian: Finding #5
