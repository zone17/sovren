---
module: System
date: 2026-02-24
problem_type: workflow_issue
component: testing_framework
symptoms:
  - 'Playwright E2E tests not in main CI pipeline — deploys proceeded without E2E verification'
  - "Frontend agent brief said 'E2E tests (QA agent in Phase 3)' — agents skipped E2E entirely during implementation"
  - 'QA brief referenced tests/e2e/ but actual path was packages/frontend/e2e/'
  - '7 review findings (1 P1, 5 P2, 1 P3) in freshly written E2E suite — auth.spec.ts assigned to wrong Playwright project'
root_cause: incomplete_setup
resolution_type: workflow_improvement
severity: high
tags:
  - playwright
  - ci-cd
  - agent-briefs
  - e2e-testing
  - workflow-integration
  - team-builder
---

# E2E Testing Workflow Gaps — CI Pipeline + Agent Instructions

## Problem

After rewriting the Playwright E2E suite (mock elimination → real tests with POM), three integration gaps prevented E2E tests from being part of the development workflow:

1. **CI gap** — `ci.yml` pipeline had no Playwright stage. Tests ran locally but never in CI. Staging deploys proceeded without E2E verification.
2. **Agent brief gap** — Frontend brief explicitly said "E2E tests (QA agent in Phase 3)" with no E2E deliverable, so implementation agents never wrote E2E tests. QA brief referenced wrong paths (`tests/e2e/` instead of `packages/frontend/e2e/`).
3. **Review remediation gap** — 7 review findings in the freshly written suite itself, including a P1 (auth.spec.ts in wrong Playwright project using stored state when it should test auth from scratch).

## Environment

- Module: System-wide (CI, agent briefs, project CLAUDE.md)
- Tech: Playwright 1.x, Vite, GitHub Actions
- Date: 2026-02-24

## Symptoms

- `ci.yml`: Zero mentions of "playwright" or "e2e" — only Vitest unit + integration tests
- Frontend brief `deliverables` checklist: No E2E item. Explicit exclusion: "E2E tests (QA agent in Phase 3)"
- QA brief `scope`: `tests/e2e/` path doesn't exist in monorepo; actual path is `packages/frontend/e2e/`
- Review finding #472 (P1): `auth.spec.ts` in `chromium-authenticated` project inherited stored storage state, meaning it tested auth flow with pre-authenticated state — defeating the purpose

## What Didn't Work

**Direct solution:** The gaps were identified proactively before they caused failures. No failed attempts.

## Solution

### 1. CI Pipeline — E2E Stage as Deploy Gate

Added `e2e` job to `.github/workflows/ci.yml` between build and deploy-staging:

```yaml
# Stage 4b: E2E Tests (post-build, against production bundle)
e2e:
  name: E2E Tests
  runs-on: ubuntu-latest
  timeout-minutes: 15
  needs: [build]
  steps:
    - uses: actions/checkout@v4
    - uses: ./.github/actions/setup-node
    - name: Download build artifact
      uses: actions/download-artifact@v4
      with:
        name: frontend-dist
        path: packages/frontend/dist
    - name: Install Playwright browsers
      run: npx playwright install --with-deps chromium
      working-directory: packages/frontend
    - name: Start preview server
      run: npx vite preview --port 4173 &
      working-directory: packages/frontend
    - name: Wait for preview server
      run: npx wait-on http://localhost:4173 --timeout 30000
    - name: Run E2E tests against production build
      run: npm run test:e2e
      working-directory: packages/frontend
      env:
        CI: true
        E2E_BASE_URL: http://localhost:4173
    - name: Upload test results
      uses: actions/upload-artifact@v4
      if: failure()
      with:
        name: playwright-report
        path: packages/frontend/test-results/
        retention-days: 7
```

**Key design:** Tests run against `vite preview` (production build), not `vite dev`. This catches build-only issues (tree-shaking, minification, env vars).

Deploy-staging now depends on `[build, docker, e2e]` — E2E must pass before staging.

### 2. Project CLAUDE.md — "Playwright E2E Testing" Section

Added comprehensive section to `CLAUDE.md` that all agents read:

- E2E directory structure and file purposes
- 3-tier Playwright config explanation
- **6 mandatory steps** when building new features (create POM, add spec, register in config, import credentials, run tests)
- Conventions (POM, role-based locators, web-first assertions, no CSS selectors)
- Commands reference

### 3. Agent Brief Updates

**Frontend brief (`briefs/frontend.md`):**

- Removed "E2E tests (QA agent in Phase 3)" from DO NOT OWN
- Added "E2E Testing (Shared with QA)" section with 5-step instructions
- Added "E2E Page Object + spec" as deliverable checklist item

**QA brief (`briefs/qa.md`):**

- Added monorepo path adaptation note (`packages/frontend/e2e/` not `tests/e2e/`)
- Updated E2E test strategy section with Sovren-specific conventions (POM, role-based locators, test-credentials fixture, Playwright project registration)

**Backend brief (`briefs/backend.md`):**

- Changed "E2E tests (QA agent in Phase 3 handles)" to "E2E tests (frontend agent creates Page Objects + specs; QA hardens in Phase 3)"

### 4. Review Remediation (7 findings)

| #   | Severity | Fix                                                                                                                        |
| --- | -------- | -------------------------------------------------------------------------------------------------------------------------- |
| 472 | P1       | Moved `auth.spec.ts` from `chromium-authenticated` to `chromium-public` — it tests auth itself, shouldn't use stored state |
| 473 | P2       | Created `test-credentials.ts` with centralized creds + env var fallbacks                                                   |
| 474 | P2       | Rewrote `auth.setup.ts` to use LoginPage POM instead of duplicating locators                                               |
| 475 | P2       | Replaced `page.locator('h1')` with `getByRole('heading', { level: 1 })`                                                    |
| 476 | P2       | Rewrote `global-teardown.ts` to clean correct `test-results/.auth/` path                                                   |
| 477 | P2       | Added `goto()` to LayoutPage, extracted `beforeEach` in navigation.spec                                                    |
| 478 | P3       | `trace: retain-on-failure`, `navigationTimeout: 15s`, JSON reporter, removed unused POM locators                           |

## Why This Works

**The three layers create a closed loop:**

1. **CLAUDE.md + briefs** → agents know to write E2E tests as they build (prevention)
2. **Review agents** → catch issues in E2E test code itself (detection)
3. **CI pipeline** → enforces E2E pass before deploy (enforcement)

Without all three, E2E tests become stale artifacts that exist but don't protect anything.

## Prevention

### Rules

1. **Every new CI test type needs three integration points** — pipeline stage, agent brief instructions, and project CLAUDE.md documentation
2. **Frontend agents own E2E alongside QA** — "defer to QA" means E2E coverage only appears at the end, after implementation details are forgotten
3. **Review freshly written test code** — the 7 findings in a brand-new suite prove that test code needs review too, not just application code
4. **E2E tests run against production build** — `vite preview` not `vite dev`, to catch build-only issues
5. **Auth flow tests must NOT use stored state** — they test the auth mechanism itself; pre-authenticated state defeats the purpose

### Checklist for Adding New Test Types to Workflow

- [ ] CI pipeline stage added (with artifact upload on failure)
- [ ] Deploy stages depend on new test stage
- [ ] Project CLAUDE.md section added with structure, conventions, commands
- [ ] Frontend agent brief updated with deliverable item
- [ ] QA agent brief updated with correct paths and conventions
- [ ] Backend agent brief scope boundary updated
- [ ] `npm run test:*` script exists in package.json

## Related Issues

- **E2E Mock Elimination:** `docs/solutions/test-failures/e2e-mock-elimination-pom-rewrite-20260224.md` — the initial rewrite this session built on
- **Structural Gates Miss Behavioral P1s:** `docs/solutions/workflow-issues/structural-gates-miss-behavioral-p1s-team-builder-20260215.md` — similar theme: structural checks (file exists) miss behavioral issues (wrong project assignment)
- **Hook Migration:** `docs/solutions/infrastructure-issues/pr90-hook-migration-security-test-enforcement-20260221.md` — another case where test tooling existed but wasn't wired into the workflow
- **Common Solutions #17:** Hook migration checklist — same principle (update all integration points when changing test infrastructure)
