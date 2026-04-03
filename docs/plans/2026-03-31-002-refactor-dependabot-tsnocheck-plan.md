---
title: 'refactor: Dependabot #194 triage + @ts-nocheck 45→<40'
type: refactor
status: active
date: 2026-03-31
origin: docs/brainstorms/2026-03-31-quality-sprint-backlog-burndown-requirements.md
---

# Dependabot #194 Triage + @ts-nocheck 45→<40

## Overview

Two remaining quality items from the sprint backlog. Squad A handles the 35-dep Dependabot PR (triage, split safe from breaking, merge safe). Squad B pushes @ts-nocheck from 45 to <40 by fixing real tsc errors in 6+ files (8-29 errors each — no easy wins remain).

## Problem Frame

PR #194 has 35 production dependency bumps with CI failures (lint, typecheck, security). It can't be merged as-is. The @ts-nocheck count is 45 — all remaining files have real type errors once the directive is removed (documented in quality-sprint-five-learnings-20260331.md Learning #1).

## Requirements Trace

- R2. Triage and merge Dependabot PR #194 (see origin)
- R6. Reduce @ts-nocheck from 45 to <40 (see origin)

## Scope Boundaries

- No growth features
- Dependabot: merge safe bumps only. Breaking changes get `overrides` or are deferred.
- @ts-nocheck: file-by-file with real error fixes. No bulk removal. Consumer cascade strategy from Learning #5.

## Key Technical Decisions

- **Split PR #194 rather than merge whole**: PR has CI failures. Create a new branch, cherry-pick safe patch/minor bumps, leave breaking majors for individual PRs. Rationale: 35 bumps at once is untriageable; splitting by risk lets safe ones land immediately.
- **@ts-nocheck targets by error count**: Pick the 6 files with lowest error counts (8-12 range). Per Learning #1, verify errors AFTER removing directive, not before. Per Learning #5, check for consumer cascades before committing.
- **Node >=20 for native fetch**: Confirmed in repo research — no new deps needed for any work here.

## Implementation Units

### Squad A: Dependabot #194

- [ ] **Unit 1: Triage PR #194 — split safe from breaking**

**Goal:** Review all 35 dependency bumps, classify as safe (patch/minor, no breaking changes) vs risky (major, breaking API, or failing CI).

**Requirements:** R2

**Dependencies:** None

**Files:**

- Read: PR #194 diff via `gh pr diff 194`
- Modify: `package.json` (root), `package-lock.json`

**Approach:**

- Checkout a new branch from main
- `gh pr diff 194 --name-only` to get the list of changed package.json files
- For each bumped package: check if it's patch, minor, or major. Patches and minors with no breaking changelog entries are safe.
- Apply safe bumps manually (update version in package.json, run npm install)
- Run full CI locally: lint, typecheck, frontend tests
- If CI passes, commit and push. If specific bumps break CI, revert those and note them.
- Leave PR #194 open with a comment listing which bumps were cherry-picked and which remain.

**Patterns to follow:**

- docs/solutions/infrastructure-issues/dependency-update-pr99-patterns.md: React hoisting, lockfile precedence, workspace version agreement

**Test scenarios:**

- Happy path: Apply 30 safe patch/minor bumps → npm install → lint passes → typecheck passes → frontend tests pass
- Error path: A minor bump introduces a breaking type change → typecheck fails → revert that specific bump, note in PR comment
- Edge case: Two bumps conflict (e.g., both update a shared transitive dep to different versions) → resolve via npm overrides in root package.json

**Verification:**

- New PR created with safe bumps merged
- PR #194 has a comment documenting which bumps were included and which were deferred
- `npm audit --audit-level=critical` returns 0 critical vulnerabilities
- CI passes on the new branch

---

### Squad B: @ts-nocheck 45→<40

- [ ] **Unit 2: Triage remaining @ts-nocheck files by real error count**

**Goal:** Remove @ts-nocheck from each target file, count actual tsc errors, and rank by difficulty.

**Requirements:** R6

**Dependencies:** None

**Files:**

- All 45 files with @ts-nocheck (list via `grep -rl "@ts-nocheck" packages/ --include="*.ts" --include="*.tsx"`)

**Approach:**

- For each file: remove directive in temp, run `npx tsc -p packages/backend/tsconfig.json --noEmit 2>&1 | grep "<filename>" | wc -l`, record count, restore directive
- Sort by error count ascending
- Pick the 6 lowest (likely 8-12 errors each based on prior sprint data)
- Check each target for consumer cascade risk (does any other file import from it?)

**Test expectation:** none — research/triage step, no code changes

**Verification:**

- Ranked list of all 45 files with real error counts
- 6 targets selected with error counts and cascade risk assessed

---

- [ ] **Unit 3: Fix @ts-nocheck file 1-3 (lowest error count)**

**Goal:** Remove @ts-nocheck from 3 files and fix all tsc + eslint errors.

**Requirements:** R6

**Dependencies:** Unit 2 (target selection)

**Files:**

- 3 files from Unit 2's ranked list (exact paths determined at implementation time)
- Test files for those services if they exist

**Approach:**

- For each file: remove `// @ts-nocheck`, run tsc, fix each error:
  - Wrong method names → check interface, rename
  - Missing properties → add to return objects or update interface
  - Type mismatches (snake_case vs camelCase) → use mapRow pattern from BusinessInvoiceService
  - Unused vars → prefix with `_`
- Run eslint --fix after tsc is clean
- Check for consumer cascades (Learning #5): if removing @ts-nocheck breaks a consumer, fix the consumer too or defer the file
- Update ci/ts-nocheck-baseline.txt

**Patterns to follow:**

- PR #212 approach: file-by-file, eslint --fix first, then tsc errors
- BusinessInvoiceService.toBusinessInvoice() for row mapping pattern
- docs/solutions/workflow-issues/quality-sprint-five-learnings-20260331.md: all 5 learnings

**Test scenarios:**

- Happy path: Remove @ts-nocheck → fix 8-12 errors → tsc clean → eslint clean → CI passes
- Error path: File has >15 errors after triage shows 8 → some errors are in imported types, not the file itself → re-add @ts-nocheck, pick next file
- Edge case: Fixing a service breaks its consumer (ContentController pattern) → fix consumer in same PR or defer the service

**Verification:**

- 3 fewer @ts-nocheck files
- tsc and eslint pass on all modified files
- No test regressions

---

- [ ] **Unit 4: Fix @ts-nocheck file 4-6 (next lowest)**

**Goal:** Remove @ts-nocheck from 3 more files. Same approach as Unit 3.

**Requirements:** R6

**Dependencies:** Unit 3 (clean state)

**Files:**

- 3 more files from Unit 2's ranked list

**Approach:** Same as Unit 3.

**Test scenarios:** Same as Unit 3.

**Verification:**

- 6 total fewer @ts-nocheck files → count <40
- ci/ts-nocheck-baseline.txt updated
- CI passes

## Risks & Dependencies

| Risk                                                        | Mitigation                                                                                             |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Dependabot safe bumps still break CI due to transitive deps | Use npm overrides for transitive conflicts. Test each batch of 5-10 bumps incrementally.               |
| @ts-nocheck files have more errors than triage shows        | Unit 2 does real measurement first. If all files have >15 errors, reduce target to <42 instead of <40. |
| Consumer cascade blocks @ts-nocheck removal                 | Per Learning #5, check imports before committing. Fix consumer if small, defer file if large.          |
| npm audit finds new critical CVE in safe bumps              | Address CVE-specific bump first before general safe bumps.                                             |

## Sources & References

- Origin: docs/brainstorms/2026-03-31-quality-sprint-backlog-burndown-requirements.md
- Learnings: docs/solutions/workflow-issues/quality-sprint-five-learnings-20260331.md
- @ts-nocheck pattern: docs/solutions/workflow-issues/ts-nocheck-bulk-removal-cascade-pattern-20260330.md
- Dep patterns: docs/solutions/infrastructure-issues/dependency-update-pr99-patterns.md
- PR #194, PRs #212-214 (prior @ts-nocheck work)
