---
module: E2E Testing
date: 2026-02-24
problem_type: documentation_gap
component: testing_framework
symptoms:
  - '~487 LOC of unused E2E fixture/helper files with zero imports'
  - 'CLAUDE.md E2E section missing 4 conventions (stale count, .first(), USE_BACKEND, helpers/)'
  - '11 redundant inline comments across 6 E2E files'
  - '2 unused FullConfig imports in global-setup/teardown'
root_cause: inadequate_documentation
resolution_type: documentation_update
severity: medium
tags:
  - e2e-review
  - dead-code
  - documentation-gap
  - redundant-comments
  - playwright
  - pom
  - cleanup
---

# E2E Review Sprint: P2/P3 Cleanup (Findings #501-503)

## Problem

After fixing 4 P3 POM findings (#497-500), a 4-agent parallel review of the P3 commit (c8f60fa) surfaced 3 additional findings: ~487 LOC of dead fixture code, 4 CLAUDE.md documentation gaps, and 14 LOC of redundant comments/imports across 6 files.

## Environment

- Module: E2E Testing (Playwright)
- Affected Component: `packages/frontend/e2e/`
- Date: 2026-02-24
- Commits: `14d0dd1` (P2s), `2eff87b` (P3)

## Symptoms

1. **Dead fixtures**: `test-events.ts` (328 LOC), `test-users.ts` (95 LOC), `nostr-auth.ts` (64 LOC) — zero imports across entire spec suite, created as infrastructure for future NOSTR E2E tests that don't exist yet
2. **CLAUDE.md stale**: Hardcoded "12 P2/P3-class patterns" count (actual: 31), structure diagram listed deleted files, missing `.first()` convention, missing `USE_BACKEND=1` command
3. **Redundant comments**: 11 comments restating what test names, assertions, and variable names already communicate (e.g., `// Logout` above `profilePage.logout()`)
4. **Unused imports**: `FullConfig` type imported in both `global-setup.ts` and `global-teardown.ts` but never used (Playwright's globalSetup/globalTeardown don't require typed config params)

## What Didn't Work

Direct solution on first attempt — all findings were straightforward deletions/removals with clear grep verification.

## Solution

### Dead fixture deletion (#501)

Deleted 3 files with zero imports (verified via `grep -r` across entire e2e/ directory):

```bash
# Verification before deletion
grep -r "test-events" packages/frontend/e2e/ --include="*.ts" -l  # 0 results
grep -r "test-users" packages/frontend/e2e/ --include="*.ts" -l   # 0 results
grep -r "nostr-auth" packages/frontend/e2e/ --include="*.ts" -l   # 0 results
```

Removed empty `helpers/` directory after last file deleted.

### CLAUDE.md documentation gaps (#502)

4 targeted edits:

1. **Stale count**: Replaced `12 P2/P3-class patterns (double-submit, TTLCache, ...)` with stable description without hardcoded count
2. **Structure diagram**: Removed deleted files (`test-users.ts`, `test-events.ts`), removed `helpers/` directory
3. **`.first()` convention**: Added to Conventions block — "Add `.first()` in the POM constructor for any locator that may match multiple elements"
4. **`USE_BACKEND=1`**: Added to Commands block — `USE_BACKEND=1 npm run test:e2e`

### Redundant comments + unused imports (#503)

Removed across 6 files:

| File                    | Removed                                                                                                            |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `auth.public.spec.ts`   | 4 comments ("Auth tests create their own auth state", "Login first", "Logout", "Verify: visiting protected route") |
| `auth.setup.ts`         | 2 comments ("Demo auth redirects", "Save storage state")                                                           |
| `wellness.auth.spec.ts` | 3 comments ("Page should render", "Error boundary should NOT show crash", "Modal should appear")                   |
| `global-setup.ts`       | 1 comment + `FullConfig` import + `_config` param                                                                  |
| `global-teardown.ts`    | `FullConfig` import + `_config` param                                                                              |
| `test-credentials.ts`   | 5-line JSDoc block                                                                                                 |

## Why This Works

**Dead code**: Files with zero imports are pure maintenance burden — any nostr-tools migration requires updating them despite no test exercising them. Recoverable from git history when needed.

**CLAUDE.md**: Agent discoverability improved from 6/10 to ~9/10 (agent-native-reviewer score). Hardcoded counts go stale across sprints; stable descriptions don't. Convention documentation prevents recurring strict-mode violations.

**Comments**: Redundant comments that restate what code already communicates add noise and go stale (e.g., "WellnessPulseModal" implementation detail). Self-documenting code via descriptive test names, assertion methods, and variable names is the convention established in this E2E suite.

## Prevention

1. **Zero-import check before committing new fixture files**: `grep -r "filename" e2e/ --include="*.ts" -l` must return at least 1 result
2. **Never hardcode counts in CLAUDE.md** — use stable descriptions ("P2/P3-class patterns covering...") instead of numeric counts that go stale
3. **Self-documenting tests**: If the test name and assertion communicate intent, the comment adds nothing. Reserve comments for non-obvious "why" explanations only
4. **Review-after-fix loop**: Even small P3 commits benefit from a quick review pass — this sprint's P3 commit produced 2 P2s and 1 P3 that would have persisted otherwise

## Patterns Reinforced

- **common-solutions.md #25**: Verify todos against source before implementing — 71% stale rate across E2E todos (3rd data point)
- **common-solutions.md #26**: E2E must not mock API — dead fixtures were mock-era infrastructure
- **common-solutions.md #30**: Convention-based spec naming eliminates config changes
- **Review-after-fix**: Even cleanup commits warrant review — this sprint's review of a P3 fix commit found 3 new findings

## Related Issues

- [E2E Mock Elimination](../test-failures/e2e-mock-elimination-pom-rewrite-20260224.md) — original rewrite that created the reviewed code
- [E2E Review Remediation](../test-failures/e2e-review-remediation-convention-naming-20260224.md) — first review sprint (3 P2s)
- [P3 Dead Code POM Cleanup](./p3-dead-code-pom-cleanup-review-sprint-20260224.md) — P3 POM fixes that preceded this sprint
- [Playwright E2E Prevention Strategies](../testing/playwright-e2e-prevention-strategies.md) — canonical E2E testing reference
