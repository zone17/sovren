---
title: "Quality Pipeline Remediation to 100% Effectiveness"
type: refactor
date: 2026-02-20
scope: sovren
priority: P0 (force multiplier — unblocks everything)
status: simplified after plan review
---

# Quality Pipeline Remediation to 100% Effectiveness (Simplified)

## Overview

The quality pipeline is running at ~20% effectiveness. 174/174 frontend test suites FAIL (ESM/CJS conflict), pre-push hooks are broken, and the comprehensive `quality-gates.yml` never runs on PRs.

**Three phases. Fix the broken things. Nothing else.**

**Audit reports:**
1. Test Infrastructure Audit — 7 root causes, 15 remediation items
2. Quality Workflow Audit (`docs/quality-workflow-audit-2026-02-20.md`) — 45+ gates at ~20% effectiveness

**Plan review (DHH + Simplicity):** Both reviewers independently recommended cutting from 6 phases/49 tasks to 3 phases/~18 tasks. Phases 3-5 (observability, CE enforcement, global templates) are YAGNI — defer until this pipeline is proven.

---

## Phase 0: Fix the Test Suite

**The critical path. 60% of the work, 90% of the value.**

**Root cause:** `nostr-tools@2.23.0` and `@noble/*` ship ESM-only. Jest runs CJS. The `"type": "module"` in root `package.json` compounds the conflict.

### Task 0.A: Spike Vitest migration (4-hour timebox)

Before patching Jest, spend 4 hours testing if Vitest works:
- Install vitest, configure with existing vite.config
- Migrate 5-10 representative test files (mix of frontend services, components, nostr)
- If 80%+ of suites work with mechanical changes → commit to Vitest migration
- If not → fall back to Jest patching (tasks 0.B-0.D)

**Why:** Vitest handles ESM natively, handles `import.meta.env` natively, uses existing Vite config. The Jest patching approach (0.B-0.D) spends ~15 hours building workarounds around a tool fighting its environment. Vitest eliminates the root cause.

**Files:** `vitest.config.ts` (new), sample test files

### Task 0.B: Fix Jest ESM/CJS configuration (if Vitest rejected)

All of these are the same root cause — fix together:
- Add `node_modules/(?!(nostr-tools|@noble|@scure|@bitcoinerlab)/)` to `transformIgnorePatterns` in EACH project config (root pattern does NOT propagate to project configs that override `transform`)
- Add `import.meta.env` transform: either `@babel/plugin-transform-import-meta` in Jest transform or abstract env access behind utility
- Add `jest-transform-stub` for CSS/SVG/image imports if missing
- Delete deprecated `globals['ts-jest']` block (lines 46-56 of `jest.config.elite.ts`) — inline `transform` config already exists
- Assess `"type": "module"` in root `package.json` — may need removal or renaming config files to `.cjs`

**Files:** `jest.config.elite.ts`, `packages/frontend/jest.config.ts`, `packages/backend/jest.setup.js`, `package.json`

### Task 0.C: Fix individual test file issues

These will surface when running the suite after config fixes. Known issues:
- `analyticsService.test.ts` — JSX in `.ts` file (rename to `.tsx`)
- `SovrenNIPService.test.ts:105` — `CreatorCategory.TECHNOLOGY` undefined (ESM re-export issue)
- `SubscriptionManagerService.ts` — relay connection error in test imports (mock relay pool at module level)
- `packages/backend/jest.setup.js:221` — `jest.requireActual` triggers nostr-tools ESM crash

**Files:** 3-4 test files, `jest.setup.js`

### Task 0.D: Unify test configs and measure baseline

- Delete workaround configs: `jest.utils.config.js`, `jest.community.config.js`, `jest.finance.config.js`
- Update `package.json` `test:pre-commit` script to use unified config
- Run `npm test` — verify 0 failures
- Run coverage report — record baseline: frontend %, backend %, shared %, global %

**Files:** `package.json`, 3 workaround configs (to delete)

**Phase 0 success criteria:** `npm test` exits 0 with all suites passing. Baseline coverage measured.
**Effort:** 10-20 hours (lower end if Vitest works, higher end if Jest patching)

---

## Phase 1: Fix Local Hooks

**Problem:** Pre-commit runs a production build and skips frontend tests. Pre-push uses `git diff --cached` which is always empty at push time.

### Task 1.A: Fix pre-push hook

The entire `.husky/pre-push` file is 53 lines with 5 instances of the broken `git diff --cached` pattern (lines 28, 31, 38, 41, 47). Fix the whole file at once:
- Replace ALL `git diff --cached` with `git diff origin/main...HEAD`
- Fix test command to work post-Phase 0
- Exclude `*.test.ts`, `*.spec.ts`, `*.md` from console.log check

**File:** `.husky/pre-push`

### Task 1.B: Strip pre-commit to essentials

Current pre-commit runs: antipatterns → lint-staged → (type-check DISABLED) → backend tests → npm audit → **FULL VITE BUILD** → **VERCEL CONFIG VALIDATION (60 lines)**

Remove the build and Vercel validation. Pre-commit should be:
1. Anti-pattern scanner
2. lint-staged (ESLint + Prettier)
3. Related unit tests only (`--findRelatedTests` for staged files, both frontend AND backend)

Target: <60s pre-commit.

**File:** `.husky/pre-commit`

### Task 1.C: Add 2 more anti-pattern checks

The existing 4 grep-based patterns work well. Add only patterns that ARE greppable:
1. **Unbounded queries** — `.findMany()` / `.find({` without `take` or `limit`
2. **Auth bypass** — route definition without auth middleware (check route files)

Do NOT add TOCTOU, SSRF, payment persistence, status guards, or non-atomic writes — these are semantic analysis problems that grep cannot solve. They will produce false positives that train developers to ignore the scanner.

**File:** `scripts/check-antipatterns.sh`

**Phase 1 success criteria:** `git commit` runs lint + anti-patterns (6 checks) + related tests in <60s. `git push` runs full test suite + TODO check without `--no-verify`.
**Effort:** 3-4 hours

---

## Phase 2: Activate CI

**Problem:** `quality-gates.yml` is comprehensive but only `workflow_dispatch` trigger. Coverage thresholds disabled. Never runs on PRs.

### Task 2.A: Audit and fix broken steps in quality-gates.yml

Before adding PR trigger, fix everything that will fail:
- `npx madge --circular src/` → fix path for monorepo (`packages/*/src/`)
- `npm run docs:build` → script doesn't exist (remove or add)
- `npm run docs:check-links` → script doesn't exist (remove or add)
- `scripts/check-changelog.py` → Python dependency (rewrite in bash or remove)
- `npm run db:migrate` in integration-tests job → script doesn't exist (remove or stub)
- Verify secrets: `SNYK_TOKEN`, `CODECOV_TOKEN`, `LHCI_GITHUB_APP_TOKEN`

**File:** `.github/workflows/quality-gates.yml`

### Task 2.B: Add pull_request trigger

Add `pull_request:` trigger targeting `main` and `develop`. This single change activates: lint, unit tests, integration tests, E2E smoke tests, coverage, circular dependency check — all of which already exist in the workflow but never run.

**File:** `.github/workflows/quality-gates.yml`

### Task 2.C: Fix coverage threshold

Remove `--coverageThreshold='{}'` from `test:coverage:check` script. Set a realistic threshold based on baseline measured in Phase 0. Start at baseline + 5%, adjust manually if it blocks PRs. No need for an automated ramp system.

**File:** `package.json`

### Task 2.D: Add anti-pattern scanner to CI

Currently only runs in pre-commit. If developer uses `--no-verify`, anti-patterns are never checked. Add as CI step.

**File:** `.github/workflows/quality-gates.yml`

### Task 2.E: Enable required status check

Configure GitHub branch protection: quality-gates must pass to merge. Admin override for emergencies only.

**Action:** GitHub repo settings (not a code change)

**Phase 2 success criteria:** Every PR auto-triggers quality gates. Coverage enforced. Anti-patterns checked in CI. Merge blocked if gates fail.
**Effort:** 3-4 hours

---

## Circuit Breakers (Rollback Per Phase)

| Phase | Circuit Breaker |
|-------|----------------|
| Phase 0 | `git revert` jest config changes — backend workaround configs still work |
| Phase 1 | `SKIP_HOOKS=1` env var or `git config core.hooksPath /dev/null` |
| Phase 2 | Remove `pull_request` trigger from quality-gates.yml (1-line revert) |

---

## What Was Cut (and Why)

| Cut | Hours Saved | Reason |
|-----|-------------|--------|
| Phase 3: Production Observability | 3-5h | Different system, different effort — not a test pipeline concern |
| Phase 4: CE Workflow Enforcement | 2-3h | Process enforcement for AI agents — not code quality |
| Phase 5: Global Infrastructure | 4-6h | YAGNI — no second project exists. Extract template after pipeline proven |
| Behavioral gate checks (2.3) | 2-3h | New system requiring integration tests, not grep scripts. Defer. |
| 5 of 7 new anti-pattern checks | 1-2h | Semantic analysis not greppable — false positives worse than no scanner |
| Type-check re-enablement | 1-2h | Blocked by hundreds of pre-existing TS errors — separate effort |
| Coverage ramp system | 1h | Over-engineered — manually adjust one threshold |
| SpecFlow section | 0h | 7/10 items duplicated phase tasks |

**Total saved: ~18-25 hours. Same outcome for the code that matters.**

---

## Dependency Graph

```
Phase 0 (Fix tests) ──→ Phase 1 (Fix hooks) ──→ Done
                    ──→ Phase 2 (Activate CI) ──→ Done
```

Phase 1 and Phase 2 can be partially parallelized:
- **Immediately (no Phase 0 dependency):** Task 1.A (fix git diff), Task 1.B (strip pre-commit), Task 2.A (audit workflow), Task 2.D (add scanner to CI)
- **After Phase 0:** Task 1.C (needs test suite), Task 2.B (needs tests to pass), Task 2.C (needs baseline), Task 2.E (needs CI green)

## Success Metrics

| Metric | Before | Target |
|--------|--------|--------|
| Test suites passing | 265/439 (backend only) | All (frontend + backend + shared) |
| Pre-push hook functional | No | Yes |
| CI quality gates auto-triggered | No | Yes |
| Pre-commit time | 30-90s (includes build) | <60s |
| `--no-verify` needed | Always | Never |
| Anti-pattern coverage | 4 patterns | 6 patterns |
| Coverage enforcement | Disabled | Enabled at realistic threshold |

## Effort Estimate

- **Phase 0:** 10-20 hours (lower with Vitest, higher with Jest patching)
- **Phase 1:** 3-4 hours
- **Phase 2:** 3-4 hours
- **Total:** 16-28 hours (solo) or 10-18 hours (parallel team with Phase 0 as critical path)

## References

- Quality Workflow Audit: `docs/quality-workflow-audit-2026-02-20.md`
- Critical Patterns: `docs/solutions/patterns/critical-patterns.md`
- Pre-commit Bug Fixes: `docs/solutions/prevention-wave2-three-problems.md`
- Anti-pattern Scanner Design: `docs/solutions/process-issues/wave2-review-root-cause-precommit-scanner-20260218.md`
- CI/CD Automation YAMLs: `docs/solutions/prevention-ci-cd-automation.md`
