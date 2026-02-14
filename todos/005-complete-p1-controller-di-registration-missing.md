---
status: pending
priority: p1
issue_id: 005
tags: [code-review, architecture]
dependencies: []
---

# Controller Dependency Injection Registration Missing

## Problem Statement

v1 API controllers (ContentController, PaymentController, UserController) are NOT registered in the DI container. Route files call container.get(TYPES.ContentController) but no binding module registers these. This causes runtime crash on any v1 API request.

## Findings

Architecture-strategist found controllers use inversify decorators (@injectable, @inject) but the container is custom-built and ignores these decorators. No controllers.bindings.ts exists. TYPES.ts defines tokens but no binding module registers them. Additionally, inversify is imported but serves no purpose.

## Proposed Solutions

### Option A: Factory Registration Module

Create controllers.bindings.ts with factory registrations and register in bootstrap.ts. Remove inversify imports.

**Pros:** Aligns with existing custom container, removes unused dependency, clear migration path
**Cons:** Manual registration for each controller, less automatic than reflection-based DI
**Effort:** Medium
**Risk:** Low

### Option B: Switch to Inversify Container

Switch to inversify as the actual DI container.

**Pros:** Automatic decorator-based registration, mature ecosystem, less boilerplate
**Cons:** Major architectural change, requires refactoring all DI code, high risk
**Effort:** Large
**Risk:** High

## Technical Details

**Affected Files:**

- packages/backend/src/controllers/content/ContentController.ts
- packages/backend/src/controllers/payment/PaymentController.ts
- packages/backend/src/controllers/user/UserController.ts
- packages/backend/src/container/ (missing controllers.bindings.ts)

## Acceptance Criteria

- [ ] All v1 API endpoints respond without "Service not registered" errors
- [ ] Controllers are properly wired through DI container
- [ ] No unused inversify imports
- [ ] All controller dependencies are correctly injected
- [ ] Integration tests pass for all controller endpoints

## Work Log

- 2026-02-11: Created from /workflows:review multi-agent code review
