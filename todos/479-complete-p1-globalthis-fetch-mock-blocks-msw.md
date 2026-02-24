---
status: pending
priority: p1
issue_id: "479"
tags:
  - code-review
  - msw
  - test-infrastructure
  - phase-9
dependencies: []
---

# globalThis.fetch mock blocks MSW interception

## Problem Statement

`globalThis.fetch = vi.fn()` at line 255 of `test-utils/vitest-frontend-setup.ts` replaces the native `fetch` function with a Vitest mock. MSW works by intercepting the real `fetch` — when it's replaced by a mock, MSW handlers are effectively dead code. This is the #1 blocker for Phase 9 migration.

**Consensus: 7/7 review agents flagged this as P1.**

## Findings

### Evidence

- `vitest-frontend-setup.ts:255` — `globalThis.fetch = vi.fn()` runs in `beforeEach`, overwriting fetch before every test
- MSW `server.listen()` runs in `beforeAll`, setting up interception on the real fetch
- The `beforeEach` fetch mock runs AFTER `beforeAll`, destroying MSW's interception every test
- No test currently exercises MSW handlers (zero consumers), so this conflict is invisible

### Impact

- All 8 MSW handler files (~50 endpoints) are unreachable
- Any test migration to MSW will silently fail — handlers match but responses come from `vi.fn()` returning undefined
- Debugging will be extremely confusing (no errors, just undefined responses)

## Proposed Solutions

### Option A: Remove globalThis.fetch mock entirely (Recommended)

**Pros:** Clean — MSW owns all fetch interception. Tests that need fetch errors use `server.use()` overrides.
**Cons:** Any test that asserts on `fetch.mock.calls` will break (need to audit first).
**Effort:** Small
**Risk:** Low — grep for `fetch.mock` and `vi.mocked(fetch)` to find affected tests.

### Option B: Conditionally apply fetch mock

Only apply `globalThis.fetch = vi.fn()` when MSW server is NOT listening. Add a global flag.
**Pros:** Backward compatible.
**Cons:** Complex, fragile ordering dependency.
**Effort:** Medium
**Risk:** Medium

## Recommended Action

Option A. Remove the fetch mock. Audit for `fetch.mock` callers first.

## Technical Details

**Affected files:**
- `test-utils/vitest-frontend-setup.ts` (line 255)
- All files in `packages/frontend/src/test-utils/msw/handlers/`

## Acceptance Criteria

- [ ] `globalThis.fetch = vi.fn()` removed from vitest-frontend-setup.ts
- [ ] Grep confirms zero `fetch.mock` or `vi.mocked(fetch)` usage in test files (or those are migrated)
- [ ] MSW handlers verified to intercept requests (add a smoke test)
- [ ] Test baseline unchanged (79 fail / 43 pass or better)

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-24 | Created from Phase 9 MSW review (7/7 agent consensus) | MSW + globalThis.fetch mock = mutual exclusion |

## Resources

- Commit: e0b2cf0 (MSW infrastructure)
- MSW docs: https://mswjs.io/docs/integrations/node
