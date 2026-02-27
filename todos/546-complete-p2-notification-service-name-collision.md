---
status: pending
priority: p2
issue_id: '546'
tags: [code-review, architecture, naming, pr-103]
dependencies: []
---

# Fix NotificationService name collision between stub and DI implementation

## Problem Statement

PR #103 introduced `notification-service.ts` (25-line stub) which exports `class NotificationService`. However, `NotificationService.ts` (838-line DI-integrated implementation) already exists in the same directory, also exporting `class NotificationService`. On macOS (case-insensitive APFS), these filenames could collide during module resolution.

**Why it matters:** 5/7 review agents flagged this independently. Two classes with the same name in the same directory creates import ambiguity, semantic confusion, and potential case-sensitivity issues across dev (macOS) vs CI (Linux).

## Findings

- `packages/backend/src/services/NotificationService.ts` — 838 lines, implements `INotificationService`, DI-registered via `TYPES.NotificationService`, has BullMQ queue integration, templates, preferences
- `packages/backend/src/services/notification-service.ts` — 25-line stub, logs and discards, NOT DI-registered
- The stub was created to fix broken imports in `lightning-payment-service.ts`, `subscription-management-service.ts`, `payout-management-service.ts`
- The stub has zero consumers currently importing from `./notification-service` (per grep)
- The DI implementation has consumers resolving via the container

## Proposed Solutions

### Option 1: Rename stub to `notification-stub.ts` (Recommended)

**Approach:** Rename the kebab-case stub to make the temporary nature explicit.

**Pros:**

- Eliminates name collision entirely
- Self-documenting (name says "stub")
- Zero risk of macOS case sensitivity issues

**Cons:**

- Need to update any imports (currently zero)

**Effort:** Small (5 min) | **Risk:** Low

### Option 2: Delete the stub, wire consumers to DI container

**Approach:** Remove the stub entirely, have legacy payment services resolve `NotificationService` from the DI container instead of direct instantiation.

**Pros:**

- Eliminates architectural debt
- Aligns with DI pattern used everywhere else

**Cons:**

- Requires refactoring 3 consumer services
- Higher effort for a monitoring baseline PR

**Effort:** Medium (30 min) | **Risk:** Medium

## Acceptance Criteria

- [ ] No two files in `services/` export a class with the same name
- [ ] macOS case-insensitive filesystem verified (both files coexist)
- [ ] All imports resolve correctly

## Work Log

| Date       | Action                      | Learnings                        |
| ---------- | --------------------------- | -------------------------------- |
| 2026-02-26 | Created from PR #103 review | 5/7 agents flagged independently |
