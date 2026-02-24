# Sovren E2E Testing Documentation

**Complete guide to Playwright E2E testing patterns, prevention strategies, and anti-patterns**

---

## Overview

This directory contains comprehensive documentation for writing high-quality, maintainable Playwright E2E tests based on the Sovren project's remediation from mock-based integration tests to real E2E tests.

**Status**: ✅ All documents created (Feb 24, 2026)

---

## Documents

### 1. **Prevention Strategies & Best Practices** (Primary)

**File**: [`playwright-e2e-prevention-strategies.md`](./playwright-e2e-prevention-strategies.md)
**Length**: 933 lines | **Size**: 28 KB

**What you'll learn**:

- The core problem with mock-based E2E tests
- Prevention rule: E2E = Real Browser + Real Backend
- Three-tier Playwright project structure
- Storage state authentication pattern (30-40x faster)
- Page Object Model for maintainable tests
- ESM considerations for Playwright config
- 8 best practice patterns with code examples
- Complete checklist for E2E test creation
- Troubleshooting guide
- Reusable patterns from Sovren

**Read this if**: You're writing E2E tests or reviewing existing ones

---

### 2. **Quick Reference** (Daily Use)

**File**: [`playwright-e2e-quick-reference.md`](./playwright-e2e-quick-reference.md)
**Length**: 330 lines | **Size**: ~10 KB

**What you'll find**:

- One-page summary of correct E2E patterns
- Project structure overview
- Three project tiers (setup, authenticated, public)
- Auth setup pattern (code only)
- Page Object pattern (code only)
- Test template (copy-paste ready)
- Wait strategies cheat sheet
- Quick checklist (pre-commit)
- Common mistakes lookup table
- Key commands reference
- Gotchas and edge cases

**Use this for**: Quick lookup while coding, daily reference, copy-paste templates

---

### 3. **Anti-Patterns Catalog** (Debugging)

**File**: [`playwright-e2e-anti-patterns.md`](./playwright-e2e-anti-patterns.md)
**Length**: 620 lines | **Size**: ~22 KB

**What you'll learn**:

- 7 major anti-patterns with full context
- Why each pattern fails (with examples)
- How to detect each pattern (search rules)
- How to fix each pattern (step-by-step)
- Real code examples of wrong vs. right
- Detection rules (grep patterns)
- Summary table of all anti-patterns
- Troubleshooting lookup

**Use this for**:

- Fixing bad tests
- Code review feedback
- Teaching teammates
- Understanding why tests fail

---

## Navigation Guide

### I'm... → Read this:

| Goal                               | Document              | Section                                   |
| ---------------------------------- | --------------------- | ----------------------------------------- |
| **Starting new E2E tests**         | Prevention Strategies | Sections 1-3 (rules, patterns, tiers)     |
| **Need code template**             | Quick Reference       | "Test Template" section                   |
| **Reviewing tests**                | Quick Reference       | "Quick Checklist"                         |
| **Fixing flaky tests**             | Anti-Patterns         | Anti-Pattern #6 (arbitrary waits)         |
| **Tests too slow**                 | Anti-Patterns         | Anti-Pattern #2 (per-test login)          |
| **Locators breaking**              | Anti-Patterns         | Anti-Pattern #3 (hardcoded selectors)     |
| **Tests passing but app broken**   | Prevention Strategies | Section 1.1 (mock-based tests)            |
| **Need git detection rules**       | Anti-Patterns         | Detection Rule in each anti-pattern       |
| **Copy working example**           | Prevention Strategies | Section 7 (Reusable Patterns from Sovren) |
| **Configure playwright.config.ts** | Prevention Strategies | Section 1.3 or Quick Reference            |
| **Setup auth.setup.ts**            | Prevention Strategies | Section 1.4 or Quick Reference            |

---

## Key Concepts

### The Core Rule

```
E2E Testing = Real Browser + Real Backend, ZERO Mocks

If you use page.route() to mock API calls, you're not writing E2E tests.
```

### Three Project Tiers

1. **Setup**: Authenticates once, saves storage state
2. **Authenticated**: Reuses auth for parallel test execution
3. **Public**: No auth needed, tests unauthenticated flows

### Speed: Storage State vs. Per-Test Login

- Per-test login: 320+ seconds (20s × 16 tests)
- Storage state: 8-10 seconds (setup once + parallel execution)
- **Speedup**: 30-40x faster

### Page Object Model

- Locators defined in one place (`pages/`)
- Tests reference page objects
- UI change? Update 1 file, all tests still work

---

## Quick Start

### Create a new E2E test file:

1. **Create page object** (`e2e/pages/feature.page.ts`):

   ```typescript
   import type { Locator, Page } from '@playwright/test';

   export class FeaturePage {
     constructor(private page: Page) {}

     readonly input = this.page.getByLabel('Input');
     readonly button = this.page.getByRole('button', { name: /Submit/ });

     async goto() {
       await this.page.goto('/feature');
     }

     async submit(value: string) {
       await this.input.fill(value);
       await this.button.click();
     }
   }
   ```

2. **Create test file** (`e2e/feature.spec.ts`):

   ```typescript
   import { expect, test } from '@playwright/test';
   import { FeaturePage } from './pages/feature.page';

   test('user can submit feature', async ({ page }) => {
     const featurePage = new FeaturePage(page);
     await featurePage.goto();
     await featurePage.submit('test value');

     await expect(page).toHaveURL(/\/success/);
   });
   ```

3. **Run test**:

   ```bash
   npm run test:e2e
   ```

4. **Review checklist** from Quick Reference before committing

---

## File Structure

```
docs/solutions/testing/
├── README.md (← you are here)
├── playwright-e2e-prevention-strategies.md     # Complete guide
├── playwright-e2e-quick-reference.md           # Daily use
└── playwright-e2e-anti-patterns.md             # Debugging
```

---

## Metrics & Success Criteria

Track these to ensure tests stay healthy:

| Metric                 | Target            | Sovren  |
| ---------------------- | ----------------- | ------- |
| **Test suite runtime** | < 30 seconds      | 6.8s ✅ |
| **Auth setup**         | < 10 seconds      | 6.8s ✅ |
| **Number of tests**    | 12-20 per project | 16 ✅   |
| **Mocked API calls**   | 0 (forbidden)     | 0 ✅    |
| **Page objects**       | 100% coverage     | 5/5 ✅  |
| **Skipped tests**      | 0 (delete or fix) | 0 ✅    |
| **Flaky tests**        | < 1%              | 0% ✅   |
| **CI pass rate**       | > 95%             | 100% ✅ |

---

## Key Anti-Patterns to Avoid

| Pattern                | Why Bad                                    | Fix                                          |
| ---------------------- | ------------------------------------------ | -------------------------------------------- |
| `page.route()` mocks   | False confidence, app breaks in prod       | Use real API calls                           |
| Per-test login         | 30-40x slower                              | Use auth.setup.ts + storage state            |
| Hardcoded locators     | Every UI change breaks 20 tests            | Create Page Objects                          |
| Multiple journeys      | Hard to debug failures                     | One journey per test                         |
| Skipped tests          | Never get fixed                            | Delete or fix immediately                    |
| `waitForTimeout()`     | Flaky (sometimes works, sometimes doesn't) | Use waitForURL, waitForResponse, toBeVisible |
| Testing implementation | Tests break on refactor                    | Test user-visible behavior instead           |

---

## Commands Reference

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

## Common Questions

### Q: Should I mock API calls?

**A**: No. If you need to mock in E2E tests, use unit/component tests instead (Vitest + RTL).

### Q: How do I authenticate for tests?

**A**: Create `auth.setup.ts` that logs in once and saves storage state. All tests reuse the auth.

### Q: Why are my tests so slow?

**A**: Probably logging in for every test. Switch to storage state auth (30-40x faster).

### Q: How do I handle flaky tests?

**A**: Replace `waitForTimeout()` with explicit waits: `waitForURL()`, `waitForResponse()`, or `toBeVisible()`.

### Q: How do I fix tests that break after UI changes?

**A**: Move locators to Page Objects. Then UI changes update 1 file, not 20.

### Q: What if my backend changes the API response format?

**A**: E2E tests will fail (good!). This is why E2E tests exist — to catch real API changes.

### Q: Can I skip a test temporarily?

**A**: No. Delete it or fix it immediately. Never leave `.skip()` in committed code.

---

## History

**Date**: February 24, 2026
**Context**: Remediation of Sovren's Playwright E2E suite

**What was wrong**:

- 14 test files used `page.route()` to mock all API calls
- Tests passed against fake data while real app failed (18 wellness test failures)
- Many tests `.skip()`-ed because they assumed UI that didn't exist
- Total: 6,145 lines of mock-based "integration tests"

**What was fixed**:

- Deleted all mock-based tests
- Rewrote with Page Object Model + storage state auth
- 16 focused tests, zero mocks, all passing
- Runtime: 6.8 seconds (30-40x faster than per-test login)
- Result: Real E2E tests that catch real bugs

---

## External References

- **Playwright Official Docs**: https://playwright.dev/docs/intro
- **Page Object Model Guide**: https://playwright.dev/docs/pom
- **Authentication**: https://playwright.dev/docs/auth
- **Best Practices**: https://playwright.dev/docs/best-practices
- **Debugging**: https://playwright.dev/docs/debug

---

## Document Ownership

**Created**: February 24, 2026
**Last Updated**: February 24, 2026
**Maintained By**: Sovren Engineering

---

## How to Use These Documents

1. **First time?** Start with Prevention Strategies (Sections 1-3)
2. **Writing tests?** Keep Quick Reference open
3. **Reviewing tests?** Use Anti-Patterns catalog
4. **Teaching?** Prevention Strategies Section 2 has best practices with examples
5. **Debugging?** Anti-Patterns has detection rules and fixes

---

## Feedback & Updates

As your team writes more E2E tests, update these documents:

- Found a new anti-pattern? Add to Anti-Patterns catalog
- Discovered a useful pattern? Add to Prevention Strategies Section 7
- Got a better template? Update Quick Reference
- Hit a gotcha? Add to Troubleshooting sections

Keep these documents as your team's source of truth for E2E testing.
