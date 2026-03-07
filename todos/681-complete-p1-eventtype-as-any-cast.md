---
status: pending
priority: p1
issue_id: 681
tags: [code-review, typescript, type-safety, event-bus]
dependencies: []
---

# eventType as any cast bypasses type safety in SubscriptionService

## Problem Statement

`SubscriptionService.emitWebhookEvent()` uses `.withType(eventType as any)` to pass `SubscriptionEventType` values to `DomainEventBuilder.withType()`, which expects `DomainEventType`. `SubscriptionEventType` has 18 values but `DomainEventType` only has ~3 matching ones. The remaining 15 event types silently bypass the type system. Subscribers filtering by `DomainEventType` enum will never receive events whose `.type` string has no `DomainEventType` equivalent.

**Consensus: 8/8 review agents flagged this finding.**

## Findings

- **Location:** `packages/backend/src/services/payment/SubscriptionService.ts:1662`
- **Code:** `.withType(eventType as any)`
- **CLAUDE.md violation:** "Eliminate all `any` types. Use proper type definitions, not type assertions."
- **Impact:** Type safety regression. Events like `subscription.paused`, `subscription.trial_started` are published with types that no typed subscriber can match.

## Proposed Solutions

### Option A: Extend DomainEventType enum

Add all `SubscriptionEventType` values to `DomainEventType`. Remove `as any`.

- Pros: Full type safety, subscribers can filter on all event types
- Cons: DomainEventType grows; may need to be a union type
- Effort: Small
- Risk: Low

### Option B: Widen DomainEventBuilder.withType() to accept string

Change `withType(type: DomainEventType)` to `withType(type: string)` with runtime validation.

- Pros: Flexible, no enum bloat
- Cons: Loses compile-time safety on the builder
- Effort: Small
- Risk: Medium (weaker types)

### Option C: Union type DomainEventType | SubscriptionEventType

Change `withType()` signature to accept `DomainEventType | SubscriptionEventType`.

- Pros: Targeted fix, both enums remain separate
- Cons: Must update signature each time a new event type enum is added
- Effort: Small
- Risk: Low

## Recommended Action

Option A or C. Prefer C for minimal blast radius.

## Technical Details

- **Affected files:** `packages/backend/src/services/payment/SubscriptionService.ts`, `packages/backend/src/interfaces/shared/IEventBus.ts`
- **Related:** InvoiceService still uses `emit()` (separate migration tracked as P3)

## Acceptance Criteria

- [ ] `as any` removed from SubscriptionService.ts:1662
- [ ] `DomainEventBuilder.withType()` accepts `SubscriptionEventType` values without cast
- [ ] TypeScript compiles without errors
- [ ] Existing payment tests pass

## Work Log

| Date       | Action                                    | Learnings                              |
| ---------- | ----------------------------------------- | -------------------------------------- |
| 2026-03-07 | Created from /workflows:review of PR #146 | 8/8 agent consensus — strongest signal |

## Resources

- PR #146: feat/squad-a/S9-buffer-hardening
- CLAUDE.md TypeScript Standards section
