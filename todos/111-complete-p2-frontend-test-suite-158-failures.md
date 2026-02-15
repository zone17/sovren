---
status: pending
priority: p2
issue_id: '111'
tags:
  - testing
  - frontend
  - pre-commit
  - jest
  - vitest
dependencies: []
---

# 111: Frontend Test Suite — 158 Pre-Existing Failures Block Pre-Commit Hook

## Problem Statement

The pre-commit hook runs `npm test:ci` which executes the full monorepo test suite. 158 frontend test suites fail due to pre-existing configuration issues, forcing all commits to use `--no-verify`. This bypasses not just tests but also ESLint and Prettier checks.

**Impact**: Every commit requires `--no-verify`, reducing code quality gates to manual enforcement only.

## Findings

### Failure Categories (158 test suites)

**1. Vitest/Jest Mismatch (~8 suites)**
Frontend tests import from `vitest` but Jest is the configured runner:

```
Cannot use 'vitest' in a CommonJS module using require()
```

Files: `EventCacheService.test.ts`, `KeyManagementService.test.ts`, `NIP05Service.test.ts`, `EventDeduplicationService.test.ts`, `OfflineCapabilities.test.tsx`, `lightningApi.test.ts`, `LightningPaymentButton.test.tsx`, `KeyManagementService.basic.test.ts`

**2. import.meta Syntax (~5 suites)**
`import.meta.env` used in `sentry.ts` which Jest can't parse:

```
SyntaxError: Cannot use 'import.meta' outside a module
```

Files: `App.test.tsx`, `EngagementAnalyticsDashboard.test.tsx`, `OptimizationSuggestionPanel.test.tsx`, `engagement-analytics-integration.test.tsx`

**3. Missing Modules (~3 suites)**

```
Cannot find module 'msw/node'
Cannot find module '../../../../test-utils/mockData'
```

**4. Undefined References (~4 suites)**

```
ReferenceError: AlertType is not defined
ReferenceError: vi is not defined
TypeError: Cannot read properties of undefined (reading 'TECHNOLOGY')
```

Files: `MonitoringService.test.ts`, `RateLimiter.integration.test.ts`, `NostrMonitoringDashboard.test.tsx`, `SovrenNIPService.test.ts`, `AutomatedContentModerationDashboard.test.tsx`

**5. Asset Import Issues (~2 suites)**
Jest can't handle PNG imports:

```
SyntaxError: Invalid or unexpected token (Sovren-icon.png)
```

**6. Flaky Performance Tests (3 tests)**
Timeout/threshold failures in `api-performance.test.ts`:

- User registration p95 > 200ms target
- Webhook delivery timeout > 30s
- Analytics dashboard timeout > 30s

## Proposed Solutions

### Option A: Fix Jest Configuration (Recommended)

- Add `moduleNameMapper` for asset imports (`.png`, `.jpg`)
- Add `transformIgnorePatterns` for `import.meta`
- Convert vitest imports to jest in affected files
- Add `msw` as dev dependency or mock it
- Fix undefined enums (AlertType, CreatorCategory)
- **Effort**: Medium | **Risk**: Low

### Option B: Split Test Runners

- Keep Jest for backend tests
- Use Vitest for frontend tests (already importing from it)
- Update `jest.config.elite.ts` to exclude frontend vitest files
- **Effort**: Medium | **Risk**: Medium (two test runners to maintain)

### Option C: Exclude Frontend from Pre-Commit

- Run only backend tests + lint in pre-commit
- Run full suite in CI only
- **Effort**: Small | **Risk**: Low (CI still catches failures)

## Recommended Action

Option C as quick fix (unblocks pre-commit), then Option A for proper fix.

## Technical Details

- **Test runner**: Jest via `jest.config.elite.ts`
- **Pre-commit hook**: `.husky/pre-commit` → `npm test:ci`
- **Test results**: 59 passed, 158 failed, 217 total suites; 2697 passed, 1477 failed, 4174 total tests
- **Backend tests**: All pass (no failures from backend changes)

## Acceptance Criteria

- [ ] Pre-commit hook passes without `--no-verify`
- [ ] All 158 failing test suites either fixed or excluded from pre-commit
- [ ] CI pipeline still runs full test suite
- [ ] No regression in backend test coverage

## Work Log

| Date       | Action                                     | Learnings                                         |
| ---------- | ------------------------------------------ | ------------------------------------------------- |
| 2026-02-14 | Identified during P2 deferred fixes commit | 158 failures are all pre-existing frontend issues |

## Resources

- Commits requiring `--no-verify`: f16ea2d, 62e6a9f, 9480b40, 2ba69ff, 25ee860
- Related: Todo 061/069 (pre-commit TypeScript errors)
