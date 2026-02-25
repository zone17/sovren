---
status: complete
priority: p2
issue_id: '475'
tags:
  - code-review
  - playwright
  - e2e-testing
  - locator-fragility
dependencies: []
---

# ProfilePage.userName Uses Fragile CSS Selector

## Problem Statement

`ProfilePage.userName` at `profile.page.ts:11` uses `page.locator('h1').first()` — a fragile CSS positional selector that breaks if any `h1` element is added above the user name in the DOM. This same anti-pattern is duplicated inline at `navigation.spec.ts:53`.

Every other locator in the suite (26 of 28) uses role-based locators (`getByRole`, `getByLabel`, `getByText`). These 2 instances are the only CSS selector exceptions.

## Findings

**Agent consensus: 5/7** (kieran-typescript, architecture, pattern-recognition, agent-native, code-simplicity)

- Fragile: matches any first `h1`, breaks silently on DOM changes
- Duplicated: same locator appears in `navigation.spec.ts:53` instead of using the POM
- Inconsistent: only CSS selector in an otherwise role-based suite

## Proposed Solutions

### Option A: Add data-testid to Profile component (Recommended)

Add `data-testid="profile-username"` to `Profile.tsx` and use in POM:

```typescript
this.userName = page.getByTestId('profile-username');
```

Also update `navigation.spec.ts:53` to use `ProfilePage.userName` instead of inline locator.

- Pros: Stable, explicit, resilient to DOM changes
- Cons: Adds test-id attribute to production code
- Effort: Small
- Risk: Low

### Option B: Use role-based locator with accessible name

```typescript
this.userName = page.getByRole('heading', { level: 1 });
```

- Pros: No production code change
- Cons: Still fragile if multiple h1s exist (less fragile than `.first()` though)
- Effort: Small
- Risk: Low

## Technical Details

**Affected files:**

- `packages/frontend/e2e/pages/profile.page.ts` (line 11)
- `packages/frontend/e2e/navigation.spec.ts` (line 53 — should use ProfilePage POM instead)
- `packages/frontend/src/pages/Profile.tsx` (if adding data-testid)

## Acceptance Criteria

- [ ] ProfilePage.userName uses a non-positional locator
- [ ] navigation.spec.ts uses ProfilePage.userName instead of inline locator
- [ ] Zero `page.locator('h1')` patterns remain in the suite
- [ ] All 17 tests still pass

## Work Log

| Date       | Action                          | Outcome                                                                    |
| ---------- | ------------------------------- | -------------------------------------------------------------------------- |
| 2026-02-24 | Identified by 5/7 review agents | Confirmed P2 - flakiness risk                                              |
| 2026-02-24 | Verified against source         | CSS selector already fixed (getByRole). Removed unused authHeading locator |
