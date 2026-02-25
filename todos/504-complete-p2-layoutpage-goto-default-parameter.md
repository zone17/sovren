---
status: complete
priority: p2
issue_id: '504'
tags:
  - code-review
  - e2e-review
  - playwright
  - pom
  - misleading-default
dependencies: []
---

# P2: LayoutPage.goto() misleading default parameter

## Problem Statement

`LayoutPage.goto()` defaults to `/profile`, which is misleading — a "layout" page has no canonical URL, and defaulting to `/profile` conflates two different pages. 3 of 4 review agents flagged this independently (pattern-recognition, code-simplicity, kieran-typescript).

## Findings

**Location:** `packages/frontend/e2e/pages/layout.page.ts:28`

```typescript
async goto(path = '/profile') {
  await this.page.goto(path);
}
```

**Evidence:**

- **pattern-recognition-specialist**: "LayoutPage.goto() defaults to /profile — layout is a shared component, not a specific page"
- **code-simplicity-reviewer**: "LayoutPage.goto() misleading default — callers should be explicit"
- **kieran-typescript-reviewer**: "Default parameter hides intent — make path required"
- **Consensus**: 3/4 agents flagged independently

**Current callers** (`navigation.auth.spec.ts`):

- All calls pass explicit paths: `layoutPage.goto('/profile')`, `layoutPage.goto('/')`, etc.
- No caller relies on the default — making it safe to remove.

## Proposed Solutions

### Option A: Make path required (Recommended)

**Pros:** Explicit, no hidden behavior, callers already pass paths
**Cons:** None — all callers already provide paths
**Effort:** Small (2 lines)
**Risk:** None

```typescript
async goto(path: string) {
  await this.page.goto(path);
}
```

### Option B: Remove goto() entirely

**Pros:** LayoutPage isn't a navigable destination; POMs with their own URLs have their own goto()
**Cons:** Breaks navigation.auth.spec.ts which uses layoutPage.goto() for convenience
**Effort:** Small but requires updating spec
**Risk:** Low

## Recommended Action

Option A — remove the default, keep the method.

## Technical Details

- **Affected files:** `packages/frontend/e2e/pages/layout.page.ts`
- **Verification:** `npx playwright test` — all 20 tests pass

## Acceptance Criteria

- [ ] `goto()` parameter is required (no default value)
- [ ] All existing callers still pass explicitly
- [ ] All 20 E2E tests pass

## Work Log

| Date       | Action                                                                  | Result   |
| ---------- | ----------------------------------------------------------------------- | -------- |
| 2026-02-24 | Created from review synthesis (3/4 agent consensus)                     | Pending  |
| 2026-02-24 | Fixed: removed default param, updated caller in navigation.auth.spec.ts | Complete |

## Resources

- Review: P2/P3 cleanup review of commits 14d0dd1..2eff87b
- Related: [E2E Review P2/P3 Cleanup Sprint](../docs/solutions/code-quality/e2e-review-p2p3-cleanup-sprint-20260224.md)
