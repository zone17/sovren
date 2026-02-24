---
status: complete
priority: p3
issue_id: 492
tags: [code-review, dead-code, yagni, simplicity]
dependencies: []
---

# ~102 LOC of dead code: unused helper, exports, POM locators

## Problem Statement

The commit ships several files/exports that are not imported or used anywhere:

## Findings

| File                         | Dead Code                                                                              | LOC |
| ---------------------------- | -------------------------------------------------------------------------------------- | --- |
| `e2e/helpers/nostr-auth.ts`  | Entire file — not imported; commit switches to demo auth                               | ~61 |
| `e2e/fixtures/test-users.ts` | `getTestUser()`, `getAllTestUsers()`, `getTestUserPublicKeys()`, 5 shorthand constants | ~16 |
| `e2e/pages/wellness.page.ts` | 5 unused locators (sustainableScheduler through wellnessResources)                     | ~7  |
| `msw/handlers/helpers.ts`    | `jsonError` function — zero usages                                                     | ~10 |
| `apiClient.ts`               | `_token` field serves no current use case (localStorage-only would suffice)            | ~8  |

**Total: ~102 LOC removable (~6% of 1,749 added)**

## Proposed Solutions

### Option A: Remove dead code in follow-up commit

Delete unused files/exports. Re-add when needed.

- **Effort:** Small (15 min)

## Acceptance Criteria

- [x] No exported functions with zero external callers
- [x] POM locators match actual test assertions

## Work Log

| Date       | Action                           | Learnings                                                                                                                                                                                                            |
| ---------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-02-24 | Created from /workflows:review   | Simplicity reviewer identified all items                                                                                                                                                                             |
| 2026-02-24 | Fixed: removed ~33 LOC dead code | Kept nostr-auth.ts (infrastructure for planned real auth, just updated in P2 #491). Kept `_token` (functional write-through cache). Removed: test-users.ts helpers+shorthands, wellness POM CSS locators, jsonError. |
