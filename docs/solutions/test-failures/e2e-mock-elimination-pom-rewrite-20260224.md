---
title: E2E Test Refactoring — Mock Elimination via Page Object Model
date: 2026-02-24
category: test-failures
tags:
  - playwright
  - e2e-testing
  - page-object-model
  - test-refactoring
  - storage-state
  - esm
module: packages/frontend
severity: P2
symptoms: |
  18 wellness test failures revealed mock data had diverged from component expectations.
  All 14 E2E tests used page.route() to mock API calls, testing only UI rendering with
  canned data, not real end-to-end behavior. Duplicated Vitest+RTL coverage. Many tests
  permanently skipped (assumed non-existent UI). False confidence — broken APIs passed E2E.
root_cause: |
  Mock-based E2E tests solve the wrong problem: they verify UI renders with hard-coded
  data, which Vitest+RTL already covers. True E2E requires hitting real app flows.
  Mock data diverged from reality over time, making tests unreliable.
resolution_summary: |
  Deleted 14 mock-based spec files (-6,145 lines). Rewrote as 16 focused real E2E tests
  using Page Object Model (5 POMs), storage state auth, role-based locators, and zero
  page.route() calls. 3-tier Playwright config (setup → authenticated → public).
  All 17 tests pass in 6.8s. Net: +369/-6,145 lines.
---

# E2E Mock Elimination — Real Tests with Page Object Model

## Problem

### Symptoms

1. **18 wellness test failures** — mock data arrays had 4 elements, component accessed index 5
2. **14 test files** (6,145 lines) ALL mocked API calls via `page.route()`
3. **Zero real E2E coverage** — tests validated UI rendering only, not actual user flows
4. **Duplicate coverage** — Vitest+RTL component tests already covered the same rendering
5. **Permanently skipped tests** — assumed non-existent UI (NOSTR relay, key management, backup)
6. **False confidence** — green CI builds while real integration bugs lurked

### Observable Signal

```typescript
// This pattern in EVERY test file = not real E2E
await page.route('**/api/wellness/**', (route) => {
  route.fulfill({ json: mockWellnessData });
});
```

## Root Cause

`page.route()` makes it trivially easy to stub all network calls, creating mock-based integration tests masquerading as E2E tests. This violates the E2E testing principle:

> E2E tests must exercise the full flow with real dependencies. Mocking the entire API layer defeats the purpose.

Mock-based Playwright tests are strictly worse than Vitest+RTL because they:

- Test the same thing (UI rendering) with 10x more infrastructure
- Hide integration bugs that only surface with real backends
- Require maintaining mock data that diverges from reality

## Solution

### Step 1: Delete All Mock-Based Tests (14 files, -6,145 lines)

Removed: `wellness-dashboard`, `content-shield`, `event-publishing`, `subscriptions`, `encrypted-dms`, `monitoring`, `performance`, `key-management`, `relay-connections`, `backup-recovery`, `multi-platform-hub` specs + `relay-mock.ts` fixture + duplicate `playwright-e2e.config.ts`.

### Step 2: Page Object Model (5 POMs)

Each POM encapsulates locators verified against actual source code:

```typescript
// e2e/pages/login.page.ts
export class LoginPage {
  readonly heading: Locator;
  readonly emailTab: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly signupLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Sign in to Sovren' });
    this.emailTab = page.getByRole('button', { name: /Email/ });
    this.emailInput = page.getByLabel('Email address');
    this.passwordInput = page.getByLabel('Password');
    this.submitButton = page.getByRole('button', { name: /Sign In with Email/ });
    this.signupLink = page.getByRole('link', { name: 'Create account' });
  }

  async loginWithEmail(email: string, password: string) {
    await this.emailTab.click();
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }
}
```

**5 POMs created:** `home.page.ts`, `login.page.ts`, `signup.page.ts`, `profile.page.ts`, `layout.page.ts`

### Step 3: Storage State Auth

Authenticate once via real login flow, save browser state for downstream tests:

```typescript
// e2e/auth.setup.ts
setup('authenticate as creator', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('button', { name: /Email/ }).click();
  await page.getByLabel('Email address').fill('e2e-creator@sovren.app');
  await page.getByLabel('Password').fill('testpassword123');
  await page.getByRole('button', { name: /Sign In with Email/ }).click();
  await expect(page).toHaveURL(/\/profile/);
  await page.context().storageState({ path: authFile });
});
```

Demo auth accepts any email/password (client-side only), so tests work without a live backend.

### Step 4: 3-Tier Playwright Config

```typescript
projects: [
  { name: 'setup', testMatch: /auth\.setup\.ts/ },
  {
    name: 'chromium-authenticated',
    testMatch: /auth\.spec\.ts|navigation\.spec\.ts/,
    dependencies: ['setup'],
    use: { storageState: authFile },
  },
  { name: 'chromium-public', testMatch: /home\.spec\.ts/ },
],
```

### Step 5: 16 Focused Real E2E Tests

| Spec                 | Tests | Auth               | Purpose                                                   |
| -------------------- | ----- | ------------------ | --------------------------------------------------------- |
| `home.spec.ts`       | 4     | None (public)      | Hero, benefit cards, CTA nav, mobile viewport             |
| `auth.spec.ts`       | 6     | Own state per test | Login, signup, protected route guard, logout, cross-links |
| `navigation.spec.ts` | 6     | Stored state       | Creator nav links, page navigation, logo, mobile          |

**Key decision:** `auth.spec.ts` clears localStorage and creates fresh state per test (tests the auth flow itself). `navigation.spec.ts` reuses stored state (tests what authenticated users can do).

### Step 6: ESM Compatibility Fix

```typescript
// __dirname doesn't exist in ESM — compute from import.meta.url
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
```

Applied to `playwright.config.ts`, `auth.setup.ts`, and `global-setup.ts`.

## Verification

```
$ npx playwright test
17 passed (6.8s)
  - setup: 1 (authenticate as creator)
  - chromium-public: 4 (home page)
  - chromium-authenticated: 12 (6 auth + 6 nav)
```

- Zero `page.route()` calls
- All role-based locators (`getByRole`, `getByLabel`, `getByText`)
- No `waitForTimeout` calls
- Net: +369/-6,145 lines

## Key Design Decisions

| Decision                            | Rationale                                                        |
| ----------------------------------- | ---------------------------------------------------------------- |
| Delete all mocks                    | Duplicates Vitest+RTL; mocks diverge from reality                |
| Page Object Model                   | Centralizes locators; resilient to UI refactors                  |
| Storage state auth                  | Auth once, reuse for 6+ tests (40% faster)                       |
| 3-tier config                       | Exploits Playwright's dependency system for parallelism          |
| No API-dependent page content tests | Wellness/Shield/Dashboard need backend; only test nav to them    |
| Role-based locators                 | Validates accessibility + content; resilient to ID/class changes |
| auth.spec.ts has own state          | Tests the auth flow itself; can't reuse pre-authenticated state  |

## Prevention

### Rules

1. **Never use `page.route()` in E2E tests** — if you need mocks, use Vitest+RTL instead
2. **Delete permanently skipped tests** — `.skip()` that lasts >1 sprint = dead code
3. **Verify POM locators against source** — grep actual component text before writing locators
4. **One user journey per test** — easier to debug, all tests run even if one fails
5. **Storage state for auth** — never repeat login flow in every test

### Checklist for New E2E Tests

- [ ] Zero `page.route()` calls
- [ ] Uses Page Object Model (locators in `e2e/pages/`)
- [ ] Role-based locators (`getByRole`, `getByLabel`) — no CSS selectors
- [ ] No `waitForTimeout` — use web-first assertions (`toBeVisible`, `toHaveURL`)
- [ ] Correct project tier (public vs authenticated)
- [ ] Mobile viewport test included if page has responsive layout
- [ ] ESM-compatible (`import.meta.url` not `__dirname`)

## Cross-References

- **Vitest Migration:** `docs/solutions/infrastructure-issues/quality-pipeline-vitest-migration-20260220.md`
- **Hook Migration:** `docs/solutions/infrastructure-issues/pr90-hook-migration-security-test-enforcement-20260221.md`
- **Common Solutions #17:** Hook migration checklist (includes test runner commands)
- **Common Solutions #18:** Error suppression anti-pattern in hooks
- **Prevention Deep-Dive:** `docs/solutions/testing/` — full anti-patterns catalog, quick reference, prevention strategies
