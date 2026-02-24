---
module: E2E Testing / Frontend
date: 2026-02-24
problem_type: code_quality
component: e2e_tests
symptoms:
  - '~102 LOC flagged as dead code across 5 files by simplicity reviewer'
  - 'Wellness POM uses CSS class selectors — violates role-based locator convention'
  - 'Unused helper functions and shorthand constants in test-users.ts'
  - 'MSW jsonError helper exported but never imported'
root_cause: review_findings
severity: low
tags: [p3-remediation, dead-code, yagni, pom-conventions, e2e]
related_issues:
  - 'Todo #492 — Dead code: unused helpers, exports, POM locators'
  - 'Todo #493 — Wellness POM CSS class selectors'
sprint: 'PR post-review P3 remediation (02-24)'
---

# P3 Remediation: Dead Code Cleanup + POM Convention Fix

## Context

10-agent parallel review of commit `68a92d3` produced 6 findings (1 P1, 3 P2, 2 P3). After fixing the P1 and 3 P2s in prior commits, this final commit resolved the 2 P3 findings.

## Verification Before Implementation

**Cross-cutting pattern applied:** "Verify todos against source before implementing" — descriptions go stale across sprints.

The todo claimed ~102 LOC removable across 5 files. Verification found:

| Item                                  | Todo Claim                               | Actual Status                                                                    | Action      |
| ------------------------------------- | ---------------------------------------- | -------------------------------------------------------------------------------- | ----------- |
| `e2e/helpers/nostr-auth.ts`           | Entire file dead (~61 LOC)               | Just updated in P2 #491 with shared import; infrastructure for planned real auth | **Kept**    |
| `test-users.ts` helpers               | 3 functions + 5 constants dead (~16 LOC) | Confirmed: zero callers outside the file                                         | **Removed** |
| `wellness.page.ts` locators           | 7 CSS class locators dead (~7 LOC)       | Confirmed: zero assertions use them                                              | **Removed** |
| `msw/handlers/helpers.ts` `jsonError` | Function dead (~10 LOC)                  | Confirmed: `jsonOk`/`jsonPaginated` used in 7 files, `jsonError` in zero         | **Removed** |
| `apiClient.ts` `_token`               | Field dead (~8 LOC)                      | **Not dead** — functional write-through cache for `getEffectiveToken()`          | **Kept**    |

**Result:** 33 LOC removed (not 102). 2 of 5 items were functional code, not dead code.

## Fix 1: Wellness POM Convention Fix (#493)

### Symptom

`e2e/pages/wellness.page.ts` lines 27-33 used `[class*="BurnoutRiskGauge"]` patterns. CLAUDE.md states: "Use role-based locators — never CSS selectors or test IDs." All 7 locators were also unused in any test.

### Solution

Removed all 7 CSS class locators. Kept 3 role-based locators (heading, subheading, pulseCheckInButton) that are used in tests.

```typescript
// ❌ REMOVED — CSS class selectors, unused, convention violation
this.burnoutRiskGauge = page.locator('[class*="BurnoutRiskGauge"]').first();
this.sustainableScheduler = page.locator('[class*="SustainableScheduler"]').first();
// ... 5 more

// ✅ KEPT — role-based locators, used in tests
this.heading = page.getByRole('heading', { name: 'Creator Wellness' });
this.subheading = page.getByText('Monitor your work patterns');
this.pulseCheckInButton = page.getByRole('button', { name: 'Pulse Check-In' });
```

## Fix 2: Dead Code Removal (#492)

### Removed from `test-users.ts`

```typescript
// ❌ REMOVED — one-liner wrappers with zero callers
export function getTestUser(id) { return TEST_USERS[id]; }
export function getAllTestUsers() { return Object.values(TEST_USERS); }
export function getTestUserPublicKeys() { ... }
export const ALICE = TEST_USERS.alice; // ... through EVE
```

Consumers should use `TEST_USERS.alice` directly.

### Removed from `msw/handlers/helpers.ts`

```typescript
// ❌ REMOVED — zero imports across 7 handler files
export function jsonError(message: string, status: number) { ... }
```

`jsonOk` and `jsonPaginated` remain — used in 7 handler files.

### Kept: `e2e/helpers/nostr-auth.ts`

This file was **just updated** in P2 #491 (added `createSignatureMessage` from shared). It implements real NOSTR challenge-response auth for E2E tests — infrastructure for the planned "true E2E real backend" feature. Deleting and recreating would waste effort.

### Kept: `apiClient.ts` `_token`

The `_token` field is a write-through cache: `setToken()` writes both `_token` and localStorage, `getEffectiveToken()` checks `_token` first. This avoids localStorage access on every API call. Functional, not dead.

## Sprint Metrics

- **Commit:** `b52e06a` pushed to main
- **Files changed:** 8 (3 source + 2 pattern files + 1 compound doc + 2 todos)
- **Lines:** +292/-81 (includes pattern files and compound doc from P2 sprint)
- **Dead code removed:** ~33 LOC
- **Pre-commit:** lint + format pass, no related tests found
- **Pre-push:** pass

## Key Learnings

1. **Verify todo items against current source before implementing.** 2 of 5 items in the todo were NOT dead code — `_token` is a functional cache and `nostr-auth.ts` is infrastructure for a planned feature. Blindly deleting everything the todo lists would have broken `apiClient` and wasted future effort recreating the auth helper.

2. **Infrastructure for planned features is not dead code.** `nostr-auth.ts` had zero callers but was just updated in the same sprint. It exists for the upcoming real backend E2E work. The YAGNI principle applies to speculative abstractions, not to infrastructure you're actively building toward.

3. **CSS class selectors in POMs are a convention violation AND fragile.** `[class*="BurnoutRiskGauge"]` breaks if the component is renamed, CSS modules change hash, or Tailwind purges the class. Role-based locators (`getByRole`, `getByLabel`, `getByText`) are resilient to implementation changes.

4. **Solo > team for 2 tightly-scoped P3 fixes.** Consistent with P2 remediation pattern from same session and prior sprints (P2 Deferred Fixes 02-14, P2 Remediation 02-24).

## Prevention

- **For dead code:** When adding exports, immediately add at least one import/usage. If it's infrastructure for a future sprint, add a `// Used by: [planned feature]` comment so reviewers don't flag it.
- **For POM conventions:** All POM locators must use role-based selectors (`getByRole`, `getByLabel`, `getByText`). When source components lack accessible roles, add them to the component first, then create the POM locator.
- **For todo verification:** Always `grep` for each item in the todo before implementing. Descriptions written at review time may be stale by fix time (validated in 76% stale rate from PR #96 triage).

## Cross-References

- `docs/solutions/code-quality/p2-remediation-review-sprint-dedup-redis-seed-20260224.md` — P2 fixes from same review sprint
- `docs/solutions/security-issues/nostr-verifyevent-requires-computed-id-20260224.md` — P1 fix from same review sprint
- `docs/solutions/code-quality/p3-sprint1-cleanup-dead-code-architecture.md` — Prior P3 dead code cleanup (223K LOC)
- `docs/solutions/patterns/common-solutions.md` #14 — Shared utility extraction threshold
- `docs/solutions/patterns/common-solutions.md` #25 — Stale todo triage methodology
