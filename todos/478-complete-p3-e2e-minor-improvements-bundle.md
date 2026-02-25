---
status: complete
priority: p3
issue_id: '478'
tags:
  - code-review
  - playwright
  - e2e-testing
  - cleanup
dependencies: []
---

# E2E Minor Improvements Bundle

## Problem Statement

Collection of P3 findings from 7 review agents. Individually minor, collectively improve suite quality.

## Findings

### 1. \_\_dirname/authFile path duplication (3/7 agents)

The ESM `__dirname` workaround and `authFile` path are constructed independently in `playwright.config.ts`, `auth.setup.ts`, and `global-setup.ts`. Path drift risk if one changes without the other.
**Fix:** Extract to `e2e/constants.ts`.

### 2. trace: 'on-first-retry' loses first failure data (1/7 agents)

With `retries: 0` locally, traces are never captured. `'retain-on-failure'` captures on every failure at no perf cost.
**Fix:** Change to `trace: 'retain-on-failure'` in playwright.config.ts.

### 3. navigationTimeout matches timeout (1/7 agents)

Both 30s. If navigation hangs, it consumes entire test timeout before reporting. Setting `navigationTimeout: 15_000` gives room for diagnostic failure.
**Fix:** Set `navigationTimeout: 15_000`.

### 4. Unused POM locators (1/7 agents)

- `LayoutPage`: `loginLink`, `signUpLink`, `navLogoutButton` never used in tests
- `ProfilePage`: `authHeading` never used
  **Fix:** Remove or annotate as "reserved for future use".

### 5. Mobile viewport ad-hoc (2/7 agents)

`page.setViewportSize({ width: 375, height: 667 })` hardcoded in 2 files. Misses device emulation (userAgent, touch, scale).
**Fix:** Extract constant or add Playwright mobile device project.

### 6. No JSON reporter for agent-native parsing (1/7 agents)

Only html/line/github reporters. Agents can't parse results programmatically.
**Fix:** Add `['json', { outputFile: 'test-results/results.json' }]` to reporter array.

### 7. Card locator naming misleading (1/7 agents)

`trueOwnershipCard`, `bitcoinMonetizationCard`, `eliteCommunityCard` target `<h1>` headings, not card containers.
**Fix:** Rename to `*CardHeading`.

### 8. Redundant auth.spec.ts beforeEach navigation (1/7 agents)

`beforeEach` navigates to `/` just to clear localStorage, then each test navigates to its target. Use `about:blank` instead.
**Fix:** `await page.goto('about:blank')` in beforeEach.

## Acceptance Criteria

- [ ] No duplicate path construction across files
- [ ] Traces captured on first failure
- [ ] navigationTimeout < test timeout
- [ ] All 17 tests pass

## Work Log

| Date       | Action                         | Outcome                                                                                                                                                                      |
| ---------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-02-24 | Collected from 7 review agents | P3 bundle - 8 items                                                                                                                                                          |
| 2026-02-24 | Triage + fix                   | Items 2,3,6 already fixed. Item 4: removed 4 unused POM locators. Items 1,5,7 deferred (low value). Item 8 deferred (about:blank blocks localStorage.clear — SecurityError). |
