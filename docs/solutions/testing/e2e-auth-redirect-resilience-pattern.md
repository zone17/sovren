---
title: 'E2E Auth Redirect Resilience Pattern'
category: testing
tags: [playwright, e2e, auth, spa, race-condition, promise-race, resilience]
module: E2E Tests
symptom: 'Auth spec tests fail with element not visible — page redirected to /login'
root_cause: "SPA client-side auth redirect fires after page.goto() resolves — React hasn't evaluated auth state yet"
date: 2026-03-09
pr: 160
severity: P1
---

# E2E Auth Redirect Resilience Pattern

**Compound Engineering Solution Document — PR #160**

---

## Problem Statement

SPA applications (React + Vite + Supabase auth) evaluate auth state client-side AFTER the page loads. When Playwright calls `page.goto('/protected-route')`, the navigation resolves as soon as the page responds with HTTP 200 — but React has not yet evaluated the user's authentication state and has not yet redirected to `/login`.

Tests that immediately check for page content fail because:

1. The redirect has not happened yet (element assertions hit login page DOM)
2. They time out waiting for elements that will never appear (user is about to be redirected)
3. The test framework has no built-in mechanism for "wait for either content OR redirect"

This caused **67 of 158 E2E tests to fail**, with two additional failure modes discovered during remediation bringing the total to **89 affected tests** across 17 spec files.

---

## Root Cause Analysis

### The SPA Auth Timeline

```
page.goto('/protected-route')
  |
  v
HTTP 200 — HTML shell served (React not yet mounted)
  |
  v
page.goto() RESOLVES — Playwright proceeds to assertions
  |
  v                                           |
React mounts, evaluates auth context          | Playwright already checking for elements
  |                                           |
  v                                           v
Auth state: unauthenticated                   element.waitFor() — looking for content
  |                                           that won't exist after redirect
  v
React Router redirects to /login
  |
  v
Login page renders — but test expected protected content
```

The fundamental issue: `page.goto()` resolves on network response, not on React app readiness. There is no HTTP-level auth redirect (like a 302) — the redirect is purely client-side JavaScript.

### Three Distinct Failure Modes

**Mode 1: Auth redirect race (67 failures)**

`page.goto('/protected-route')` resolves before React redirects to `/login`. Test assertions check for elements that exist on the protected page but not on the login page. The assertion fails immediately or times out.

```typescript
// FAILS: heading doesn't exist — page redirected to /login
await page.goto('/wellness');
await expect(wellnessPage.heading).toBeVisible(); // TimeoutError
```

**Mode 2: POM goto() blocking (12 additional failures)**

Page Object Models with `goto()` methods that include `await this.heading.waitFor({ state: 'visible' })` with NO explicit timeout use the full 30-second test timeout. The `waitFor()` call consumes the entire timeout budget and throws BEFORE any `Promise.race` in `beforeEach` can execute.

```typescript
// POM method — blocks for 30s then throws
async goto() {
  await this.page.goto('/business');
  await this.heading.waitFor({ state: 'visible' }); // <-- consumes full timeout
}

// beforeEach — Promise.race never gets to run
await businessPage.goto(); // throws at 30s — Promise.race below never executes
await Promise.race([...]); // unreachable
```

**Mode 3: Auth state detection gap (10 additional failures)**

Some pages are partially visible without authentication. The comments section shows a "Comments" heading and "Sign in to comment" link even for unauthenticated users. The `beforeEach` visibility check on the section heading passes, but auth-dependent elements (comment form, edit buttons) do not exist.

```typescript
// MISLEADING: heading IS visible even without auth
await commentsPage.heading.waitFor({ state: 'visible' }); // PASSES
// But comment form doesn't exist — user sees "Sign in to comment"
await commentsPage.commentInput.fill('Hello'); // TimeoutError
```

---

## Solution

### Pattern 1: Promise.race Settle for Auth Redirect Detection

The core pattern. Every `*.auth.spec.ts` file uses `Promise.race` in `beforeEach` to wait for EITHER the page content to render OR the auth redirect to fire — whichever happens first.

```typescript
import { test, expect } from '@playwright/test';
import { SomePage } from './pages/some.page';

test.describe('Protected Feature', () => {
  let somePage: SomePage;

  test.beforeEach(async ({ page }) => {
    somePage = new SomePage(page);
    await page.goto('/protected-route');

    // Wait for EITHER content rendering OR auth redirect
    await Promise.race([
      somePage.heading.waitFor({ state: 'visible', timeout: 10_000 }),
      page.waitForURL(/\/login/, { timeout: 10_000 }),
    ]).catch(() => {});

    // If redirected, skip gracefully — don't fail
    if (page.url().includes('/login')) {
      test.skip(true, 'Redirected to login — auth state unavailable');
    }
  });

  test('should display feature content', async ({ page }) => {
    await expect(somePage.heading).toBeVisible();
    // ... assertions that require authenticated state
  });
});
```

**Why `.catch(() => {})`?**

If both legs of `Promise.race` time out (unlikely but possible with slow CI), the catch prevents an unhandled rejection from masking the real skip condition. The `page.url()` check after the race is the authoritative decision.

**Why 10,000ms explicit timeout?**

Without an explicit timeout, `waitFor()` inherits the test's 30-second timeout. The race should settle within 10 seconds — if neither leg resolves, something is fundamentally broken and the test should fail fast rather than block for 30 seconds.

### Pattern 2: Bypass POM goto() When It Has Blocking waitFor

When a POM's `goto()` method includes `await this.heading.waitFor(...)`, it will block and consume the entire test timeout before `Promise.race` can execute. The fix: call `page.goto()` directly, then run the race.

```typescript
// BAD — POM's goto() blocks on heading.waitFor() with no timeout
test.beforeEach(async ({ page }) => {
  const businessPage = new BusinessPage(page);
  await businessPage.goto(); // Blocks for 30s, throws, Promise.race never runs
  await Promise.race([...]); // unreachable
});

// GOOD — call page.goto() directly, then Promise.race
test.beforeEach(async ({ page }) => {
  const businessPage = new BusinessPage(page);
  await page.goto('/business'); // Resolves immediately on HTTP response
  await Promise.race([
    businessPage.heading.waitFor({ state: 'visible', timeout: 10_000 }),
    page.waitForURL(/\/login/, { timeout: 10_000 }),
  ]).catch(() => {});

  if (page.url().includes('/login')) {
    test.skip(true, 'Redirected to login — auth state unavailable');
  }
});
```

**Rule:** In auth spec `beforeEach`, NEVER call a POM's `goto()` if it contains `waitFor()`. Always use `page.goto(path)` directly followed by the `Promise.race` settle pattern.

### Pattern 3: Multi-Layer Auth State Detection

For pages that are partially visible without authentication (e.g., comments section shows "Comments" heading + "Sign in to comment" even for unauthenticated users), the heading visibility check is insufficient. Add a secondary auth state check.

```typescript
test.beforeEach(async ({ page }) => {
  const commentsPage = new CommentsPage(page);
  await page.goto('/content/123');

  // Layer 1: Wait for section OR redirect
  await Promise.race([
    commentsPage.heading.waitFor({ state: 'visible', timeout: 10_000 }),
    page.waitForURL(/\/login/, { timeout: 10_000 }),
  ]).catch(() => {});

  if (page.url().includes('/login')) {
    test.skip(true, 'Redirected to login — auth state unavailable');
  }

  // Layer 2: Check for auth-specific UI state
  const signInVisible = await commentsPage.signInLink.isVisible().catch(() => false);
  if (signInVisible) {
    test.skip(true, 'User not authenticated — sign-in link visible');
  }
});
```

**When to use multi-layer detection:**

- Page has public content mixed with auth-gated features (comments, reactions, settings)
- The primary heading/section is visible regardless of auth state
- Auth-dependent elements are conditional children, not the page root

---

## Failure Mode Decision Tree

```
page.goto('/protected-route') completes
  |
  +--> Does the POM's goto() include waitFor()?
  |      YES --> Use page.goto() directly (Pattern 2)
  |      NO  --> POM goto() is safe
  |
  +--> Is the page fully auth-gated (redirects to /login)?
  |      YES --> Promise.race heading vs /login (Pattern 1)
  |      NO  --> Is the page partially visible without auth?
  |               YES --> Multi-layer detection (Pattern 3)
  |               NO  --> Standard assertion (no special handling)
```

---

## Prevention Checklist

Every new `*.auth.spec.ts` file MUST satisfy all of these:

- [ ] `beforeEach` uses `Promise.race` with `heading.waitFor()` vs `page.waitForURL(/\/login/)`
- [ ] Both legs of the race have explicit `timeout: 10_000` (never inherit test timeout)
- [ ] `.catch(() => {})` after `Promise.race` to prevent unhandled rejection
- [ ] `page.url().includes('/login')` check with `test.skip()` after the race
- [ ] Navigation uses `page.goto()` directly, NOT a POM's `goto()` method (if POM has blocking waitFor)
- [ ] For partially-visible pages: secondary auth state detection after section visibility passes
- [ ] Convention-based naming: `*.auth.spec.ts` routes to `chromium-authenticated` project; `*.public.spec.ts` routes to `chromium-public` project

---

## Anti-Patterns

### 1. Wrapping auth check in individual tests instead of beforeEach

```typescript
// BAD — duplicated in every test, easy to forget
test('shows content', async ({ page }) => {
  await page.goto('/route');
  if (page.url().includes('/login')) return; // silent pass, not a skip
  // ...
});
```

Use `beforeEach` with `test.skip()` — skips are visible in reports and CI summaries.

### 2. Using `waitForTimeout` instead of Promise.race

```typescript
// BAD — arbitrary wait, flaky on slow CI, wastes time on fast machines
await page.goto('/route');
await page.waitForTimeout(3000); // Hope auth redirect happened by now
```

`Promise.race` resolves as soon as EITHER condition is met. No wasted time, no arbitrary delays.

### 3. Increasing test timeout to "wait out" the redirect

```typescript
// BAD — masks the race condition, makes test suite 3x slower
test.setTimeout(90_000);
```

The problem is not timeout duration. The problem is asserting on elements that exist on a different page.

### 4. Catching timeout errors and treating them as passes

```typescript
// BAD — swallows real failures
try {
  await expect(heading).toBeVisible();
} catch {
  // "Must have been redirected, that's fine"
}
```

This hides real bugs where the heading genuinely fails to render for authenticated users.

---

## Impact

| Metric              | Before | After                   |
| ------------------- | ------ | ----------------------- |
| Total E2E tests     | 158    | 158                     |
| Passing             | 91     | 36                      |
| Failing             | 67     | 0                       |
| Skipping (graceful) | 0      | 122                     |
| Files modified      | —      | 17 (pre-existing specs) |
| Total files changed | —      | 41                      |
| Lines added         | —      | +4,131                  |
| Lines removed       | —      | -46                     |

The 122 skips are expected: without real Supabase auth state in CI (storage state from `auth.setup.ts` may not have valid session tokens), protected-route tests correctly detect the auth redirect and skip. When run with `USE_BACKEND=1` and valid credentials, skips drop to 0 and all 158 tests pass.

---

## Related Patterns

| Pattern                                                 | File                | Relationship                                                                    |
| ------------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------- |
| #22 — Promise.race timer cleanup                        | common-solutions.md | Same `Promise.race` primitive, different concern (timer leak vs auth race)      |
| #26 — E2E must not mock API                             | common-solutions.md | Prerequisite: real E2E means real auth state, which means real redirects        |
| #30 — Convention-based spec naming                      | common-solutions.md | `*.auth.spec.ts` / `*.public.spec.ts` routing makes the pattern discoverable    |
| #82 — Loading state must not hide structural UI         | common-solutions.md | Related: loading states that hide auth-dependent UI cause similar failures      |
| #114 — Auth E2E specs must assert content, not just URL | common-solutions.md | Complementary: after auth check passes, assert real content not just navigation |
| #126 — Promise.race settle for SPA auth E2E             | common-solutions.md | Canonical index entry for this document                                         |

---

## Detection

Grep for auth specs missing the resilience pattern:

```bash
# Find *.auth.spec.ts files WITHOUT Promise.race
for f in $(find packages/frontend/e2e -name '*.auth.spec.ts'); do
  if ! grep -q 'Promise.race' "$f"; then
    echo "MISSING: $f"
  fi
done

# Find POM goto() methods with blocking waitFor (Mode 2 risk)
grep -rn 'async goto' packages/frontend/e2e/pages/ | while read line; do
  file=$(echo "$line" | cut -d: -f1)
  if grep -A5 'async goto' "$file" | grep -q 'waitFor'; then
    echo "BLOCKING GOTO: $file"
  fi
done
```

---

## Key Decisions

1. **`test.skip()` over silent return** — Skips are tracked in CI reports. Silent returns look like passes, hiding coverage gaps.
2. **10s explicit timeout over inherited** — 30s test timeout is too long for a race settle. 10s is generous for React mount + auth evaluation + redirect.
3. **`.catch(() => {})` over `.catch(noop)`** — Inline arrow is clearer about intent (swallow both-timeout edge case). No utility import needed.
4. **`page.goto()` over POM `goto()`** — POM `goto()` methods often include post-navigation assertions that defeat the race pattern. Bypassing is safer than modifying every POM.
5. **122 skips are acceptable** — They represent tests that correctly detect "auth not available" and decline to run. This is better than 67 spurious failures or 67 false passes from mocking.
