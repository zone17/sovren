---
status: complete
priority: p3
issue_id: '499'
tags:
  - code-review
  - playwright
  - e2e-testing
  - yagni
dependencies: []
---

# HomePage.clickCTA() Is a Trivial One-Line Wrapper

## Problem Statement

`clickCTA()` wraps `this.ctaButton.click()` — a single line. The `ctaButton` locator is already public. Only one test calls `clickCTA()`. Every other POM locator in the suite is clicked directly rather than through a wrapper method. This is inconsistent and violates YAGNI.

## Findings

**Agent consensus: 1/4** (code-simplicity-reviewer)

## Proposed Solutions

### Option A: Remove clickCTA() and use locator directly (Recommended)

In `home.page.ts`, remove `clickCTA()`. In `home.spec.ts`, change `await home.clickCTA()` to `await home.ctaButton.click()`.

- Pros: -3 lines, consistent with all other POMs
- Cons: None
- Effort: Small
- Risk: Low

## Technical Details

**Affected files:**

- `packages/frontend/e2e/pages/home.page.ts` (lines 28-30)
- `packages/frontend/e2e/home.spec.ts` (line 27)

## Acceptance Criteria

- [ ] No `clickCTA()` method in HomePage
- [ ] Test uses `home.ctaButton.click()` directly
- [ ] All 20 tests still pass

## Work Log

| Date       | Action                                                   | Outcome                  |
| ---------- | -------------------------------------------------------- | ------------------------ |
| 2026-02-24 | Identified by code-simplicity-reviewer                   | P3 — YAGNI violation     |
| 2026-02-24 | Removed `clickCTA()`, spec uses `home.ctaButton.click()` | Fixed — 20/20 tests pass |
