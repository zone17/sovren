# Playwright E2E: Anti-Patterns Catalog

**Reference for identifying and fixing bad E2E test patterns**

---

## Anti-Pattern #1: Mock-Based E2E Tests (`page.route()`)

**Severity**: P1 (Critical) — Creates false confidence, app breaks in production

### The Problem

```typescript
// ❌ ANTI-PATTERN: Using page.route() to mock API calls
test('dashboard shows wellness data', async ({ page }) => {
  // This is NOT E2E — it's a component test with Playwright
  await page.route('**/api/wellness/**', async (route) => {
    await route.fulfill({
      json: {
        wellness: { calories: 2000, steps: 10000 },
      },
    });
  });

  await page.goto('/dashboard');
  await expect(page.locator('.wellness')).toBeVisible();
  // ✅ Test passes

  // But what if real API changed to:
  // { wellnessMetrics: { caloriesBurned: 2000, stepsWalked: 10000 } }
  // ❌ App breaks in production, test still passes
});
```

### Why It Fails

1. **Mock divergence**: Real API changes, mocks don't → test passes, app breaks
2. **No schema validation**: Mock data structure never matches real API schema
3. **Speed paradox**: Mocks make tests pass faster, but failures take 3x longer to debug
4. **Hidden regressions**: Real changes to API are never caught by tests

### The Right Way

```typescript
// ✅ CORRECT: No mocks, use real API
test('dashboard loads wellness data', async ({ page }) => {
  await page.goto('/dashboard');

  // Wait for REAL API response (not a mock)
  await page.waitForResponse(
    (response) => response.url().includes('/api/wellness') && response.status() === 200
  );

  // Assert visible state
  await expect(page.locator('[data-testid="wellness-card"]')).toBeVisible();
  await expect(page.locator('[data-testid="wellness-card"]')).toContainText('Calories');

  // Now if real API changes schema, test WILL fail (good!)
});
```

### Detection Rule

Search for this pattern:

```bash
grep -r "page.route" packages/frontend/e2e/
grep -r "route.fulfill" packages/frontend/e2e/
grep -r "route.abort" packages/frontend/e2e/
```

If found in E2E tests (not in Vitest), it's wrong.

### How to Fix

1. Delete all `page.route()` calls
2. Wait for real API response: `await page.waitForResponse(...)`
3. Assert UI state, not mock data
4. If test fails with real API, fix the app (test is now catching real bugs!)

---

## Anti-Pattern #2: Per-Test Authentication (Login in Every Test)

**Severity**: P2 (Performance) — Tests are 30-40x slower than necessary

### The Problem

```typescript
// ❌ ANTI-PATTERN: Login in every test
test('creator views profile', async ({ page }) => {
  // This login runs 16 times for 16 authenticated tests = 5-6 minutes total
  await page.goto('/login');
  await page.getByLabel('Email').fill('creator@example.com');
  await page.getByLabel('Password').fill('password123');
  await page.getByRole('button', { name: /Sign In/ }).click();
  await expect(page).toHaveURL(/\/profile/);

  // Only NOW do we start testing
  await expect(page.getByRole('heading')).toBeVisible();
});

test('creator updates profile', async ({ page }) => {
  // Login again (same 20 seconds wasted)
  await page.goto('/login');
  // ... repeat login steps ...

  // Finally test the actual feature
  await page.getByLabel('Bio').fill('New bio');
});

// With 16 authenticated tests:
// 16 tests × 20s per login = 320+ seconds
// + actual test time = 400-500 seconds total
// ❌ Too slow for local development feedback loop
```

### Why It Fails

1. **Slow feedback**: 30-40x slower than needed
2. **Lost time in development**: `npm run test:e2e` takes 5+ minutes per run
3. **Flakiness**: More login attempts = more network calls = more failure points
4. **Unnecessary DB load**: Test environment auth endpoint slows down with repeated logins

### The Right Way

```typescript
// ✅ CORRECT: Auth setup runs ONCE, all tests reuse storage state

// playwright.config.ts
projects: [
  {
    name: 'setup',
    testMatch: /auth\.setup\.ts/,
  },
  {
    name: 'authenticated',
    testMatch: /auth\.spec\.ts|profile\.spec\.ts|dashboard\.spec\.ts/,
    dependencies: ['setup'], // ← Run setup first
    use: {
      storageState: '.auth/creator.json', // ← Reuse auth
    },
  },
];

// e2e/auth.setup.ts
setup('authenticate', async ({ page }) => {
  // This runs ONCE before all authenticated tests
  await page.goto('/login');
  await page.getByLabel('Email').fill(process.env.E2E_TEST_EMAIL!);
  await page.getByLabel('Password').fill(process.env.E2E_TEST_PASSWORD!);
  await page.getByRole('button', { name: /Sign In/ }).click();

  await expect(page).toHaveURL(/\/profile/);

  // Save auth for all other tests
  await page.context().storageState({ path: '.auth/creator.json' });
});

// e2e/profile.spec.ts
test('creator views profile', async ({ page }) => {
  // storageState already loaded from config
  // NO login needed — auth already exists
  await page.goto('/profile');
  await expect(page.getByRole('heading')).toBeVisible();
});

test('creator updates profile', async ({ page }) => {
  // Login already happened in setup
  await page.goto('/profile');
  await page.getByLabel('Bio').fill('New bio');
  // ... test continues ...
});

// Result:
// setup: 6.8s (once)
// 16 tests in parallel: ~6.8s total
// Total: ~8-10 seconds (30x faster!)
```

### Performance Comparison

| Approach       | Time         | Speed            |
| -------------- | ------------ | ---------------- |
| Per-test login | 320+ seconds | ❌ 5+ minutes    |
| Storage state  | 8-10 seconds | ✅ 30-40x faster |

### Detection Rule

Search for login code in test files:

```bash
grep -l "getByLabel.*Email\|goto.*login" packages/frontend/e2e/*.spec.ts
```

If found outside `auth.setup.ts`, it's wrong.

### How to Fix

1. Move all login logic to `auth.setup.ts`
2. Configure `dependencies: ['setup']` in authenticated project
3. Set `storageState: '.auth/user.json'` in authenticated project
4. Remove login code from all test files

---

## Anti-Pattern #3: Hardcoded Locators in Tests

**Severity**: P2 (Maintainability) — Every UI change requires editing 20+ files

### The Problem

```typescript
// ❌ ANTI-PATTERN: Locators duplicated across test files
// e2e/login.spec.ts
test('login works', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email address').fill('test@example.com');
  await page.getByLabel('Password').fill('password');
  await page.getByRole('button', { name: /Sign In with Email/ }).click();
});

// e2e/signup.spec.ts
test('signup works', async ({ page }) => {
  await page.goto('/signup');
  await page.getByLabel('Email address').fill('new@example.com');
  await page.getByLabel('Password').fill('password');
  await page.getByRole('button', { name: /Create Account/ }).click();
});

// e2e/password-reset.spec.ts
test('reset password', async ({ page }) => {
  await page.goto('/forgot-password');
  await page.getByLabel('Email address').fill('test@example.com');
  // ... more locators ...
});

// Problem: Designer changes "Email address" label to "Email"
// Now update:
// - login.spec.ts (1 occurrence)
// - signup.spec.ts (1 occurrence)
// - password-reset.spec.ts (1 occurrence)
// - forgot-password.spec.ts (2 occurrences)
// - profile-edit.spec.ts (3 occurrences)
// Total: 20+ files, 8+ occurrences
// Miss 3, tests mysteriously fail in CI
```

### Why It Fails

1. **Locator fragmentation**: Same selector defined in 20 places
2. **Change risk**: UI change requires edits across entire codebase
3. **Miss rate**: Guaranteed to miss 2-3 occurrences, causing flaky tests
4. **Knowledge loss**: Nobody remembers which files have which locators

### The Right Way

```typescript
// ✅ CORRECT: Page Object Model (locators in one place)

// e2e/pages/login.page.ts
import type { Locator, Page } from '@playwright/test';

export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;

  constructor(page: Page) {
    this.page = page;
    // Locators defined once, reused everywhere
    this.emailInput = page.getByLabel('Email address');
    this.passwordInput = page.getByLabel('Password');
    this.submitButton = page.getByRole('button', { name: /Sign In with Email/ });
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

// e2e/pages/signup.page.ts
export class SignupPage {
  readonly page: Page;
  readonly emailInput: Locator; // ← Reuses same logic
  readonly passwordInput: Locator;
  readonly submitButton: Locator;

  constructor(page: Page) {
    this.page = page;
    // Same selectors for both login and signup
    this.emailInput = page.getByLabel('Email address');
    this.passwordInput = page.getByLabel('Password');
    this.submitButton = page.getByRole('button', { name: /Create Account/ });
  }

  async goto() {
    await this.page.goto('/signup');
  }

  async signupWithEmail(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }
}

// e2e/login.spec.ts
test('login works', async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.loginWithEmail('test@example.com', 'password');
  await expect(page).toHaveURL(/\/profile/);
});

// e2e/signup.spec.ts
test('signup works', async ({ page }) => {
  const signupPage = new SignupPage(page);
  await signupPage.goto();
  await signupPage.signupWithEmail('new@example.com', 'password');
  await expect(page).toHaveURL(/\/profile/);
});

// Now designer changes label to "Email"
// Update ONLY: pages/login.page.ts and pages/signup.page.ts
// All test files still work automatically
```

### Detection Rule

```bash
# If same locator appears in multiple test files, it's wrong
grep -r "getByLabel.*Email" packages/frontend/e2e/*.spec.ts | wc -l
# If > 1, create a page object
```

### How to Fix

1. For each page/feature, create a page object file
2. Move all locators to page object
3. Create action methods (e.g., `loginWithEmail()`)
4. Replace test code with page object calls
5. Delete duplicate locators

---

## Anti-Pattern #4: Multiple User Journeys in One Test

**Severity**: P3 (Debugging) — Hard to know which step failed

### The Problem

```typescript
// ❌ ANTI-PATTERN: Too many scenarios in one test
test('user workflows', async ({ page }) => {
  // Scenario 1: Login
  await page.goto('/login');
  await page.getByLabel('Email').fill('test@example.com');
  await page.getByLabel('Password').fill('password');
  await page.getByRole('button', { name: /Sign In/ }).click();
  await expect(page).toHaveURL(/\/profile/);

  // Scenario 2: Edit profile
  await page.getByRole('link', { name: 'Settings' }).click();
  await page.getByLabel('Bio').fill('New bio');
  await page.getByRole('button', { name: /Save/ }).click();

  // Scenario 3: Create post
  await page.getByRole('button', { name: /Create Post/ }).click();
  await page.getByLabel('Title').fill('My Post');
  await page.getByRole('button', { name: /Publish/ }).click();

  // Scenario 4: View analytics
  await page.getByRole('link', { name: 'Analytics' }).click();
  await expect(page.locator('[data-testid="chart"]')).toBeVisible();

  // If step 2 fails, step 3 and 4 never run
  // Error message doesn't tell you which step broke
  // "expected to have URL matching /posts/" — was it step 1, 2, or 3?
});
```

### Why It Fails

1. **Cascading failures**: If step 2 fails, steps 3-4 never run
2. **Poor debugging**: "Expected URL /posts/" but which step caused it?
3. **Inflated pass rate**: If test fails at step 1, we never find bugs in step 3
4. **Hard to fix**: One broken step requires fixing the whole test, even if the bug is small

### The Right Way

```typescript
// ✅ CORRECT: One focused journey per test

test('user logs in and views profile', async ({ page }) => {
  // Single, focused journey: Login → Profile visible
  await page.goto('/login');
  await page.getByLabel('Email').fill('test@example.com');
  await page.getByLabel('Password').fill('password');
  await page.getByRole('button', { name: /Sign In/ }).click();

  await expect(page).toHaveURL(/\/profile/);
  await expect(page.getByRole('heading')).toContainText('Your Profile');
});

test('user edits profile bio', async ({ page }) => {
  // Single journey: Go to settings → Edit bio → See saved
  // (Auth already exists from storage state)
  await page.goto('/settings');

  await page.getByLabel('Bio').fill('New bio');
  await page.getByRole('button', { name: /Save/ }).click();

  // Verify save succeeded
  await expect(page.locator('[role="alert"]')).toContainText('Saved');
  await expect(page.getByLabel('Bio')).toHaveValue('New bio');
});

test('user publishes new post', async ({ page }) => {
  // Single journey: Create → Publish → View post
  await page.getByRole('button', { name: /Create Post/ }).click();

  await page.getByLabel('Title').fill('My Post');
  await page.getByRole('button', { name: /Publish/ }).click();

  // Verify published
  await page.waitForURL(/\/posts\/\d+/);
  await expect(page.getByRole('heading')).toContainText('My Post');
});

test('user views analytics dashboard', async ({ page }) => {
  // Single journey: Navigate → Verify visible
  await page.goto('/analytics');

  await page.waitForResponse((r) => r.url().includes('/api/analytics'));
  await expect(page.locator('[data-testid="chart"]')).toBeVisible();
});

// Result:
// - 4 tests, each tests ONE thing
// - If test 2 fails, tests 1, 3, 4 still run (catch more bugs)
// - Error message "Bio field should have value" is crystal clear
// - Easy to fix each test independently
```

### Detection Rule

```typescript
// If your test has 3+ "describe" blocks or 5+ async operations, it's too big:
test('...' async ({ page }) => {
  // Setup (1)
  // Action (2)
  // Action (3) ← Already at limit
  // Action (4) ← Too much
  // Action (5) ← Way too much
});
```

### How to Fix

1. Identify each distinct journey (login, edit, submit, etc.)
2. Create separate test for each journey
3. Reuse Page Objects across tests (they share locators)
4. Use `test.beforeEach()` for setup if needed

---

## Anti-Pattern #5: Permanently Skipped Tests

**Severity**: P1 (Technical Debt) — Skipped tests never get fixed, hide regressions

### The Problem

```typescript
// ❌ ANTI-PATTERN: Skipped test is forgotten
test.skip('creator can upload video', async ({ page }) => {
  // This was skipped because:
  // "Video upload feature not ready yet"
  // "Backend API not implemented"
  // "Flaky for unknown reason"
  // BUT IT'S NEVER UNFIXED
  // 3 months later:
  // - Video upload IS implemented
  // - Test still skipped
  // - Nobody remembers why
  // - Feature could have ANY bugs and test won't catch them
});

test.skip('analytics calculation', async ({ page }) => {
  // Another forgotten test
});

test.skip('payment processing', async ({ page }) => {
  // And another
});

// Result: 20+ skipped tests, all important features, all untested
```

### Why It Fails

1. **Accumulation**: Skipped tests pile up over time
2. **Lost context**: Why it was skipped? Forgotten 3 months later
3. **Hidden regressions**: Test might be unblocked but never runs
4. **False confidence**: Dashboard shows "80% tests passing" but ignores 20 skipped tests
5. **Recurring tech debt**: Skip added as quick fix, becomes permanent

### The Right Way

```typescript
// ✅ CORRECT: Delete or fix, NEVER skip permanently

// Option 1: Delete if feature is cancelled
// (Don't keep dead test in codebase)

// Option 2: Fix if feature is ready
test('creator can upload video', async ({ page }) => {
  // Feature is implemented, test passes
  const uploadPage = new UploadPage(page);
  await uploadPage.goto();
  await uploadPage.uploadVideo('./test-video.mp4');

  await page.waitForResponse((r) => r.url().includes('/api/upload'));
  await expect(page.getByRole('alert')).toContainText('Upload complete');
});

// Option 3: Comment with TODO if truly blocked
// (But MUST include link to issue/ticket)
/*
TODO: Uncomment once backend API is deployed
Issue: #1234 - "Implement video upload endpoint"
Status: In progress, ETA Friday

test('creator can upload video', async ({ page }) => {
  // ...
});
*/
```

### Detection Rule

```bash
# Find all skipped tests
grep -r "test.skip\|test.only\|\.skip()" packages/frontend/e2e/
# If found, must be associated with an issue ticket
```

### How to Fix

1. For each skipped test:

   - Find reason it was skipped (check git blame, comments)
   - Is feature implemented now? → Unskip and test
   - Is feature cancelled? → Delete test
   - Is feature still in progress? → Comment with issue link

2. Add pre-commit hook to prevent new `.skip()`:
   ```bash
   # scripts/prevent-skipped-tests.sh
   if grep -r "test.skip\|\.skip()" packages/frontend/e2e/; then
     echo "❌ Error: Found skipped tests"
     echo "Remove .skip() or comment with issue link"
     exit 1
   fi
   ```

---

## Anti-Pattern #6: Arbitrary `waitForTimeout()` Waits

**Severity**: P2 (Flakiness) — Unpredictable, sometimes works, sometimes doesn't

### The Problem

```typescript
// ❌ ANTI-PATTERN: Arbitrary timeout
test('data appears after submit', async ({ page }) => {
  await page.goto('/dashboard');
  await page.getByRole('button', { name: /Filter/ }).click();

  // Wait 2 seconds (arbitrary, flaky)
  await page.waitForTimeout(2000);

  // Sometimes 2s is enough, sometimes not
  // Network slow? Test fails
  // Server delayed? Test fails
  // CPU busy? Test fails
  await expect(page.locator('.data')).toBeVisible();
});
```

### Why It Fails

1. **Environmental dependency**: Same wait time fails on slow CI, passes locally
2. **Flakiness**: 99% of time it works, 1% fails mysteriously
3. **Slow**: If you add 10 such waits, test runs 20 seconds longer than needed
4. **Hidden bugs**: Real network/UI problems masked by arbitrary waits

### The Right Way

```typescript
// ✅ CORRECT: Explicit wait for what you're actually waiting for

// Option 1: Wait for specific network request
test('data appears after submit', async ({ page }) => {
  await page.goto('/dashboard');

  // Start waiting for API response
  const responsePromise = page.waitForResponse(
    (response) => response.url().includes('/api/data') && response.status() === 200
  );

  // Trigger the request
  await page.getByRole('button', { name: /Filter/ }).click();

  // Wait for response to complete
  await responsePromise;

  // Now data is guaranteed to have arrived
  await expect(page.locator('[data-testid="data"]')).toBeVisible();
});

// Option 2: Wait for element to appear
test('loading spinner disappears', async ({ page }) => {
  await page.goto('/dashboard');
  await page.getByRole('button', { name: /Filter/ }).click();

  // Wait for loading spinner to appear
  await expect(page.locator('[data-testid="spinner"]')).toBeVisible();

  // Wait for it to disappear
  await expect(page.locator('[data-testid="spinner"]')).toBeHidden();

  // Now data is ready
  await expect(page.locator('[data-testid="data"]')).toBeVisible();
});

// Option 3: Wait for URL change (after form submit)
test('form redirects after submit', async ({ page }) => {
  await page.goto('/create-post');
  await page.getByLabel('Title').fill('My Post');

  // Trigger submit
  await page.getByRole('button', { name: /Publish/ }).click();

  // Wait for redirect URL
  await page.waitForURL(/\/posts\/\d+/);

  // Now post is created
  await expect(page).toHaveURL(/\/posts\/\d+/);
});

// Option 4: Wait for text to appear
test('success message appears', async ({ page }) => {
  await page.goto('/settings');
  await page.getByLabel('Email').fill('newemail@example.com');
  await page.getByRole('button', { name: /Save/ }).click();

  // Wait for specific text (not arbitrary time)
  await expect(page.locator('[role="alert"]')).toContainText('Saved');
});
```

### Explicit Wait Options Reference

```typescript
// Network
await page.waitForResponse((r) => r.url().includes('/api/...'));
await page.waitForRequest((r) => r.url().includes('/api/...'));

// Navigation
await page.waitForURL(/\/expected-path/);
await page.waitForNavigation();

// Elements
await expect(locator).toBeVisible();
await expect(locator).toBeHidden();
await expect(locator).toContainText('text');
await page.waitForSelector('[data-testid="loaded"]');

// Custom function
await page.waitForFunction(() => {
  return document.querySelectorAll('.item').length > 0;
});
```

### Detection Rule

```bash
# Find all arbitrary timeouts
grep -r "waitForTimeout" packages/frontend/e2e/
# If found, replace with explicit waits above
```

### How to Fix

1. Identify what you're actually waiting for (network, element, URL)
2. Replace `waitForTimeout(2000)` with corresponding explicit wait
3. Test on slow connection (throttle in DevTools) to verify it still works

---

## Anti-Pattern #7: Testing Implementation Details (CSS Classes, Data Attributes)

**Severity**: P3 (Brittleness) — Tests break on unrelated UI refactors

### The Problem

```typescript
// ❌ ANTI-PATTERN: Coupling to implementation details
test('button is disabled', async ({ page }) => {
  // Testing implementation (CSS class) not user experience
  await expect(page.locator('button.disabled-btn')).toHaveClass('disabled-btn');

  // Later, designer refactors CSS:
  // .disabled-btn → .btn--disabled (BEM naming)
  // ❌ Test breaks, but user still sees disabled button
});

test('form validation', async ({ page }) => {
  // Testing internal data structure
  await page.locator('input[data-field-id="email"]').fill('invalid');

  // Check internal error state
  await expect(page.locator('.error-container.email-error')).toBeVisible();

  // Later, error container moved to different component
  // ❌ Test breaks even though validation still works
});
```

### Why It Fails

1. **Brittle**: Tests break on CSS class rename, DOM restructure, etc.
2. **False failures**: Implementation changed, user sees same result, test fails
3. **Confusing**: Debugging becomes: "Test failed but app still works?"
4. **Test maintenance cost**: Half your test maintenance is CSS name changes

### The Right Way

```typescript
// ✅ CORRECT: Test user-facing behavior, not implementation

test('submit button is disabled when form is invalid', async ({ page }) => {
  // Use user-facing attributes, not CSS classes
  const submitButton = page.getByRole('button', { name: /Submit/ });

  // Test user-visible state: button is disabled
  await expect(submitButton).toBeDisabled();

  // Fill with valid data
  await page.getByLabel('Email').fill('test@example.com');

  // Button becomes enabled
  await expect(submitButton).toBeEnabled();
});

test('email field shows error when invalid', async ({ page }) => {
  // Use accessible attributes, not internal data structures
  const emailInput = page.getByLabel('Email');

  // Interact as user would
  await emailInput.fill('invalid-email');
  await emailInput.blur();

  // Verify error is visible to user (not just in DOM)
  // Use accessible error message, not CSS class
  await expect(page.locator('[role="alert"]')).toContainText('Enter valid email');
});

test('form submission disabled while loading', async ({ page }) => {
  const form = page.locator('form');
  const submitButton = page.getByRole('button', { name: /Submit/ });

  // Before submit
  await expect(submitButton).toBeEnabled();

  // Submit form
  submitButton.click();

  // During submission, button should be disabled
  await expect(submitButton).toBeDisabled();
  // Or show loading state to user
  await expect(submitButton).toContainText(/Loading|Submitting/);
});
```

### User-Facing Selectors (Use These)

```typescript
// ✅ User-facing (accessibility-first)
page.getByRole('button', { name: 'Submit' }); // Button user can see
page.getByRole('heading', { level: 1 }); // Page heading
page.getByLabel('Email address'); // Form field
page.getByPlaceholder('Enter email'); // Placeholder text
page.getByText('Error message'); // Visible text
page.getByTitle('Save document'); // Title attribute

// ❌ Implementation details (avoid)
page.locator('button.btn-submit'); // CSS class-dependent
page.locator('input[data-field="email"]'); // Data attribute-dependent
page.locator('.error-container.email-error'); // Multiple CSS classes
page.locator('div.nested.deeply.in.structure'); // DOM structure-dependent
```

### Detection Rule

```bash
# Find CSS-class-dependent selectors
grep -r "locator.*\\..*-" packages/frontend/e2e/ | grep -v "getByRole\|getByLabel"
# Should be rare in well-written E2E tests
```

### How to Fix

1. Replace CSS class selectors with `getByRole`, `getByLabel`, `getByText`
2. Replace data-attribute selectors with accessible equivalents
3. Verify tests still work after DOM/CSS refactors

---

## Summary Table

| Anti-Pattern           | Severity | Detection                     | Quick Fix                                                     |
| ---------------------- | -------- | ----------------------------- | ------------------------------------------------------------- |
| **Mock API calls**     | P1       | `grep "page.route"`           | Delete mocks, use real API                                    |
| **Per-test login**     | P2       | Multiple logins in test files | Move to auth.setup.ts, use storage state                      |
| **Hardcoded locators** | P2       | Same selector in 2+ files     | Create Page Objects                                           |
| **Multiple journeys**  | P3       | Test with 5+ async operations | Split into 1 test per journey                                 |
| **Skipped tests**      | P1       | `grep "test.skip"`            | Delete or fix immediately                                     |
| **Arbitrary waits**    | P2       | `grep "waitForTimeout"`       | Use explicit waits (waitForURL, waitForResponse, toBeVisible) |
| **Testing details**    | P3       | CSS/data selectors in tests   | Use getByRole, getByLabel, getByText                          |

---

## Checklist for Fixing Anti-Patterns

Use this when reviewing tests:

- [ ] No `page.route()` or `page.fulfill()` (zero mocks)
- [ ] No per-test login (use auth.setup.ts + storage state)
- [ ] All selectors in Page Objects (none in test files)
- [ ] One journey per test (focused scope)
- [ ] No `.skip()` tests (delete or fix)
- [ ] Explicit waits only (no `waitForTimeout`)
- [ ] User-facing selectors (getByRole, getByLabel, getByText)
- [ ] Tests pass in < 30 seconds
- [ ] All tests use real API

---

## References

- Full documentation: [playwright-e2e-prevention-strategies.md](./playwright-e2e-prevention-strategies.md)
- Quick reference: [playwright-e2e-quick-reference.md](./playwright-e2e-quick-reference.md)
- Playwright Best Practices: https://playwright.dev/docs/best-practices
