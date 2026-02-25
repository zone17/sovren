---
status: complete
priority: p3
issue_id: '506'
tags:
  - code-review
  - e2e-review
  - playwright
  - consistency
  - cleanup
dependencies: []
---

# P3: E2E consistency improvements bundle

## Problem Statement

7 minor consistency items across the E2E suite. None are bugs or cause failures — all are style/consistency improvements that reduce cognitive load for agents and developers reading the code.

## Findings

### 1. Missing beforeEach in public specs (1/4 consensus)

`home.public.spec.ts` and `wellness.auth.spec.ts` repeat `new WellnessPage(page)` + `goto()` in every test. `navigation.auth.spec.ts` uses `beforeEach` — inconsistent pattern.

### 2. Raw locators in wellness spec (1/4 consensus)

`wellness.auth.spec.ts:17` uses `page.getByText('Something went wrong')` inline instead of a POM locator. Convention is to centralize locators in POMs.

### 3. Import order inconsistency (2/4 consensus)

Some files import `{ test, expect }` and others `{ expect, test }`. Minor but noticeable across 6 spec files.

### 4. Describe block label "(real backend)" (1/4 consensus)

`wellness.auth.spec.ts` uses `(real backend)` in describe label. All E2E tests use real backend — label adds nothing. Other specs don't use this label.

### 5. `as const` on credentials (1/4 consensus)

`test-credentials.ts` exports plain objects. Adding `as const` would make types narrower and prevent accidental mutation.

### 6. Missing `.first()` on heading locators (1/4 consensus)

Some POM heading locators may match multiple elements. Convention (per CLAUDE.md) is to add `.first()` for any locator that may match multiple elements.

### 7. ProfilePage.logout() trivial wrapper (1/4 consensus)

`logout()` is a one-line method calling `this.logoutButton.click()`. Barely adds value over direct locator access. Informational — not actionable unless more methods justify the pattern.

## Proposed Solutions

### Option A: Fix items 1-6, defer item 7 (Recommended)

**Pros:** Improves consistency without removing useful POM methods
**Cons:** Low impact individually
**Effort:** Small (30 min)
**Risk:** None

### Option B: Defer all

**Pros:** No churn
**Cons:** Inconsistencies persist, agents copy inconsistent patterns
**Effort:** None
**Risk:** None

## Recommended Action

Option A — fix items 1-6 in a single commit.

## Technical Details

**Affected files:**

- `packages/frontend/e2e/home.public.spec.ts` — add beforeEach
- `packages/frontend/e2e/wellness.auth.spec.ts` — add beforeEach, move raw locator to POM, remove "(real backend)" label
- `packages/frontend/e2e/pages/wellness.page.ts` — add error boundary locator
- `packages/frontend/e2e/fixtures/test-credentials.ts` — add `as const`
- `packages/frontend/e2e/auth.public.spec.ts` — normalize import order
- `packages/frontend/e2e/auth.setup.ts` — normalize import order
- Various POM files — audit `.first()` usage

## Acceptance Criteria

- [ ] beforeEach pattern used in home.public.spec.ts and wellness.auth.spec.ts
- [ ] Raw locators moved to POMs
- [ ] Import order normalized across all spec files
- [ ] "(real backend)" label removed
- [ ] `as const` added to credential exports
- [ ] `.first()` added where locators may match multiple elements
- [ ] All 20 E2E tests pass

## Work Log

| Date       | Action                                                                                                                                                                                                                                                             | Result   |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| 2026-02-24 | Created from review synthesis (7 items, 1-2/4 consensus each)                                                                                                                                                                                                      | Pending  |
| 2026-02-24 | Fixed items 1-6: beforeEach in home/wellness specs, errorBoundary locator to WellnessPOM, import order normalized, "(real backend)" removed, `as const` on credentials, `.first()` on heading locators. Item 7 (logout wrapper) deferred — functional, not harmful | Complete |

## Resources

- Review: P2/P3 cleanup review of commits 14d0dd1..2eff87b
- Related: [E2E Review P2/P3 Cleanup Sprint](../docs/solutions/code-quality/e2e-review-p2p3-cleanup-sprint-20260224.md)
