---
status: pending
priority: p2
issue_id: 685
tags: [code-review, testing, event-bus]
dependencies: []
---

# TestableEventBus.publish() calls super.publish() — unexpected side effects in tests

## Problem Statement

The new `publish()` override in TestableEventBus captures events AND calls `super.publish(event)`, which processes all registered subscribers. The old `emit()` shim intentionally did NOT process events. This behavioral asymmetry means tests using `publish()` may trigger unexpected subscriber side effects, while tests using `emit()` remain isolated.

**Consensus: 6/8 agents flagged (Security, TypeScript, Performance, Architecture, Code Simplicity, Pattern Recognition).**

## Findings

- `packages/backend/src/test-utils/payment-test-harness.ts:68` — `await super.publish(event)`
- The docstring warns about this but the asymmetry is surprising
- Additionally, `capturedPublishes` array (line 58) is never read by any test — dead code (1/8 flagged)

## Proposed Solutions

### Option A: Remove super.publish() call

Capture only, like emit(). Tests that need subscriber processing use the real EventBusService.

- Pros: Consistent behavior, no surprise side effects
- Cons: May break tests that rely on subscriber firing (none currently)
- Effort: Small
- Risk: Low

### Option B: Add processOnPublish flag

Constructor option `{ processOnPublish: boolean }` defaulting to false.

- Pros: Explicit control
- Cons: Over-engineering for current usage
- Effort: Small
- Risk: Low

## Acceptance Criteria

- [ ] TestableEventBus publish behavior is explicit and documented
- [ ] Remove `capturedPublishes` if no test reads it
- [ ] Existing payment tests pass

## Work Log

| Date       | Action                                    | Learnings                             |
| ---------- | ----------------------------------------- | ------------------------------------- |
| 2026-03-07 | Created from /workflows:review of PR #146 | 6/8 consensus on behavioral asymmetry |
