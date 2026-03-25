---
status: pending
priority: p3
issue_id: '415'
tags: [code-review, quality, testing, pr-87]
dependencies: []
---

# test-providers.tsx interfaces diverge from actual types

## Problem Statement

The `test-providers.tsx` file redefines `TestUser`, `TestPost`, `TestPayment`, and `TestContentItem` interfaces locally instead of importing from the shared types package. This PR updates these local interfaces to fix type errors, but the interfaces may drift again as the shared types evolve.

## Findings

- `test-providers.tsx` defines 4 local interfaces: `TestUser`, `TestPost`, `TestPayment`, `TestContentItem`
- These were updated to match the current shared types (e.g., `TestUser` now has `username`, `display_name`, `bio`, `avatar_url`, `nostr_pubkey` as required)
- The `getCmsState()` result now uses `as unknown as ReturnType<typeof cmsReducer>` -- a double cast that may hide type mismatches
- Local interfaces will drift from shared types as the project evolves

## Proposed Solutions

### Option 1: Import from shared types

**Approach:** Replace local `TestUser` etc. with imports from `@shared/types`.

**Pros:**

- Single source of truth
- No drift risk

**Cons:**

- May need `Partial<>` wrapper since test data is often incomplete

**Effort:** 30 minutes

**Risk:** Low

---

### Option 2: Accept local interfaces

**Approach:** Keep local interfaces as test-specific shapes.

**Pros:**

- Test data doesn't need to satisfy all production type constraints

**Cons:**

- Drift risk continues

**Effort:** 0 minutes

**Risk:** Low (test-only)

## Recommended Action

Low priority. Accept for this PR, consider importing shared types in a future test infrastructure cleanup.

## Technical Details

**Affected files:**

- `packages/frontend/src/test-utils/test-providers.tsx:60-98`

## Acceptance Criteria

- [ ] Decision documented

## Work Log

### 2026-02-20 - Code Review Discovery

**By:** Claude Code (PR #87 review)

## Resources

- **PR:** #87
