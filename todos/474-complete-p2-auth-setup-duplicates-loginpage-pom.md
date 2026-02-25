---
status: complete
priority: p2
issue_id: '474'
tags:
  - code-review
  - playwright
  - e2e-testing
  - dry-violation
dependencies: []
---

# auth.setup.ts Duplicates LoginPage POM Logic

## Problem Statement

`auth.setup.ts` (lines 9-19) contains 4 inline locator calls that are semantically identical to `LoginPage.goto()` + `LoginPage.loginWithEmail()`:

```typescript
// auth.setup.ts - duplicated inline
await page.goto('/login');
await page.getByRole('button', { name: /Email/ }).click();
await page.getByLabel('Email address').fill('e2e-creator@sovren.app');
await page.getByLabel('Password').fill('testpassword123');
await page.getByRole('button', { name: /Sign In with Email/ }).click();
```

If any locator changes (e.g., Email tab label), `auth.setup.ts` breaks independently from `LoginPage` POM.

## Findings

**Agent consensus: 4/7** (kieran-typescript, pattern-recognition, code-simplicity, architecture)

- DRY violation: exact same locator chain exists in LoginPage POM
- Maintenance risk: selector changes must be updated in 2 places

## Proposed Solutions

### Option A: Use LoginPage POM in auth.setup.ts (Recommended)

```typescript
import { LoginPage } from './pages/login.page';

setup('authenticate as creator', async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.loginWithEmail(CREATOR_CREDENTIALS.email, CREATOR_CREDENTIALS.password);
  await expect(page).toHaveURL(/\/profile/);
  await page.context().storageState({ path: authFile });
});
```

- Pros: Single source of truth for login selectors, 5 lines → 4 lines
- Cons: Adds import dependency
- Effort: Small (5 min)
- Risk: Low

## Technical Details

**Affected files:**

- `packages/frontend/e2e/auth.setup.ts` (lines 9-19)

## Acceptance Criteria

- [ ] auth.setup.ts imports and uses LoginPage POM
- [ ] No inline locator calls duplicating POM methods
- [ ] Setup project still passes
- [ ] All 17 tests still pass

## Work Log

| Date       | Action                          | Outcome                                                                 |
| ---------- | ------------------------------- | ----------------------------------------------------------------------- |
| 2026-02-24 | Identified by 4/7 review agents | Confirmed P2 - DRY violation                                            |
| 2026-02-24 | Verified against source         | ALREADY FIXED — auth.setup.ts already uses LoginPage + test-credentials |
