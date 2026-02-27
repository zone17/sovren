---
title: 'Payment Test Harness — Full Mock Elimination for Payment Services'
date: '2026-02-26'
category: 'test-infrastructure'
tags:
  - payment-services
  - test-mocks
  - integration-testing
  - vitest
  - test-harness
  - timer-leaks
module: 'payment'
symptoms:
  - '317 payment tests using vi.fn() mocks — break when service APIs change'
  - 'Duplicate test helper patterns scattered across 3 test files'
  - 'Timer leaks from undisposed services (~1200 handles per test run)'
  - '5.1s real setTimeout in aggregation test (91% of test runtime)'
  - '~85 as any casts masking type mismatches'
severity: 'P1'
time_to_resolve: '3 sessions (~4 hours total)'
related_todos:
  - '539'
  - '540'
  - '541'
  - '542'
  - '543'
  - '544'
  - '545'
related_prs:
  - '101'
  - '102'
---

# Payment Test Harness — Full Mock Elimination

## Problem

Three payment test files (RefundService, SubscriptionService, PaymentAnalyticsService) totaling 317 tests relied entirely on `vi.fn()` mocks for service dependencies. When `PaymentProcessingService` grew from 8 to 28 methods, mock stubs broke silently — tests passed but exercised no real behavior.

### Symptoms

- `RefundService.test.ts`: 28 `vi.fn()` stubs, ~120 tests blocked by missing `REFUND_*` enum values
- `SubscriptionService.test.ts`: Incomplete `processPayment` mock (SubscriptionService passes non-standard params)
- `PaymentAnalyticsService.test.ts`: Mock chains couldn't simulate arbitrary transaction states (failed, refunded)
- 4 duplicate failed-payment response blocks, 9 duplicate `getPaymentHistory` overrides
- `dispose()` only cleaned up 4/8 services, leaking ~1200 timer handles per run

## Root Cause

Mock-based tests couple to implementation details rather than contracts. When a service grows (8→28 methods), every mock must be updated manually. Single-chain mocks can't serve multi-table queries or arbitrary state permutations.

The fundamental fix: replace mocks with real service instances backed by in-memory storage.

## Solution

### 1. Create PaymentTestHarness (shared test infrastructure)

```typescript
// packages/backend/src/test-utils/payment-test-harness.ts
export function createPaymentTestHarness(): PaymentTestHarness {
  const logger = new SilentLogger();
  const eventBus = new TestableEventBus(logger);
  const cache = new InMemoryCacheService();
  const currencyService = new CurrencyService(eventBus, logger, cache);
  const paymentService = new PaymentProcessingService(eventBus, logger, cache);
  const auditLog = new AuditLogService(eventBus, logger, undefined, cache);
  const refundService = new RefundService(paymentService, currencyService, eventBus, logger, cache);
  const subscriptionService = new SubscriptionService(
    paymentService,
    currencyService,
    auditLog as any,
    eventBus,
    logger,
    undefined,
    cache
  );
  const analyticsService = new PaymentAnalyticsService(
    paymentService,
    currencyService,
    cache,
    eventBus,
    logger
  );
  // ... seedCompletedTransaction, seedRawTransaction, flushPromises, dispose
}
```

**Key components:**

- `InMemoryCacheService` — Map-based `ICacheService` implementation (no Redis)
- `SilentLogger` — No-op `ILogger` (prevents console noise)
- `TestableEventBus` — Captures `emit()` calls for assertion (bridges SubscriptionService's `emit()` / `IEventBus.publish()` mismatch)
- `seedCompletedTransaction()` — Creates real transactions through the full payment flow
- `seedRawTransaction()` — Injects arbitrary transaction states via private repository access (with runtime guard)

### 2. Bridge SubscriptionService's non-standard API

```typescript
// SubscriptionService calls processPayment({userId, amount, currency, description})
// but real ProcessPaymentParams expects {invoiceId, method}
export function installSubscriptionPaymentShim(harness: PaymentTestHarness): void {
  let txCounter = 0;
  (harness.paymentService as any).processPayment = async (params: {
    userId?: string;
    amount?: number;
    currency?: Currency;
    description?: string;
  }): Promise<PaymentResult> => {
    txCounter++;
    return {
      success: true,
      transactionId: `shim-tx-${txCounter}`,
      amount: params.amount ?? 0,
      fee: 0,
      timestamp: new Date(),
    };
  };
}
```

### 3. Fix dispose() to clean up ALL services

```typescript
const dispose = async (): Promise<void> => {
  await paymentService.dispose(); // clears expirationCheckInterval
  await currencyService.dispose(); // clears refreshInterval
  await auditLog.dispose(); // clears archiveInterval
  await analyticsService.dispose(); // clears subscriptions + jobs
  await refundService.dispose();
  await subscriptionService.dispose();
  await eventBus.dispose();
  await cache.dispose();
};
```

### 4. Replace real setTimeout with fake timers

```typescript
// BEFORE: 5.1s real wait (91% of test runtime)
await new Promise((resolve) => setTimeout(resolve, 5100));

// AFTER: instant via fake timers
vi.useFakeTimers();
try {
  const jobId = await service.triggerAggregation(AnalyticsPeriod.DAILY);
  vi.advanceTimersByTime(5100);
  const status = await service.getAggregationJobStatus(jobId);
  expect(status?.status).toBe('completed');
} finally {
  vi.useRealTimers();
}
```

### 5. Extract shared helpers from duplicates

```typescript
// 9 copies of getPaymentHistory override → 1 helper
export function overridePaymentHistory(
  harness: PaymentTestHarness,
  txs: PaymentTransaction[]
): void {
  (harness.paymentService as any).getPaymentHistory = async () => txs;
}

// 4 copies of failed payment response → 1 helper
export function installFailedPaymentShim(
  harness: PaymentTestHarness,
  error = 'Payment failed'
): void {
  (harness.paymentService as any).processPayment = async () => ({
    success: false,
    error,
    transactionId: '',
    amount: 0,
    fee: 0,
    currency: Currency.USD,
    status: PaymentStatus.FAILED,
    timestamp: new Date(),
  });
}
```

### 6. Fix plan factory return types (eliminate 20 `as any` casts)

```typescript
// BEFORE: returns {createdAt, updatedAt} but createPlan() expects Omit<..., 'createdAt' | 'updatedAt'>
function makeCreatorPlan(): Omit<SubscriptionPlan, 'id'> & { id?: string } { ... }
service.createPlan(makeCreatorPlan() as any);  // 20 casts

// AFTER: return type matches parameter
type CreatePlanInput = Omit<SubscriptionPlan, 'id' | 'createdAt' | 'updatedAt'>;
function makeCreatorPlan(): CreatePlanInput { ... }
service.createPlan(makeCreatorPlan());  // no cast needed
```

## Impact

| Metric                       | Before | After                                                          |
| ---------------------------- | ------ | -------------------------------------------------------------- |
| Tests using vi.fn() mocks    | 317    | 0                                                              |
| Test runtime                 | ~6s    | 0.6s                                                           |
| Timer handles leaked         | ~1200  | 0                                                              |
| Duplicate test helper blocks | 13     | 0 (4 shared helpers)                                           |
| `as any` casts               | ~85    | ~60 (remaining are justified: private access, monkey-patching) |
| Net lines changed            | —      | +1,898 / -1,827                                                |

## Key Patterns Discovered

### Pattern: Real Services > vi.fn() Mocks for Integration Tests

**When to use:** Service has >5 methods or cross-service interactions.

Wire real service instances with in-memory backends (Map-based cache, no-op logger, in-memory event bus). Tests exercise actual behavior including edge cases mocks would miss.

**Detection rule:** If a test file has >10 `vi.fn()` stubs for a single service interface, it's a candidate for a test harness.

### Pattern: Runtime Guard for Private Field Access

**When to use:** Test code accesses private internals via `as any`.

```typescript
const repo = (service as any).repository;
if (!repo || typeof repo.saveTransaction !== 'function') {
  throw new Error('Internal API changed. Expected .repository.saveTransaction to exist.');
}
```

Fails fast with descriptive error instead of cryptic `TypeError: Cannot read properties of undefined`.

### Pattern: dispose() Must Cover ALL Services

**When to use:** Test harness creates multiple services with timers/intervals.

Every service that starts a `setInterval` or `setTimeout` in its constructor MUST have its `dispose()` called in the harness teardown. Missing even one service leaks handles that accumulate across the test suite.

**Checklist:** Grep for `setInterval` and `setTimeout` in all service constructors. Each one needs a corresponding `dispose()` call.

### Pattern: Factory Return Types Must Match Consumer Parameter Types

**When to use:** Test factories create objects consumed by service methods.

If `createPlan()` expects `Omit<Plan, 'id' | 'createdAt' | 'updatedAt'>`, the factory must return exactly that type — not a superset with extra fields. Extra fields require `as any` casts that mask real type errors.

## Prevention

1. **New payment services**: Add to `createPaymentTestHarness()` immediately — both in the wiring and in `dispose()`
2. **New test helpers**: Add to `payment-test-harness.ts` and export from barrel, not local to individual test files
3. **New service methods**: No action needed — real services automatically include new methods
4. **Timer-based services**: Always verify `dispose()` clears all intervals (grep for `setInterval`/`setTimeout` in constructors)
5. **Factory types**: Define a type alias matching the consumer's parameter type; never use `& { field?: T }` overrides

## Cross-References

- [Backend Test Mock Elimination (broader scope)](../test-failures/backend-test-mock-elimination-20260226.md) — 8 Vitest patterns for Supabase mocks
- [Test Mock Elimination Prevention Strategies](./test-mock-elimination-prevention-strategies-20260226.md) — 5 infrastructure problems
- [Critical Patterns #5a-5d](../patterns/critical-patterns.md) — Payment persistence patterns
- [Common Solutions #7](../patterns/common-solutions.md) — Table-aware Supabase mock routing
- [Common Solutions #41-46](../patterns/common-solutions.md) — Vitest mock patterns
- PR #101 (enum fix), PR #102 (harness + all test rewrites + review findings)
- Todos #539-545 (review findings, all resolved)
