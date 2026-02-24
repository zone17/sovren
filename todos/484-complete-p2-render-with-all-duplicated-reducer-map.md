---
status: pending
priority: p2
issue_id: "484"
tags:
  - code-review
  - msw
  - test-infrastructure
  - phase-9
dependencies: []
---

# renderWithAll() duplicates reducer map from store

## Problem Statement

`render-with-all.tsx` hardcodes the same 6 reducers that `store/index.ts` exports. If a reducer is added/removed from the real store, this wrapper drifts silently. Should import the reducer map from the store.

Additionally, `preloadedState as RootState` is an unsafe type assertion — `Partial<RootState>` is not assignable to `RootState`.

**Consensus: 4/7 review agents flagged duplicated reducers, 2/7 flagged unsafe cast.**

## Proposed Solutions

### Option A: Import rootReducer from store (Recommended)

Export the reducer map from `store/index.ts` and import in `render-with-all.tsx`.
**Pros:** Single source of truth. No drift.
**Cons:** Minor refactor to store exports.
**Effort:** Small
**Risk:** Low

### For type assertion:

Use `configureStore`'s `preloadedState` parameter directly (it accepts `Partial<RootState>` by design when typed correctly).

## Technical Details

**Affected files:**
- `packages/frontend/src/test-utils/render-with-all.tsx`
- `packages/frontend/src/store/index.ts` (add reducer map export)

## Acceptance Criteria

- [ ] Reducer map imported from store, not duplicated
- [ ] `preloadedState as RootState` unsafe cast removed
- [ ] TypeScript compiles without errors

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-24 | Created from Phase 9 MSW review (4/7 agent consensus) | Test wrappers must import from real store to prevent drift |
