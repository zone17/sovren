---
status: pending
priority: p3
issue_id: 016
tags: [code-review, architecture]
dependencies: []
---

# Resolve vs Get Standardization

## Problem Statement

Container proxy exposes .get() but IServiceContainer interface only defines .resolve(). Route files use .get() which only works via proxy trap, not the typed interface. Also remove dead ServiceTokens class from IServiceRegistry.ts.

## Findings

Architecture-strategist found .get() is an undocumented proxy alias. ServiceTokens class uses different names than TYPES object (e.g., 'IPaymentService' vs 'PaymentProcessingService') and is dead code.

## Proposed Solutions

### Option A: Standardize on .resolve() and remove dead code

**Effort:** Small
**Risk:** Low

Standardize on .resolve() in all route files. Remove .get() proxy trap. Delete ServiceTokens class.

## Technical Details

**Affected Files:** packages/backend/src/container/index.ts, packages/backend/src/routes/v1/\*.ts, packages/backend/src/interfaces/shared/IServiceRegistry.ts

## Acceptance Criteria

- [ ] All route files use .resolve() not .get()
- [ ] No .get() proxy trap
- [ ] ServiceTokens class removed

## Work Log

- 2026-02-11: Created from /workflows:review multi-agent code review
