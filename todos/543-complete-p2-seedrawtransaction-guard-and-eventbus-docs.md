---
status: complete
priority: p2
issue_id: '543'
tags: [code-review, test-infrastructure, data-integrity, pr-102]
dependencies: []
---

# P2: Add runtime guard to seedRawTransaction + document TestableEventBus limitation

## Problem Statement

Two fragile patterns in the harness lack defensive programming:

1. `seedRawTransaction` accesses a private field with no validation — silent `undefined.saveTransaction()` crash if internals change
2. `TestableEventBus.emit()` silently swallows events (no subscriber notification, no event store) — tests pass but would fail with real event processing

## Findings

**Agent consensus: 5/8 agents flagged seedRawTransaction, 2/8 flagged TestableEventBus**

### seedRawTransaction (5 agents):

```typescript
const repo = (paymentService as any).repository;
await repo.saveTransaction(tx);
```

If `repository` is renamed, this silently fails with `TypeError: Cannot read properties of undefined`.

### TestableEventBus.emit() (2 agents):

```typescript
async emit(type: string, data: any): Promise<void> {
  this.capturedEmits.push({ type, data });
  // Does NOT call super.emit() or publish() — subscribers never notified
}
```

Events from SubscriptionService are captured but not processed. If event payload shapes are wrong, tests pass but production fails.

## Proposed Solutions

### Solution A: Runtime guards + JSDoc documentation (Recommended)

**Effort:** Small (15 min) | **Risk:** None

1. Add defensive check in seedRawTransaction:

```typescript
const repo = (paymentService as any).repository;
if (!repo || typeof repo.saveTransaction !== 'function') {
  throw new Error(
    'seedRawTransaction: PaymentProcessingService internal API changed. ' +
      'Expected (paymentService as any).repository.saveTransaction to exist.'
  );
}
```

2. Add JSDoc warning on seedRawTransaction listing safe methods after use.

3. Add JSDoc on TestableEventBus.emit() documenting that events are captured but NOT processed — subscribers won't fire. Reference the pre-existing SubscriptionService.emit() interface mismatch.

4. Improve seedCompletedTransaction error message to include input params.

5. Add TODO tracking the SubscriptionService emit→publish fix as separate scope.

## Acceptance Criteria

- [ ] seedRawTransaction fails fast with descriptive error if private API changes
- [ ] seedCompletedTransaction error includes userId, amount, method
- [ ] TestableEventBus.emit() has JSDoc warning about event swallowing
- [ ] TODO added for SubscriptionService emit→publish fix

## Technical Details

**Affected files:**

- `packages/backend/src/test-utils/payment-test-harness.ts`

## Resources

- Agent-Native Reviewer: Finding #3
- Data Integrity Guardian: Finding #3, #6
- Architecture Strategist: Risk #1
- Kieran TypeScript Reviewer: Finding #2
- Pattern Recognition: Finding #2e
