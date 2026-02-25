---
status: complete
priority: p2
issue_id: '501'
tags:
  - code-review
  - playwright
  - e2e-testing
  - dead-code
dependencies: []
---

# Unused E2E Fixture/Helper Files (~487 LOC)

## Problem Statement

Three files in the E2E layer export public APIs with zero imports across the entire spec suite:

- `fixtures/test-events.ts` (~328 LOC) — 12 NOSTR event generators, 2 static data sets, `isValidEvent` type guard
- `fixtures/test-users.ts` (~95 LOC) — 5 deterministic NOSTR keypairs (alice through eve)
- `helpers/nostr-auth.ts` (~64 LOC) — Real NOSTR challenge-response auth against backend API

These files were created during the E2E mock elimination sprint as infrastructure for upcoming NOSTR-specific E2E tests (`USE_BACKEND=1` mode). No such tests exist yet. The files add maintenance surface — any NOSTR key format change or nostr-tools migration requires updating them even though no test exercises them.

**Context:** `nostr-auth.ts` was previously identified as "planned infrastructure" during P3 Cleanup (02-24) and deliberately kept. The decision may still apply — triage should verify whether upcoming work warrants keeping these.

## Findings

**Agent consensus: 3/4** (pattern-recognition-specialist, code-simplicity-reviewer, kieran-typescript-reviewer)

- `test-events.ts` also has a non-null assertion on `match()` result (kieran-typescript P1 within the file, but moot if deleted)
- `test-events.ts` has emoji in JSDoc header (style violation)
- `test-users.ts` has `Record<string, string>` index signature that allows undefined lookup (kieran-typescript P1 within the file, but moot if deleted)
- `nostr-auth.ts` has implicit `any` types from untyped `json()` return values

## Proposed Solutions

### Option A: Delete all three files (Recommended if no NOSTR E2E planned soon)

- Pros: -487 LOC, eliminates maintenance surface, makes coverage gap explicit
- Cons: Must recreate from git history when NOSTR E2E tests are written
- Effort: Small
- Risk: Low (zero imports, nothing breaks)

### Option B: Keep and add placeholder comments

Add `// NOT YET USED — placeholder for upcoming NOSTR E2E tests` at the top of each file.

- Pros: Zero code loss, intent is documented
- Cons: Maintenance cost continues, drift risk from nostr-tools changes
- Effort: Small
- Risk: Low

### Option C: Delete test-events.ts and test-users.ts, keep nostr-auth.ts

The auth helper is the most likely to be needed first (when USE_BACKEND=1 testing begins). The event/user fixtures are speculative.

- Pros: -423 LOC, keeps the most valuable helper
- Cons: Partial cleanup, still maintaining one unused file
- Effort: Small
- Risk: Low

## Technical Details

**Affected files:**

- `packages/frontend/e2e/fixtures/test-events.ts` (entire file)
- `packages/frontend/e2e/fixtures/test-users.ts` (entire file)
- `packages/frontend/e2e/helpers/nostr-auth.ts` (entire file)

## Acceptance Criteria

- [ ] Decision made: delete, keep with comments, or partial delete
- [ ] If deleted: zero files in `e2e/fixtures/` or `e2e/helpers/` with no imports
- [ ] All 20 E2E tests still pass
- [ ] CLAUDE.md structure diagram updated to reflect any removed files

## Work Log

| Date       | Action                                                     | Outcome            |
| ---------- | ---------------------------------------------------------- | ------------------ |
| 2026-02-24 | Flagged by 3/4 review agents (pattern, simplicity, kieran) | P2 — dead code     |
| 2026-02-24 | Deleted all 3 files (Option A), removed empty helpers/ dir | Fixed — 20/20 pass |
