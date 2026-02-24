# Playwright E2E Quick Reference

**One-page summary of correct E2E testing patterns for Sovren**

## The Core Rule

**E2E = Real Browser + Real Backend, Zero Mocks**

```typescript
// ❌ WRONG: Mocking HTTP (this is a component test, not E2E)
await page.route('**/api/wellness/**', (route) => route.abort());

// ✅ RIGHT: Real API calls only
await page.goto('/dashboard');
await page.waitForResponse((r) => r.url().includes('/api/wellness'));
```

---

## Project Structure

```
e2e/
├── auth.setup.ts           # Setup project: authenticate once
├── auth.spec.ts            # Authenticated project: use storage state
├── home.spec.ts            # Public project: no auth needed
├── navigation.spec.ts      # Authenticated: reuse auth
├── pages/
│   ├── login.page.ts       # Page Object Model
│   ├── signup.page.ts
│   ├── home.page.ts
│   └── profile.page.ts
├── global-setup.ts         # Runs before all tests
└── global-teardown.ts      # Runs after all tests
```

---

## Three Project Tiers (playwright.config.ts)

| Tier              | Purpose                        | Auth              | Dependencies |
| ----------------- | ------------------------------ | ----------------- | ------------ |
| **setup**         | Create auth state once         | ✅ logs in        | None         |
| **authenticated** | Run all auth tests in parallel | ✅ reuses storage | `setup`      |
| **public**        | Run public tests independently | ❌ no auth        | None         |

```typescript
projects: [
  {
    name: 'setup',
    testMatch: /\.setup\.ts/,
  },
  {
    name: 'authenticated',
    testMatch: /auth\.spec\.ts|dashboard\.spec\.ts/,
    dependencies: ['setup'],
    use: { storageState: '.auth/user.json' },
  },
  {
    name: 'public',
    testMatch: /home\.spec\.ts/,
  },
];
```

---

## Auth Setup Pattern

```typescript
// e2e/auth.setup.ts
import { expect, test as setup } from '@playwright/test';

setup('authenticate', async ({ page }) => {
  await page.goto('/login');

  // Real login (not mocked)
  await page.getByLabel('Email').fill(process.env.E2E_TEST_EMAIL!);
  await page.getByLabel('Password').fill(process.env.E2E_TEST_PASSWORD!);
  await page.getByRole('button', { name: /Sign In/ }).click();

  // Wait for auth to complete
  await expect(page).toHaveURL(/\/profile/);

  // Save auth state for all other tests
  await page.context().storageState({ path: '.auth/user.json' });
});
```

**Result**: 16 tests run in 6.8s (setup 6.8s + tests in parallel)

---

## Page Object Pattern

```typescript
// e2e/pages/login.page.ts
import type { Locator, Page } from '@playwright/test';

export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.getByLabel('Email address');
    this.passwordInput = page.getByLabel('Password');
    this.submitButton = page.getByRole('button', { name: /Sign In/ });
  }

  async goto() {
    await this.page.goto('/login');
  }

  async loginWithEmail(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }
}

// e2e/auth.spec.ts
test('email login redirects to profile', async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.loginWithEmail('test@example.com', 'password');
  await expect(page).toHaveURL(/\/profile/);
});
```

**Benefits**: Locators in one file, reusable across tests, changes don't break tests

---

## Test Template

```typescript
// ✅ CORRECT: Real E2E test
import { expect, test } from '@playwright/test';
import { DashboardPage } from './pages/dashboard.page';

test('creator views wellness dashboard', async ({ page }) => {
  const dashboard = new DashboardPage(page);

  // Navigate to page
  await dashboard.goto();

  // Wait for real API response (not mock)
  await page.waitForResponse((r) => r.url().includes('/api/wellness') && r.status() === 200);

  // Assert visible state
  await expect(dashboard.wellnessCard).toBeVisible();
  await expect(dashboard.wellnessCard).toContainText('Calories');
});
```

---

## Wait Strategies (Pick One)

| Strategy            | When to Use                     | Example                                                           |
| ------------------- | ------------------------------- | ----------------------------------------------------------------- |
| **waitForURL**      | After navigation or form submit | `await page.waitForURL(/\/profile/);`                             |
| **waitForResponse** | After API call triggers         | `await page.waitForResponse(r => r.url().includes('/api/data'));` |
| **toBeVisible**     | After element appears           | `await expect(locator).toBeVisible();`                            |
| **containsText**    | After text appears              | `await expect(heading).toContainText('Welcome');`                 |

**❌ Never**: `await page.waitForTimeout(2000)` (flaky, arbitrary)

---

## Quick Checklist

Before committing tests:

- [ ] No `page.route()` or `page.fulfill()` (no mocks)
- [ ] All Page Objects created (locators in one file)
- [ ] One focused journey per test (not 5 scenarios in 1 test)
- [ ] Explicit wait strategy (waitForURL, waitForResponse, toBeVisible)
- [ ] No `.skip()` tests (delete or fix, never leave skipped)
- [ ] Tests pass in < 30 seconds (split if longer)
- [ ] Auth setup runs first (project dependencies configured)
- [ ] All tests using real API, not mocks

---

## Common Mistakes

| Mistake                      | Fix                                               |
| ---------------------------- | ------------------------------------------------- |
| Per-test login (slow)        | Use auth.setup.ts + storage state                 |
| Hardcoded selectors in tests | Move to page objects                              |
| `page.route()` mocking       | Use real API, assert real data                    |
| Arbitrary `waitForTimeout()` | Use explicit wait (waitForURL, waitForResponse)   |
| Multiple journeys in 1 test  | Split into 1 test per journey                     |
| Permanently skipped tests    | Delete or fix immediately                         |
| Testing DOM details          | Use user-facing selectors (getByRole, getByLabel) |
| Mock data in code            | Use environment variables (process.env)           |

---

## Key Commands

```bash
# Run all E2E tests
npm run test:e2e

# Run with UI (helpful for debugging)
npm run test:e2e:ui

# Run specific test file
npx playwright test auth.spec.ts

# Run specific test by name
npx playwright test -g "email login"

# Debug mode (step through test)
npx playwright test --debug

# Generate HTML report
npx playwright show-report
```

---

## File: ESM `__dirname` Pattern

All Playwright config and setup files use ESM. To get `__dirname`:

```typescript
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const authFile = path.join(__dirname, 'test-results/.auth/user.json');
```

---

## Gotchas

1. **Playwright runs ALL tests** — `.skip()` and commented tests still exist after your edit, other devs run them
2. **Storage state is per-project** — `authenticated` project must define `storageState: '.auth/user.json'`
3. **Dependencies must be specified** — `authenticated` project needs `dependencies: ['setup']` or tests run before auth completes
4. **Test user must exist** — Ensure test account is seeded in environment before running tests
5. **ESM only** — No `__dirname` from CommonJS; use `import.meta.url`

---

## Success Metrics

| Metric         | Target      | Sovren  |
| -------------- | ----------- | ------- |
| Tests in suite | 16-20 tests | 16 ✅   |
| Runtime        | < 30s       | 6.8s ✅ |
| Auth setup     | < 10s       | 6.8s ✅ |
| Mocked APIs    | 0           | 0 ✅    |
| Skipped tests  | 0           | 0 ✅    |
| Flaky tests    | < 1%        | 0% ✅   |
| Page objects   | All pages   | 5/5 ✅  |

---

## Further Reading

Full documentation: [playwright-e2e-prevention-strategies.md](./playwright-e2e-prevention-strategies.md)

Playwright Docs:

- [Intro](https://playwright.dev/docs/intro)
- [Page Object Model](https://playwright.dev/docs/pom)
- [Auth / Storage State](https://playwright.dev/docs/auth)
- [Best Practices](https://playwright.dev/docs/best-practices)
