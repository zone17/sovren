---
status: complete
priority: p3
issue_id: '503'
tags:
  - code-review
  - playwright
  - e2e-testing
  - cleanup
dependencies: []
---

# Redundant Comments + Unused Imports in E2E Files

## Problem Statement

After the WellnessPage JSDoc removal (#500), several other E2E files still have redundant inline comments and unnecessary imports. These add noise without information — the test names, assertion methods, and variable names already communicate intent.

## Findings

**Agent consensus: 2/4** (code-simplicity-reviewer, pattern-recognition-specialist)

### Redundant comments (~12 LOC across 4 files):

- `auth.public.spec.ts:7` — "Auth tests create their own auth state" (convention already in filename suffix + CLAUDE.md)
- `auth.public.spec.ts:44` — "Login first" (next 3 lines are self-evident)
- `auth.public.spec.ts:49` — "Logout" (calling `profilePage.logout()`)
- `auth.public.spec.ts:52` — "Verify: visiting protected route now redirects" (test name says this)
- `auth.setup.ts:15` — "Demo auth redirects to /profile" (assertion is self-documenting)
- `auth.setup.ts:17` — "Save storage state for downstream tests" (well-known Playwright API)
- `wellness.auth.spec.ts:18` — "Page should render" (test name says this)
- `wellness.auth.spec.ts:21` — "Error boundary should NOT show crash" (assertion is self-evident)
- `wellness.auth.spec.ts:30` — "Modal should appear (WellnessPulseModal)" (implementation detail that goes stale)
- `global-setup.ts:9` — "Create auth directory for storage state" (variable name `authDir` + `mkdir` says this)
- `test-credentials.ts:1-5` — 5-line JSDoc block (file name + export names are self-documenting)

### Unused imports (2 files):

- `global-setup.ts:4` — `FullConfig` type import + `_config` parameter never used
- `global-teardown.ts:1` — `FullConfig` type import + `_config` parameter never used

### Emoji in JSDoc:

- `test-events.ts:3` — Surviving emoji in JSDoc header after wellness.page.ts cleanup

## Proposed Solutions

### Option A: Remove all redundant comments, imports, and emoji (Recommended)

- Pros: ~14 LOC removed, consistent with WellnessPage JSDoc cleanup (#500)
- Cons: None
- Effort: Small
- Risk: Low

## Technical Details

**Affected files:**

- `packages/frontend/e2e/auth.public.spec.ts` (4 comments)
- `packages/frontend/e2e/auth.setup.ts` (2 comments)
- `packages/frontend/e2e/wellness.auth.spec.ts` (3 comments)
- `packages/frontend/e2e/global-setup.ts` (1 comment + unused import/param)
- `packages/frontend/e2e/global-teardown.ts` (unused import/param)
- `packages/frontend/e2e/fixtures/test-credentials.ts` (5-line JSDoc)
- `packages/frontend/e2e/fixtures/test-events.ts` (emoji in JSDoc) — file deleted in #501

## Acceptance Criteria

- [x] Zero redundant inline comments in E2E specs
- [x] No unused `FullConfig` imports
- [x] No emoji in JSDoc headers — moot, file deleted in #501
- [x] Consistent with WellnessPage JSDoc cleanup (#500)
- [x] All 20 E2E tests still pass

## Work Log

| Date       | Action                                                                    | Outcome            |
| ---------- | ------------------------------------------------------------------------- | ------------------ |
| 2026-02-24 | Flagged by code-simplicity + pattern-recognition                          | P3 — cleanup       |
| 2026-02-24 | Removed 11 redundant comments, 2 unused FullConfig imports, 1 JSDoc block | Fixed — 20/20 pass |
