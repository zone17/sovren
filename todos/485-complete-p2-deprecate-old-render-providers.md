---
status: pending
priority: p2
issue_id: '485'
tags:
  - code-review
  - msw
  - test-infrastructure
  - phase-9
dependencies:
  - '484'
---

# No deprecation path from renderWithProviders to renderWithAll

## Problem Statement

`renderWithAll()` and `renderWithProviders()` coexist with no deprecation markers. `renderWithProviders()` uses legacy tempStub reducers (postReducer, paymentReducer, cmsReducer) that don't match the real store. New tests won't know which wrapper to use.

**Consensus: 3/7 review agents flagged this.**

## Proposed Solutions

### Option A: Add @deprecated JSDoc to renderWithProviders (Recommended)

Mark `renderWithProviders()` and `renderWithQueryClient()` as `@deprecated` pointing to `renderWithAll()`. Migrate tests gradually.
**Effort:** Trivial
**Risk:** Low

## Technical Details

**Affected files:**

- `packages/frontend/src/test-utils/test-providers.tsx`
- `packages/frontend/src/test-utils/react-query-test-utils.tsx`

## Acceptance Criteria

- [ ] `@deprecated` JSDoc added to `renderWithProviders()` and `renderWithQueryClient()`
- [ ] Deprecation message points to `renderWithAll()` as replacement

## Work Log

| Date       | Action                          | Learnings                                          |
| ---------- | ------------------------------- | -------------------------------------------------- |
| 2026-02-24 | Created from Phase 9 MSW review | Multiple test wrappers need clear deprecation path |
