---
title: 'PR #90: Pre-Commit/Pre-Push Hook Migration — Jest to Vitest + Security Test Enforcement'
category: infrastructure-issues
tags:
  [hooks, husky, vitest, jest, migration, security-tests, pre-commit, pre-push, ssrf, auth, csrf]
date: 2026-02-21
severity: P1
module: developer-tooling
symptoms:
  - Pre-commit hook silently fails (jest --findRelatedTests returns error suppressed by 2>/dev/null || true)
  - Pre-push hook always fails (full npm test suite includes 121 pre-existing failures)
  - Developers forced to use --no-verify on every push
  - Zero tests run during development — only in CI
  - SSRF findings (#423, #424) from PR #89 review would have been caught by local tests
---

# PR #90: Pre-Commit/Pre-Push Hook Migration + Security Test Enforcement

## Problem

After the Vitest migration (PR #86), the husky git hooks were still invoking Jest commands. This created a silent failure cascade:

1. **Pre-commit**: Ran `npx jest --findRelatedTests` which failed immediately (Jest no longer configured). The error was suppressed by `2>/dev/null || true`, making the failure invisible. Result: no tests ran on commit.

2. **Pre-push**: Ran `npm test` which executed the full Vitest suite. With 121 pre-existing failures across the monorepo, this always failed. Developers bypassed with `--no-verify`. Result: no tests ran on push.

**Impact**: Two P1 SSRF findings (#423, #424) from the PR #89 review would have been caught immediately if the SSRF test suite (70 tests, 145ms) had run when `ssrf.ts` was committed. The test infrastructure existed but was never invoked during development.

## Root Cause

The Vitest migration (PR #86, 02-20) updated test configs, npm scripts, and 220+ test files but did not update the husky hooks in `.husky/pre-commit` and `.husky/pre-push`. Two compounding factors made this invisible:

1. **Error suppression anti-pattern**: `2>/dev/null || true` after the Jest command suppressed the failure message
2. **Full-suite pre-push**: Running all tests when pre-existing failures exist forces `--no-verify`, defeating the hook entirely

## Solution

### 1. Pre-Commit Hook (`.husky/pre-commit`)

Replaced broken `jest --findRelatedTests` with convention-based test file discovery:

```bash
# For each staged .ts/.tsx file, find matching test by convention:
#   src/utils/ssrf.ts → src/utils/__tests__/ssrf.test.ts
#   src/utils/ssrf.ts → src/utils/ssrf.test.ts
#   components/Foo.tsx → components/__tests__/Foo.test.tsx

basename=$(basename "$src_file" | sed 's/\.[^.]*$//')
dir=$(dirname "$src_file")

# Check __tests__/basename.test.ts, then basename.test.ts in same dir
for candidate in \
  "$dir/__tests__/$basename.test.ts" \
  "$dir/$basename.test.ts" \
  "$dir/__tests__/$basename.test.tsx" \
  "$dir/$basename.test.tsx"; do
  [ -f "$candidate" ] && TEST_FILES="$TEST_FILES $candidate" && break
done
```

**Why not `vitest related`?** The `vitest related` command uses static import analysis to find related tests. However, when combined with `--project` flags, it hits pre-existing compile errors in other files within that project. Direct file paths (`vitest run path/to/test.ts`) are more reliable and avoid loading unrelated code.

### 2. Security Test Step (`scripts/run-security-tests.sh`)

New script that maps security-critical source files to their mandatory test suites:

```bash
SECURITY_MAP=(
  "packages/backend/src/utils/ssrf.ts:packages/backend/src/utils/__tests__/ssrf.test.ts"
  "packages/backend/src/middleware/auth.ts:packages/backend/src/middleware/__tests__/auth.test.ts"
  "packages/backend/src/middleware/csrf.ts:packages/backend/src/__tests__/middleware/csrf.test.ts"
  "packages/backend/src/routes/auth.ts:packages/backend/src/middleware/__tests__/auth.test.ts"
)

# For each staged file, check if it matches a security source pattern
for mapping in "${SECURITY_MAP[@]}"; do
  source_pattern="${mapping%%:*}"
  test_file="${mapping##*:}"
  if echo "$STAGED_FILES" | grep -q "$source_pattern"; then
    SECURITY_TESTS="$SECURITY_TESTS $test_file"
  fi
done
```

This runs BEFORE the general test step, so security regressions are caught first with fast feedback.

### 3. Pre-Push Hook (`.husky/pre-push`)

Replaced `npm test` (full suite) with the same convention-based discovery used in pre-commit, but scoped to `git diff origin/main...HEAD` (committed changes, not staged):

```bash
CHANGED=$(git diff origin/main...HEAD --name-only 2>/dev/null || \
          git diff HEAD~1...HEAD --name-only 2>/dev/null || true)
```

The fallback chain handles edge cases: no remote tracking branch, initial push, etc.

### 4. Package.json

Added `test:security-critical` npm script for manual invocation of all security test suites.

## Key Learnings

### 1. Error Suppression in Hooks is an Anti-Pattern

`2>/dev/null || true` after any command in a git hook makes failures invisible. The hook's entire purpose is to block on failure. If a command is expected to sometimes fail gracefully, handle the specific exit code:

```bash
# WRONG — hides all errors, including real failures
npx jest --findRelatedTests $FILES 2>/dev/null || true

# RIGHT — let errors propagate and block the commit
npx vitest run --bail 1 $FILES

# RIGHT — handle specific expected conditions
if [ -n "$TEST_FILES" ]; then
  npx vitest run --bail 1 $TEST_FILES
fi
```

### 2. `vitest related` vs Convention-Based Discovery

| Approach                                               | Pros                                       | Cons                                                                       |
| ------------------------------------------------------ | ------------------------------------------ | -------------------------------------------------------------------------- |
| `vitest related`                                       | Finds indirect dependents via import graph | Loads entire project; hits compile errors in unrelated files; slow startup |
| Convention-based (`foo.ts` -> `__tests__/foo.test.ts`) | Fast; no compilation; predictable          | Misses indirect dependents; requires naming convention compliance          |

For pre-commit hooks where speed matters and false negatives are acceptable (CI catches the rest), convention-based wins.

### 3. Vitest CLI Differences from Jest

- `--bail` requires a number: `--bail 1` (not boolean `--bail`)
- `--project backend` + explicit file paths = runs ALL backend tests (not just specified files). Drop `--project` when passing paths.
- `--passWithNoTests` flag works the same as Jest

### 4. Pre-Push Hooks Must Not Run Full Test Suites

When pre-existing failures exist (121 in our case), a full suite run always fails. Developers bypass with `--no-verify`, which defeats ALL hooks (including non-test checks). Project-scoped or file-scoped tests are the fix.

### 5. Security-Critical File Mapping Pattern

Explicit source-to-test mapping is more reliable than import graph analysis for security files because:

- It's deterministic (no static analysis failures)
- It's extensible (add new mappings to the array)
- It documents the security boundary (which files are security-critical)
- It runs the full test suite for the security domain, not just directly-related tests

### 6. Hook Migration Checklist

When switching test frameworks, these artifacts need updating (in addition to config and test files):

- [ ] `.husky/pre-commit` — test runner commands
- [ ] `.husky/pre-push` — test runner commands
- [ ] `scripts/` — any custom test scripts
- [ ] `package.json` — npm test scripts
- [ ] `.github/workflows/` — CI test steps
- [ ] `CLAUDE.md` / dev docs — test command references
- [ ] Error suppression removal — audit for `2>/dev/null || true` patterns

## Prevention

1. **Add hooks to the migration checklist.** Any test framework migration PR must include a "hooks updated" checkbox.
2. **Never suppress errors in hooks.** Grep for `2>/dev/null || true` in `.husky/` after any infrastructure change.
3. **Test the hooks themselves.** After modifying hooks, stage a security file and verify the security tests actually run.
4. **Extend the SECURITY_MAP.** When adding new security-critical files (rate limiting, input validation, etc.), add an entry to `scripts/run-security-tests.sh`.

## Verification

```bash
# Security test detection works:
git add packages/backend/src/utils/ssrf.ts
# -> "Security file changed: packages/backend/src/utils/ssrf.ts"
# -> "Running test suite: packages/backend/src/utils/__tests__/ssrf.test.ts"
# -> 70 tests pass in 145ms

# No staged files = clean exit:
git stash && git commit --allow-empty -m "test" && git stash pop
# -> No security tests triggered, exits cleanly

# Manual invocation:
npm run test:security-critical
# -> Runs all 3 security suites (ssrf, auth, csrf)
```

## Files Changed

4 files changed, +187 / -36 lines:

- `.husky/pre-commit` — Convention-based test discovery + security test step
- `.husky/pre-push` — Project-scoped tests via committed diff
- `scripts/run-security-tests.sh` (NEW) — Security-critical file-to-test mapping
- `package.json` — Added `test:security-critical` script

## Related

- [Quality Pipeline Vitest Migration (02-20)](quality-pipeline-vitest-migration-20260220.md) — The migration that missed hook updates
- [P2/P3 Remediation R6 (02-21)](../security-issues/) — PR #89 review that found SSRF findings #423, #424
- [Critical Patterns: SSRF Validation](../patterns/critical-patterns.md#6-ssrf-validation-4-p1s-in-security-sprints) — SSRF test suite being enforced
- [Common Solutions: Git Diff for Hooks](../patterns/common-solutions.md#12-git-diff-for-hooks-pre-commit-vs-pre-push) — Existing pattern refined by this PR
