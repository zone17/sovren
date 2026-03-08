---
status: pending
priority: p3
issue_id: 690
tags: [code-review, event-bus, technical-debt]
dependencies: [681]
---

# InvoiceService still uses emit() — partial EventBus migration

## Problem Statement

SubscriptionService was aligned to `publish()` in this PR, but InvoiceService still has 7 `eventBus.emit()` calls. Leaves codebase in split state.

**Consensus: 1/8 agents noted (Pattern Recognition). Informational — tracked as tech debt.**

## Recommended Action

Track for future migration. The TestableEventBus `emit()` shim handles this correctly for now.

## Work Log

| Date       | Action                                    | Learnings                     |
| ---------- | ----------------------------------------- | ----------------------------- |
| 2026-03-07 | Created from /workflows:review of PR #146 | Not blocking — shim covers it |
