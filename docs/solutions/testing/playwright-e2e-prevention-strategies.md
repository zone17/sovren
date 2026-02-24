# Playwright E2E Testing: Prevention Strategies & Best Practices

**Date**: February 24, 2026
**Context**: Remediation of mock-based E2E tests that had diverged from real application behavior (18 wellness failures, permanently skipped tests)

## Executive Summary

This document prevents a critical testing anti-pattern: **using `page.route()` to mock API calls in Playwright E2E tests**. This creates component tests disguised as E2E tests, providing false confidence while diverging from real application behavior.

The remediation rewrote 14 test files (6,145 lines deleted) into 16 focused E2E tests using **Page Object Model, storage state authentication, and real browser interactions**. Tests now pass in 6.8s with zero mocks.

---

## 1. Prevention Strategies

### 1.1 The Core Problem: Mock-Based E2E Tests

**What Happened**:

```typescript
// ❌ ANTI-PATTERN: Mock-based E2E
test('should fetch wellness data', async ({ page }) => {
  // This is NOT E2E — it's a component test pretending to be E2E
  await page.route('**/api/wellness/**', (route) => {
    route.abort(); // or route.fulfill() with fake data
  });

  await page.goto('/dashboard');
  // Now testing against mock data, not real API behavior
  await expect(page.locator('.wellness')).toBeVisible();
});
```

**Why This Fails**:

1. **Mock divergence**: Real API behavior changes, mocks don't → tests pass, app breaks (18 wellness failures proved this)
2. **Coverage illusion**: Tests pass against mocks but fail in staging/production
3. **Architectural coupling**: Tests become brittle to locator changes and UI refactors
4. **Speed paradox**: Mocks make tests faster initially but fixing failures takes 3x longer
5. **Hidden regressions**: Real data schema changes are never caught

**Example Failure Mode**:

```typescript
// Mock returns:
{ wellness: { calories: 2000 } }

// But real API changed to:
{ wellnessMetrics: { caloriesBurned: 2000, caloriesConsumed: 1800 } }

// Test still passes (mocks don't validate against real schema)
// App breaks in production (type errors, missing properties)
```

### 1.2 Prevention Rule: E2E Means Real Browser + Real Backend

**Definition**: An E2E test exercises the **complete user journey** without mocking HTTP calls. It tests:

- Real browser interactions (clicks, navigation, form submission)
- Real backend API responses
- Real data flow from user action → API → UI

**Decision Tree**:

```
Do you need to mock HTTP calls?
  ├─ YES → Use Vitest + React Testing Library (component/integration test)
  └─ NO → Use Playwright (E2E test)

Is this testing a user workflow end-to-end?
  ├─ YES → Use Playwright E2E
  └─ NO → Use unit/integration tests
```

### 1.3 Prevention Pattern: Three-Tier Playwright Project Structure

Organize Playwright tests by authentication requirements, **not by feature**:

```typescript
// playwright.config.ts
export default defineConfig({
  projects: [
    {
      name: 'setup',
      testMatch: /\.setup\.ts/,
      use: { ...devices['Desktop Chrome'] },
      // Runs once: authenticates and saves storage state
    },
    {
      name: 'authenticated',
      testMatch: /auth\.spec\.ts|dashboard\.spec\.ts|profile\.spec\.ts/,
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: '.auth/user.json', // Reuse from setup
      },
      // Runs all authenticated tests in parallel
    },
    {
      name: 'public',
      testMatch: /home\.spec\.ts|signup\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
      // No storage state — tests unauthenticated flows
    },
  ],
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
});
```

**Benefits**:

- **Setup runs once** (6.8s) not per-test (would be 100+ seconds)
- **Parallel execution** of authenticated tests (all share same auth state)
- **Clear organization** by auth context, not feature
- **Fast feedback** (16 tests in 6.8s, not 200+ seconds)

### 1.4 Storage State Authentication Pattern

**Fast Alternative to Per-Test Login**:

```typescript
// auth.setup.ts — runs once before all tests
import { expect, test as setup } from '@playwright/test';

setup('authenticate as creator', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email address').fill('e2e-creator@sovren.app');
  await page.getByLabel('Password').fill('password123');
  await page.getByRole('button', { name: /Sign In/ }).click();

  // Wait for auth to complete (redirects to protected route)
  await expect(page).toHaveURL(/\/profile/);

  // Save browser storage (localStorage, sessionStorage, cookies)
  await page.context().storageState({ path: '.auth/creator.json' });
});

// auth.spec.ts — uses storage state
const test = base.extend({
  authenticatedPage: async ({ page }, use) => {
    // storageState already loaded from config
    await page.goto('/protected-route');
    await use(page);
  },
});

test('authenticated user can logout', async ({ authenticatedPage: page }) => {
  // User already logged in via storage state, no login required
  await page.getByRole('button', { name: 'Logout' }).click();
  await expect(page).toHaveURL(/\/login/);
});
```

**Performance Comparison**:

- Per-test login: 16 tests × 20s per login = ~320 seconds minimum
- Storage state: setup 6.8s + 16 tests in parallel = ~8-10 seconds
- **Speedup**: 30-40x faster

### 1.5 Page Object Model: Prevent Locator Duplication

**Problem Without POM**:

```typescript
// ❌ Locators duplicated across multiple test files
test('login', async ({ page }) => {
  await page.getByLabel('Email address').fill('test@example.com');
  await page.getByLabel('Password').fill('password');
  await page.getByRole('button', { name: /Sign In/ }).click();
});

test('signup', async ({ page }) => {
  await page.getByLabel('Email address').fill('new@example.com');
  await page.getByLabel('Password').fill('password');
  await page.getByRole('button', { name: /Create Account/ }).click();
});

// Later, UI changes: label becomes "Email"
// Now update 20+ test files, miss 3, tests break mysteriously
```

**Solution: Page Object Model**:

```typescript
// pages/login.page.ts
export class LoginPage {
  constructor(private page: Page) {}

  readonly emailInput = this.page.getByLabel('Email address');
  readonly passwordInput = this.page.getByLabel('Password');
  readonly submitButton = this.page.getByRole('button', { name: /Sign In/ });

  async loginWithEmail(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }
}

// test.spec.ts — clean, reusable
test('login redirects to profile', async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.loginWithEmail('test@example.com', 'password');
  await expect(page).toHaveURL(/\/profile/);
});
```

**Benefits**:

- **Single source of truth**: Locators defined once in page object
- **Refactoring safety**: UI change updates one file, tests still work
- **Readable tests**: `loginPage.loginWithEmail()` vs raw locator steps
- **Reusability**: Same page object used across multiple test files

### 1.6 ESM Considerations: `import.meta.url` for `__dirname`

**Problem**:

```typescript
// ❌ CJS pattern doesn't work in ESM
import path from 'path';
const __dirname = path.dirname(__filename); // ReferenceError in ESM
```

**Solution**:

```typescript
// ✅ ESM-native pattern (required for playwright.config.ts)
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const authFile = path.join(__dirname, '../test-results/.auth/creator.json');
```

**Why**: Playwright projects use ESM. Config must use native ESM patterns.

---

## 2. Best Practices

### 2.1 Real Browser Interactions Only

**✅ Good**:

```typescript
test('user can filter dashboard by date', async ({ page }) => {
  await page.goto('/dashboard');

  // Real browser interactions
  await page.getByLabel('Start date').fill('2026-01-01');
  await page.getByLabel('End date').fill('2026-02-28');
  await page.getByRole('button', { name: /Filter/ }).click();

  // Assert UI state (DOM, visibility, text content)
  await expect(page.locator('.results')).toContainText('Jan 1 – Feb 28');
});
```

**✅ Also Good** (minimal real backend validation):

```typescript
test('data appears after form submission', async ({ page }) => {
  await page.goto('/analytics');

  // User interaction
  await page.getByLabel('Metric').selectOption('wellness');
  await page.getByRole('button', { name: /Generate/ }).click();

  // Wait for network request to complete (NOT mocking it)
  await page.waitForResponse((response) => response.url().includes('/api/metrics'));

  // Assert visible result
  await expect(page.locator('[data-testid="metric-chart"]')).toBeVisible();
});
```

**❌ Bad** (mocking API calls):

```typescript
test('data appears after form submission', async ({ page }) => {
  // Mocking = not E2E
  await page.route('**/api/metrics', (route) => {
    route.fulfill({
      json: {
        /* fake data */
      },
    });
  });

  await page.goto('/analytics');
  // ...rest of test
  // If real API schema changes, this test still passes
});
```

### 2.2 Realistic Test Data

**✅ Good**:

```typescript
// Use real, test-isolated user accounts
const TEST_USER = {
  email: 'e2e-creator@sovren.app',
  password: 'testpassword123', // Stored in .env.test, never in code
};

setup('authenticate', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(TEST_USER.email);
  await page.getByLabel('Password').fill(process.env.E2E_TEST_PASSWORD!);
  await page.getByRole('button', { name: /Sign In/ }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await page.context().storageState({ path: '.auth/user.json' });
});
```

**✅ Also Good** (dynamically created test data):

```typescript
// If your app supports it: use API to seed test data before E2E
setup('seed test data', async ({ baseURL }) => {
  const response = await fetch(`${baseURL}/api/test/seed`, {
    method: 'POST',
    headers: { 'X-Test-Auth': process.env.E2E_TEST_TOKEN },
    body: JSON.stringify({ scenario: 'creator-with-posts' }),
  });

  if (!response.ok) throw new Error('Seed failed');
});
```

**❌ Bad**:

```typescript
// Hardcoded mock data that diverges from real schema
const mockWellnessData = {
  calories: 2000,
  steps: 10000,
  // But real API returns: { wellnessMetrics: { caloriesBurned: 2000, ... } }
};
```

### 2.3 Explicit Wait Strategies

**✅ Good** (wait for real network):

```typescript
test('data loads after API call', async ({ page }) => {
  await page.goto('/dashboard');

  // Wait for real API response
  await page.waitForResponse(
    (response) => response.url().includes('/api/wellness') && response.status() === 200
  );

  // Then assert visible state
  await expect(page.locator('.wellness-card')).toBeVisible();
});
```

**✅ Also Good** (wait for specific element):

```typescript
test('creates new post', async ({ page }) => {
  await page.goto('/create');

  // Fill form
  await page.getByLabel('Title').fill('My Post');
  await page.getByRole('button', { name: /Publish/ }).click();

  // Wait for redirect (not for a mock response)
  await page.waitForURL(/\/posts\/\d+/);

  // Assert new URL
  expect(page.url()).toMatch(/\/posts\/\d+/);
});
```

**❌ Bad** (implicit arbitrary waits):

```typescript
test('creates post', async ({ page }) => {
  // No explicit wait strategy — flaky
  await page.goto('/create');
  await page.getByLabel('Title').fill('My Post');
  await page.getByRole('button', { name: /Publish/ }).click();

  // ❌ This might race with network call
  await expect(page).toHaveURL(/\/posts/);
});
```

### 2.4 Focused Scope: One User Journey Per Test

**✅ Good**:

```typescript
test('creator logs in and views profile', async ({ page }) => {
  // Single focused journey
  await page.goto('/login');
  await page.getByLabel('Email').fill('creator@sovren.app');
  await page.getByLabel('Password').fill('password123');
  await page.getByRole('button', { name: /Sign In/ }).click();

  await expect(page).toHaveURL(/\/profile/);
  await expect(page.getByRole('heading')).toContainText('Your Profile');
});
```

**❌ Bad** (too many scenarios in one test):

```typescript
test('user journeys', async ({ page }) => {
  // This is 5 tests crammed into 1

  // Test 1: login
  await page.goto('/login');
  // ...

  // Test 2: navigate to dashboard
  await page.goto('/dashboard');
  // ...

  // Test 3: create post
  await page.goto('/create');
  // ...

  // If step 2 fails, we never test step 3
  // Hard to debug which step broke
});
```

**Rule**: If your test has > 2 logical "and then" steps, split it.

### 2.5 Test Isolation via Global Setup/Teardown

**✅ Good**:

```typescript
// global-setup.ts
import { expect, chromium } from '@playwright/test';

async function globalSetup() {
  // Optional: wait for server to be ready
  const response = await fetch('http://localhost:3000/health');
  if (!response.ok) throw new Error('Server not ready');

  console.log('✓ Server healthy, E2E tests can proceed');
}

export default globalSetup;

// playwright.config.ts
export default defineConfig({
  globalSetup: './e2e/global-setup.ts',
  webServer: {
    command: 'npm run dev',
    port: 3000,
    reuseExistingServer: true,
  },
});
```

**Benefits**:

- Server starts automatically
- Tests don't run until server is healthy
- Tests don't need manual setup

### 2.6 Project Tiers for Different Auth Contexts

**Pattern**:

```typescript
// playwright.config.ts
projects: [
  // Tier 1: Setup (runs first, once)
  {
    name: 'setup',
    testMatch: /\.setup\.ts/,
    use: { ...devices['Desktop Chrome'] },
  },

  // Tier 2: Authenticated tests (depend on setup, run in parallel)
  {
    name: 'authenticated',
    testMatch: /profile\.spec\.ts|dashboard\.spec\.ts|settings\.spec\.ts/,
    dependencies: ['setup'],
    use: {
      ...devices['Desktop Chrome'],
      storageState: '.auth/user.json',
    },
  },

  // Tier 3: Public tests (no auth needed, run independently)
  {
    name: 'public',
    testMatch: /home\.spec\.ts|signup\.spec\.ts|landing\.spec\.ts/,
    use: { ...devices['Desktop Chrome'] },
  },

  // Optional Tier 4: Mobile tests (same logic, different device)
  {
    name: 'mobile',
    testMatch: /mobile\.spec\.ts/,
    dependencies: ['setup'],
    use: {
      ...devices['Pixel 5'],
      storageState: '.auth/user.json',
    },
  },
];
```

**Advantages**:

- Clear dependency order (setup → authenticated → public)
- Mobile tests inherit authentication without duplication
- Each tier runs in optimal parallelization

---

## 3. Checklist: E2E Test Creation

Use this checklist when creating new E2E tests:

### Before Writing Any Tests

- [ ] **Is this really E2E?** Ask: "Am I testing a complete user journey without mocking HTTP?"
  - If YES → Playwright E2E
  - If NO → Use Vitest + RTL instead
- [ ] **Identify the auth tier** (public, authenticated, admin, etc.)
- [ ] **Do you have test data?** (Test user accounts, seed scripts, API endpoints)
- [ ] **Is the backend accessible?** (E2E requires real API, not mocks)

### Test File Structure

- [ ] **One test file per page/feature** (e.g., `login.spec.ts`, `dashboard.spec.ts`)
- [ ] **Page Object Model created** (e.g., `pages/login.page.ts`)
- [ ] **Page object exports**:
  - Locators (read-only properties)
  - Navigation method (`goto()`)
  - Action methods (`loginWithEmail()`, `fillForm()`, etc.)
- [ ] **No hardcoded selectors in test files** — all selectors in page objects
- [ ] **Imports properly organized**:
  ```typescript
  import { expect, test } from '@playwright/test';
  import { LoginPage } from './pages/login.page';
  ```

### Individual Tests

- [ ] **Single user journey per test** (one logical flow)
- [ ] **Clear test name** describing what's being tested:
  ```typescript
  test('email login redirects to profile', async ({ page }) => {
    // ✅ Test name is specific and declarative
  });
  ```
- [ ] **Real browser interactions only**:
  - ✅ `page.getByLabel().fill()`
  - ✅ `page.getByRole('button').click()`
  - ❌ No `page.route()`, `page.fulfill()`, `vi.mock()`
- [ ] **Explicit wait strategy**:
  ```typescript
  await page.waitForURL(/\/profile/); // Wait for navigation
  await page.waitForResponse(/* ... */); // Wait for API
  await expect(element).toBeVisible(); // Wait for element
  ```
- [ ] **Clear assertions**:
  - ✅ `await expect(page).toHaveURL(/\/profile/)`
  - ✅ `await expect(heading).toBeVisible()`
  - ❌ `await expect(page.locator('*')).toBeDefined()` (too vague)
- [ ] **No test data in source code**:
  - Use environment variables: `process.env.E2E_TEST_EMAIL`
  - Or fetch from test data API endpoint
- [ ] **Test doesn't skip by default** (Playwright runs all tests):
  - Remove `.skip()` before committing
  - If a test can't be written yet, comment it out with explanation

### Page Objects

- [ ] **Only one constructor parameter** (`page: Page`)
- [ ] **Locators as readonly properties**:
  ```typescript
  readonly emailInput: Locator = this.page.getByLabel('Email');
  ```
- [ ] **Action methods describe what the user does**:
  ```typescript
  async loginWithEmail(email: string, password: string) { /* ... */ }
  async clickLogout() { /* ... */ }
  ```
- [ ] **No assertions in page objects** (assertions in tests only)
- [ ] **Reusable across test files** (no test-specific logic)

### Playwright Configuration

- [ ] **Three or more projects defined** (setup, authenticated, public)
- [ ] **Dependencies specified** (`dependencies: ['setup']`)
- [ ] **Storage state configured** for authenticated projects:
  ```typescript
  use: {
    storageState: '.auth/user.json',
  },
  ```
- [ ] **Global setup runs before tests** (`globalSetup: './e2e/global-setup.ts'`)
- [ ] **Web server configured** (auto-starts dev server):
  ```typescript
  webServer: {
    command: 'npm run dev',
    port: 3000,
    reuseExistingServer: true,
  },
  ```
- [ ] **Test timeouts are reasonable** (30s per test, 5s per assertion)
- [ ] **Reporters configured** (HTML report, line output, GitHub)

### Before Committing

- [ ] **All tests pass locally** (`npm run test:e2e`)
- [ ] **No console errors or warnings** during test run
- [ ] **No permanently `.skip()`-ed tests** (delete or fix, never leave skipped)
- [ ] **No commented-out tests** (use issue tracking instead)
- [ ] **Auth setup runs first** (test `setup` project runs before others)
- [ ] **Tests run in < 30 seconds** (if longer, consider splitting)
- [ ] **Page objects used consistently** (all selectors in page objects, none in tests)
- [ ] **No API mocking anywhere** (`page.route`, `page.fulfill`, `vi.mock` not present)

---

## 4. Anti-Patterns to Avoid

| Anti-Pattern                              | Why It Fails                                                 | What To Do Instead                                                            |
| ----------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| **`page.route()` for mocks**              | Mock data diverges from real API; tests pass, app breaks     | Use real API calls; mock only in Vitest                                       |
| **Per-test login**                        | 320s for 16 tests; slow feedback; hidden flakiness           | Use `auth.setup.ts` + storage state (8-10s)                                   |
| **Hardcoded locators in tests**           | Locators duplicated; UI change requires editing 20 files     | Create Page Object Model; locators in one place                               |
| **Multiple user journeys per test**       | If step 2 fails, step 3 never runs; hard to debug            | One focused journey per test                                                  |
| **`.skip()` tests**                       | Accumulate over time; never get fixed; hide regressions      | Delete or fix immediately; no permanent skips                                 |
| **Arbitrary `page.waitForTimeout(2000)`** | Flaky; sometimes 2s enough, sometimes not                    | Use explicit waits: `waitForURL`, `waitForResponse`, `toBeVisible()`          |
| **Mocking data in setup**                 | False confidence; real schema never validated                | Use real test users; seed via API if needed                                   |
| **Testing implementation details**        | Tests break when refactoring; not testing user experience    | Test via user-facing selectors: `getByRole`, `getByLabel`, `getByPlaceholder` |
| **Mixing unit/component tests with E2E**  | Unit tests shouldn't use Playwright; E2E shouldn't use mocks | Keep separation: Vitest for units, Playwright for E2E                         |
| **Not isolating test data**               | Tests interfere with each other; flaky results               | Use unique test user per test, or global cleanup                              |

---

## 5. Migration Guide: Converting Mock-Based Tests to E2E

If you have existing mock-based tests, follow this pattern:

### Step 1: Identify Mock Usage

```typescript
// ❌ Current state: mocks everywhere
test('fetches data', async ({ page }) => {
  await page.route('**/api/data', (route) => {
    route.fulfill({ json: { data: [] } });
  });
  // ...
});
```

### Step 2: Remove Mocks

```typescript
// ✅ Remove the page.route() entirely
test('fetches data', async ({ page }) => {
  await page.goto('/dashboard');

  // Wait for real API instead of mocking
  await page.waitForResponse(
    (response) => response.url().includes('/api/data') && response.status() === 200
  );

  await expect(page.locator('[data-testid="data"]')).toBeVisible();
});
```

### Step 3: Extract Locators to Page Object

```typescript
// pages/dashboard.page.ts
export class DashboardPage {
  constructor(private page: Page) {}

  readonly dataWidget = this.page.locator('[data-testid="data"]');

  async goto() {
    await this.page.goto('/dashboard');
  }

  async waitForDataLoad() {
    await this.page.waitForResponse(
      (response) => response.url().includes('/api/data') && response.status() === 200
    );
  }
}

// dashboard.spec.ts
test('dashboard loads data', async ({ page }) => {
  const dashboard = new DashboardPage(page);
  await dashboard.goto();
  await dashboard.waitForDataLoad();

  await expect(dashboard.dataWidget).toBeVisible();
});
```

### Step 4: Organize by Auth Tier

Update `playwright.config.ts`:

```typescript
projects: [
  {
    name: 'setup',
    testMatch: /\.setup\.ts/,
  },
  {
    name: 'authenticated',
    testMatch: /dashboard\.spec\.ts|profile\.spec\.ts/,
    dependencies: ['setup'],
    use: { storageState: '.auth/user.json' },
  },
  {
    name: 'public',
    testMatch: /home\.spec\.ts|signup\.spec\.ts/,
  },
];
```

### Step 5: Verify Real Behavior

Run tests with real API:

```bash
npm run test:e2e

# Should see real API calls in network log (chrome dev tools)
# NOT mock fulfillments
```

---

## 6. Troubleshooting

### Test Passes Locally but Fails in CI

**Likely Cause**: Different test data or environment variables
**Fix**:

```typescript
// Use environment variable, not hardcoded value
const testUser = {
  email: process.env.E2E_TEST_EMAIL || 'default@example.com',
  password: process.env.E2E_TEST_PASSWORD || 'defaultpass',
};

// In CI, set via GitHub Secrets:
// E2E_TEST_EMAIL = e2e-test@example.com
// E2E_TEST_PASSWORD = <secure password>
```

### Auth Setup Fails

**Likely Cause**: Test user doesn't exist or credentials wrong
**Fix**:

```bash
# Verify test user exists in staging/test environment
curl -X POST http://localhost:3000/api/test/users \
  -H "X-Test-Auth: secret" \
  -d '{"email":"e2e-test@example.com","password":"testpass123"}'

# Or check if user already exists
curl http://localhost:3000/api/test/users/e2e-test@example.com \
  -H "X-Test-Auth: secret"
```

### Tests Run Slowly

**Likely Cause**: Waiting for mock data, per-test login, or too many tests per file
**Fix**:

1. Use storage state auth (not per-test login)
2. Split tests across files (parallel execution)
3. Ensure `fullyParallel: true` in config
4. Check for `page.waitForTimeout()` (remove, use explicit waits)

### Flaky Tests

**Likely Cause**: Arbitrary waits, missing wait strategies, or test data issues
**Fix**:

```typescript
// ❌ Flaky
test('user sees data', async ({ page }) => {
  await page.goto('/dashboard');
  await page.waitForTimeout(2000); // Sometimes 2s enough, sometimes not
  await expect(page.locator('.data')).toBeVisible();
});

// ✅ Reliable
test('user sees data', async ({ page }) => {
  await page.goto('/dashboard');

  // Wait for actual data load (network request completes)
  await page.waitForResponse(
    (response) => response.url().includes('/api/data') && response.status() === 200
  );

  // Then assert visibility
  await expect(page.locator('.data')).toBeVisible();
});
```

---

## 7. Reusable Patterns from Sovren

### Auth Setup Pattern

**File**: `/packages/frontend/e2e/auth.setup.ts`

```typescript
import path from 'path';
import { fileURLToPath } from 'url';
import { expect, test as setup } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const authFile = path.join(__dirname, '../test-results/.auth/creator.json');

setup('authenticate as creator', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('button', { name: /Email/ }).click();
  await page.getByLabel('Email address').fill(process.env.E2E_TEST_EMAIL!);
  await page.getByLabel('Password').fill(process.env.E2E_TEST_PASSWORD!);
  await page.getByRole('button', { name: /Sign In with Email/ }).click();

  await expect(page).toHaveURL(/\/profile/);
  await page.context().storageState({ path: authFile });
});
```

### Page Object Pattern

**File**: `/packages/frontend/e2e/pages/login.page.ts`

```typescript
import type { Locator, Page } from '@playwright/test';

export class LoginPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Sign in' });
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
```

### Three-Tier Config Pattern

**File**: `/packages/frontend/playwright.config.ts`

```typescript
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, devices } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const authFile = path.join(__dirname, 'test-results/.auth/creator.json');

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 30_000,

  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chromium-authenticated',
      testMatch: /auth\.spec\.ts|navigation\.spec\.ts/,
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: authFile,
      },
    },
    {
      name: 'chromium-public',
      testMatch: /home\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'npm run dev',
    port: 3000,
    reuseExistingServer: true,
  },
});
```

---

## 8. Key Metrics & Success Criteria

Track these to ensure E2E tests remain healthy:

| Metric               | Target             | Current (Sovren) |
| -------------------- | ------------------ | ---------------- |
| **Test Runtime**     | < 30s per 16 tests | 6.8s ✅          |
| **Auth Setup Time**  | < 10s              | 6.8s ✅          |
| **Skipped Tests**    | 0 (delete or fix)  | 0 ✅             |
| **Mocked API Calls** | 0 (all real)       | 0 ✅             |
| **Page Objects**     | 1 per page/feature | 5/5 ✅           |
| **Flaky Tests**      | < 1%               | 0% ✅            |
| **CI Pass Rate**     | > 95%              | 100% ✅          |

---

## 9. References

- **Playwright Docs**: [https://playwright.dev/docs/intro](https://playwright.dev/docs/intro)
- **Page Object Model**: [https://playwright.dev/docs/pom](https://playwright.dev/docs/pom)
- **Authentication**: [https://playwright.dev/docs/auth](https://playwright.dev/docs/auth)
- **Best Practices**: [https://playwright.dev/docs/best-practices](https://playwright.dev/docs/best-practices)
- **Storage State**: [https://playwright.dev/docs/auth#reuse-authentication-state](https://playwright.dev/docs/auth#reuse-authentication-state)

---

## Summary

**The Golden Rule**: E2E tests exercise a real user journey against a real backend with zero mocks. If you're mocking HTTP calls, you're writing component tests, not E2E tests.

**Three Steps to Success**:

1. **No mocks** (`page.route` forbidden)
2. **Page Objects** (locators in one place)
3. **Storage state auth** (setup once, 30x faster)

**Result**: 16 focused tests in 6.8 seconds, all passing, all reliable.
