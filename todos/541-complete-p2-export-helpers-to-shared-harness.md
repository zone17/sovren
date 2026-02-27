---
status: complete
priority: p2
issue_id: '541'
tags: [code-review, agent-native, test-infrastructure, pr-102]
dependencies: []
---

# P2: Export installSubscriptionPaymentShim + makeDomainEvent to shared harness

## Problem Statement

Two commonly-needed test helpers are trapped in individual test files, not importable by other agents or future test files. This is a "Context Starvation" anti-pattern — the harness provides everything except critical workarounds needed for specific services.

Additionally, the harness lacks a usage guide JSDoc documenting per-service setup requirements.

## Findings

**Agent consensus: 3/8 agents (Agent-Native Critical x2, Architecture P2)**

### Trapped helpers:

1. `installSubscriptionPaymentShim()` — SubscriptionService.test.ts:34-49, bridges processPayment param mismatch
2. `makeDomainEvent()` — PaymentAnalyticsService.test.ts:25-41, creates well-formed DomainEvent objects

### Architecture note:

The existing `DomainEventBuilder` class in `IEventBus.ts:142` could replace `makeDomainEvent()`, but requires 5+ chained method calls. A thin wrapper using `DomainEventBuilder` internally would be ideal.

## Proposed Solutions

### Solution A: Move both helpers to payment-test-harness.ts (Recommended)

**Effort:** Small (15 min) | **Risk:** None

1. Move `installSubscriptionPaymentShim()` to harness, export from barrel
2. Create `makeDomainEvent()` wrapper around `DomainEventBuilder` in harness, export from barrel
3. Add module-level JSDoc with per-service setup guide
4. Update imports in SubscriptionService.test.ts and PaymentAnalyticsService.test.ts

### Solution B: Create separate test-utils files

**Effort:** Medium (20 min) | **Risk:** None

- `test-utils/subscription-payment-shim.ts`
- `test-utils/domain-event-factory.ts`

More modular but adds file count.

## Acceptance Criteria

- [ ] Both helpers importable from `../test-utils` barrel
- [ ] JSDoc usage guide at top of payment-test-harness.ts
- [ ] Existing 317 tests still pass
- [ ] `installSubscriptionPaymentShim` has TODO(ticket) for source fix expiration

## Technical Details

**Affected files:**

- `packages/backend/src/test-utils/payment-test-harness.ts`
- `packages/backend/src/test-utils/index.ts`
- `packages/backend/src/services/payment/__tests__/SubscriptionService.test.ts`
- `packages/backend/src/services/payment/__tests__/PaymentAnalyticsService.test.ts`

## Resources

- Agent-Native Reviewer: Findings #1, #2, #4
- Architecture Strategist: Recommendation #2
