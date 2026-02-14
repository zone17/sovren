---
status: pending
priority: p2
issue_id: 077
tags: [code-review, architecture, dead-code]
dependencies: []
---

# Ghost Import lightningReceiptService in server.ts

## Problem Statement

`packages/backend/src/server.ts` references `lightningReceiptService` but never imports it. This is either dead code or a missing import that would cause a runtime ReferenceError if that code path executes.

## Findings

- **Architecture Strategist P1-002**: Referenced but never imported — ghost reference.

## Proposed Solutions

### Option A: Remove the reference (Recommended)

If the service isn't used, delete the reference.
**Effort:** Small | **Risk:** Low

### Option B: Add the missing import

If the service IS needed, add the proper import and DI resolution.
**Effort:** Small | **Risk:** Low

## Acceptance Criteria

- [ ] No undefined references in server.ts
- [ ] Either import added or reference removed
