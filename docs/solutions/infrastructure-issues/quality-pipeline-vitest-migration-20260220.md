---
title: 'Quality Pipeline Remediation: Vitest Migration & CI Activation'
category: infrastructure-issues
tags: [vitest, jest, esm, testing, ci-cd, quality-gates, hooks, migration]
date: 2026-02-20
severity: P1
module: test-infrastructure
symptoms:
  - 174/174 frontend tests fail under Jest
  - ESM/CJS conflict with nostr-tools and @noble packages
  - Pre-push hooks always pass (git diff --cached empty at push time)
  - ESLint never running (flat config incompatible with --ext flags)
  - quality-gates.yml only triggered manually, never on PRs
  - Coverage thresholds disabled by empty override
---

# Quality Pipeline Remediation: Vitest Migration & CI Activation

## Problem

The quality pipeline was at ~20% effectiveness based on audit:

- **Tests**: 174/174 frontend suites failing due to ESM/CJS conflict (nostr-tools 2.23.0 ships ESM-only, Jest runs CJS)
- **Pre-push hooks**: All 5 instances of `git diff --cached` were empty at push time (files already committed)
- **Pre-commit**: Running full `npm run build` (30-90s Vite production build) on every commit
- **ESLint**: `--ext .ts,.tsx,.js,.jsx` flags incompatible with flat config — ESLint was NEVER actually running. 6,443 pre-existing issues.
- **CI**: `quality-gates.yml` only had `workflow_dispatch` trigger, never ran on PRs
- **Coverage**: `--coverageThreshold='{}'` in package.json disabled all thresholds

## Root Cause

Multiple independent failures compounded:

1. **ESM/CJS**: `"type": "module"` in root package.json + ESM-only dependencies + Jest CJS runtime = fatal mismatch
2. **git diff --cached**: Only shows staged-but-uncommitted files; at push time, files are already committed
3. **ESLint flat config**: Migrated to `eslint.config.js` but left legacy `--ext` flags in npm scripts
4. **CI trigger**: Workflow was set up for manual dispatch only, PR trigger never added

## Solution

### Phase 0: Vitest Migration (replaces Jest)

**Why Vitest over Jest patching:** Vitest handles ESM natively, supports `import.meta.env`, and aligns with the Vite toolchain already used for the frontend build.

```typescript
// vitest.config.ts — 3-project setup
export default defineConfig({
  plugins: [react()],
  test: {
    pool: 'forks',
    poolOptions: { forks: { maxForks: 2 } }, // Prevent OOM on 24GB machines
    projects: [
      {
        test: {
          name: 'frontend',
          environment: 'jsdom',
          include: ['packages/frontend/src/**/*.{test,spec}.{ts,tsx}'],
        },
      },
      {
        test: {
          name: 'backend',
          environment: 'node',
          include: ['packages/backend/src/**/*.{test,spec}.{ts,tsx}'],
        },
      },
      {
        test: {
          name: 'shared',
          environment: 'node',
          include: ['packages/shared/src/**/*.{test,spec}.{ts,tsx}'],
        },
      },
    ],
  },
});
```

**Key migration patterns:**

- `jest.fn()` → `vi.fn()`, `jest.mock()` → `vi.mock()`, `jest.spyOn()` → `vi.spyOn()`
- `@jest/globals` aliased to `vitest` in resolve config (48 files importing from @jest/globals work unchanged)
- `import type { Enum }` must be split to `import { Enum }` for runtime values (esbuild strips `import type`)
- `vi.importActual()` returns Promise (Jest's is sync) — must `await`
- `vi.mock()` factory hoisting differs from Jest — class declarations in mock factories need `vi.hoisted()`

**Result:** 142/263 suites pass (71.2%), up from 94/268 (35%) under Jest. 919 previously-hidden tests discovered.

### Phase 1: Fix Local Hooks

```bash
# Pre-push: replace git diff --cached with actual committed diff
git diff origin/main...HEAD --name-only

# Pre-commit: strip to essentials (35 lines, was 116)
# Removed: npm run build, Vercel config check, npm audit
# Kept: anti-pattern scanner, lint-staged, related unit tests
```

Anti-pattern scanner extended from 4 to 6 checks:

- Check 5: Unbounded queries — `.findMany()`/`.find({` without take/limit
- Check 6: Auth bypass — route definitions without auth middleware

### Phase 2: Activate CI

```yaml
# quality-gates.yml — add PR trigger
on:
  pull_request:
    branches: [main, develop]
  workflow_dispatch:
```

- ESLint: removed `--ext` flags, added proper ignores to flat config
- Coverage: removed `--coverageThreshold='{}'` override
- Branch protection: enabled on main (informational, not required yet)

## Prevention

1. **Test runner must match module system.** If dependencies ship ESM-only, use an ESM-native test runner. Don't fight CJS transforms.
2. **`git diff --cached` is for pre-commit, not pre-push.** At push time, use `git diff origin/main...HEAD`.
3. **Verify your linter actually runs.** After migrating to flat config, confirm `npm run lint` produces output. A silent linter is worse than no linter.
4. **CI workflows need PR triggers.** `workflow_dispatch` alone means the workflow never runs automatically.
5. **Never override coverage thresholds to empty.** If thresholds are too strict, lower them — don't disable.
6. **Cap Vitest workers.** Default `pool: 'forks'` spawns one worker per CPU core. On large codebases, each worker can consume 4GB+. Set `maxForks: 2` for machines with <32GB RAM.

## Patterns Extracted

### Vitest OOM Prevention

```typescript
// vitest.config.ts
poolOptions: {
  forks: {
    maxForks: 2, // Workers × 4GB = total RAM. Cap to avoid OOM.
  },
},
```

### Chainable Mock (needed for remaining Supabase test fixes)

```typescript
// test-utils/supabase-mock.ts — pattern for fixing 43+ backend failures
const createChainableMock = () => {
  const mock: any = {};
  const methods = [
    'select',
    'insert',
    'update',
    'delete',
    'eq',
    'neq',
    'gt',
    'gte',
    'lt',
    'lte',
    'order',
    'limit',
    'single',
    'maybeSingle',
  ];
  methods.forEach((m) => {
    mock[m] = vi.fn().mockReturnValue(mock);
  });
  mock.then = vi.fn().mockImplementation((cb) => cb({ data: [], error: null }));
  return mock;
};
```

### git diff for hooks

```bash
# Pre-commit (staged files):
git diff --cached --name-only

# Pre-push (committed files vs remote):
git diff origin/main...HEAD --name-only
```

## Team Coordination

- 3 domain-specific agents (test-specialist, hooks-specialist, ci-specialist) with non-overlapping files = zero merge conflicts
- Vitest migration required 3 follow-up agents (test-finisher, test-finisher-2, test-finisher-3) due to:
  - OOM from uncapped workers (10 × 4GB = 40GB on 24GB machine)
  - Agents becoming unresponsive during long vitest runs
- **Lesson:** Cap resource usage in agent briefs. Include explicit `maxForks: 2` and `timeout: 120000` constraints.
- **Lesson:** For test migration tasks, run one project at a time (backend → shared → frontend), not all at once.

## Metrics

| Before                        | After                                | Delta            |
| ----------------------------- | ------------------------------------ | ---------------- |
| 94/268 suites pass (35%)      | 142/263 suites pass (71.2%)          | +48 suites, +36% |
| 3,326 tests pass              | 3,934 tests pass                     | +608             |
| 4,736 total tests             | 5,655 total tests                    | +919 discovered  |
| ESLint: never running         | ESLint: running (6,443 pre-existing) | Fixed            |
| CI: manual only               | CI: triggers on PRs                  | Fixed            |
| Pre-push: always passes       | Pre-push: checks committed diff      | Fixed            |
| Pre-commit: 116 lines, 30-90s | Pre-commit: 35 lines, <5s            | Fixed            |

## Files Changed

280 files changed, +7,158 / -4,690 lines across:

- vitest.config.ts (new)
- test-utils/vitest-\*.ts (3 new)
- 220+ test files (jest → vi migration)
- 20 source files (import type → import for enums)
- .husky/pre-commit, .husky/pre-push
- scripts/check-antipatterns.sh
- .github/workflows/quality-gates.yml
- eslint.config.js, package.json

## Related

- [Remaining test failures](../../remaining-test-failures-2026-02-20.md) — 121 suites still failing, all pre-existing bugs
- [Quality workflow audit](../../quality-workflow-audit-2026-02-20.md) — original audit identifying 45+ gates at ~20% effectiveness
- [Quality pipeline plan](../../plans/2026-02-20-refactor-quality-pipeline-100-percent-plan.md) — simplified 3-phase plan
