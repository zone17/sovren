---
status: complete
priority: p2
issue_id: '534'
tags: [code-review, architecture, patterns, quality, pr-100]
dependencies: []
---

# P2: Inline test reducer duplication + shadow store divergence

## Problem Statement

Three test files contain duplicated inline no-op reducer stubs:

1. `test-providers.tsx` (lines 28-49) — `postReducer`, `paymentReducer`, `cmsReducer`
2. `Post.test.tsx` (lines 13-34) — `postSlice`, `paymentSlice`
3. `SimpleContentEditor.test.tsx` — `cmsSlice`

These shadow stores configure `{user, posts, payments, cms}` but the production store has `{ui, cmsUi, navigation, layout, pagination, user}`. Any test asserting against `state.posts`, `state.payments`, or `state.cms` is testing against a store shape that doesn't exist in production.

**Agent consensus**: 4/8 (Architecture Strategist, Pattern Recognition, Simplicity Reviewer, Data Integrity Guardian)

## Findings

### Architecture Strategist

- test-providers.tsx shadow store has `{user, posts, payments, cms}` — production has `{ui, cmsUi, navigation, layout, pagination, user}`
- Components reading `state.cms` always get `undefined` in production (cmsReducer not in real store)

### Pattern Recognition

- 3 different test store patterns across the codebase: test-providers, Post.test local, renderWithAll
- Inconsistency makes it unclear which is "correct"

### Simplicity Reviewer

- Duplicated no-op stubs violate DRY — same 20-line pattern in 3 files

### Data Integrity Guardian

- `state.cms` always returns `undefined` in production since `cmsReducer` is not wired into the real store

## Proposed Solutions

### Option A: Extract shared test reducers to one file (Recommended)

Create `test-utils/test-reducers.ts` with the shared no-op stubs. All test files import from there.

**Pros**: Single source of truth for test stubs, DRY, easy to find and update
**Cons**: Still diverges from production store shape
**Effort**: Small (20 min)
**Risk**: Low

### Option B: Align test stores with production store shape

Import real reducers from `store/index.ts` and only override what tests need. Add `posts`, `payments`, `cms` ONLY if components actually read them.

**Pros**: Tests reflect reality, catches real bugs
**Cons**: May break tests that depend on the shadow shape; larger effort
**Effort**: Medium (1-2 hours)
**Risk**: Medium (test breakage)

### Option C: Defer — already marked deprecated

`test-providers.tsx` has `@deprecated` tag pointing to `renderWithAll()`. Natural migration will happen as tests are updated.

**Pros**: Zero effort, already on the migration path
**Cons**: Duplication persists, new tests might copy the wrong pattern
**Effort**: None
**Risk**: Low

## Recommended Action

Option A for quick dedup, or Option C if `renderWithAll()` migration is happening soon.

## Technical Details

**Affected files:**

- `packages/frontend/src/test-utils/test-providers.tsx` (lines 28-49)
- `packages/frontend/src/pages/Post.test.tsx` (lines 13-34)
- `packages/frontend/src/components/__tests__/SimpleContentEditor.test.tsx`

## Acceptance Criteria

- [ ] No-op reducer stubs defined in exactly one location
- [ ] All test files import stubs from the shared location
- [ ] All existing tests pass

## Work Log

| Date       | Action                                                                                                                                                | Learnings                                                                  |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 2026-02-26 | Created from PR #100 review (8-agent)                                                                                                                 | 4/8 consensus — strongest finding                                          |
| 2026-02-26 | Investigated — all 3 test files already import from tempStubs (no inline duplication). Chose Option C (defer) since test-providers.tsx is @deprecated | Review agents misidentified shared tempStubs imports as inline duplication |

## Resources

- PR #100: https://github.com/zone17/sovren/pull/100
- Production store: `packages/frontend/src/store/index.ts`
