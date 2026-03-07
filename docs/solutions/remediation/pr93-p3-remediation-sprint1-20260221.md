---
title: PR #93 P3 Remediation Sprint 1 — 20 P3 Findings, Scanner Hardening, Frontend Fixes
date: '2026-02-21'
pr: 93
branch: fix/p3-remediation-sprint-1
category: remediation
severity: P3
status: merged
parent_review: PR #92
todos: 435-458
---

# PR #93 P3 Remediation Sprint 1

## Summary

Remediated 20 P3 findings (todos 435–458) from the PR #92 review using 5 parallel domain-grouped agents. Sprint also delivered significant pre-commit hook hardening (3 bugs fixed) and a post-sprint review that found 0 P1 findings. Merged to main on 2026-02-21.

**Key numbers:**

- 20 P3 todos fixed (435–458), all completed
- 5 parallel agents: backend-services, backend-infra, frontend-tests, frontend-components, docs
- 41 files changed, +1430/-352 lines
- 0 merge conflicts (domain-grouped agents with non-overlapping files)
- 7 review agents: 0 P1, 2 P2 (fixed in-sprint), 6 P3 (todos 461–466), 3 Informational
- Pre-commit scanner: 3 bugs fixed, now exits 0

---

## Findings Fixed

| Todo    | Description                                                           | Agent               | Domain   |
| ------- | --------------------------------------------------------------------- | ------------------- | -------- |
| 435     | Anti-pattern scanner BRE grep bug (`^\+\+\+`)                         | backend-infra       | tooling  |
| 436     | Scanner `any` regex too narrow                                        | backend-infra       | tooling  |
| 437     | Scanner no test-utils exclusion                                       | backend-infra       | tooling  |
| 438     | Scanner auth check single-line grep missing multiline routes          | backend-infra       | tooling  |
| 439     | MarketplaceService SSRF validation sequential (should be parallel)    | backend-services    | services |
| 440     | Missing `MAX_PORTFOLIO_URLS` cap in MarketplaceService                | backend-services    | services |
| 441     | Non-deterministic BullMQ job IDs                                      | backend-services    | queues   |
| 442     | Missing `removeJob()` interface method                                | backend-services    | queues   |
| 443     | Missing FK violation handling for job ID collisions                   | backend-services    | queues   |
| 444     | Env-validation fire-and-forget (no timeout)                           | backend-services    | startup  |
| 445     | `process.exit(1)` in library code kills test runners                  | backend-services    | startup  |
| 446     | NostrKeyManagementService interval not cleaned up on destroy          | backend-services    | memory   |
| 447     | `console.error` in useCircles (should be `toast.error`)               | frontend-components | UX       |
| 448     | Double Redux store in test-providers                                  | frontend-tests      | testing  |
| 449\*   | Wrong error class (`ValidationError` instead of `AuthorizationError`) | backend-services    | errors   |
| 450\*   | `any` types in supabase-mock test utility                             | frontend-tests      | testing  |
| 451\*   | `MAX_PORTFOLIO_URLS` duplicated across service and its own const      | backend-services    | services |
| 452     | `waitForQueriesToSettle` was a no-op (forEach does not await)         | frontend-tests      | testing  |
| 453     | `createMockChain()` missing from shared test utilities                | frontend-tests      | testing  |
| 454–458 | Various type safety: `any` → `unknown` in NostrKeyManagementService   | backend-services    | types    |

\*Todos 449, 450, 451 were review findings from PR #93 itself, fixed in-sprint before merge.

---

## Technical Changes in Depth

### 1. Pre-Commit Scanner Hardening (3 Bugs Fixed)

The anti-pattern scanner in `scripts/check-antipatterns.sh` had three separate bugs that caused false positives or false negatives.

#### Bug 1: BRE Regex Incompatibility (macOS BSD grep)

**Root cause:** `grep -v '^\+\+\+'` uses BRE (Basic Regular Expression) mode. On macOS BSD grep, `\+` is treated as a literal `+` repetition operator rather than the GNU extension meaning "one or more". The `^` anchors to the start of the diff hunk header line, but the `\+` part is parsed differently, causing the exclusion to silently fail — diff headers were not being stripped, corrupting the line-by-line analysis.

**Fix:** Replace BRE `\+` with the equivalent `-F` fixed-string mode:

```bash
# BEFORE — BRE \+ breaks on macOS BSD grep
git diff --cached | grep -v '^\+\+\+'

# AFTER — Fixed string match, portable across GNU and BSD grep
git diff --cached | grep -vF '+++'
```

**Why `grep -vF` and not `grep -vE`?** The pattern `+++` is a literal string (diff hunk header). `-F` (fixed-string) is both more readable and faster than `-E '^\+\+\+'`.

#### Bug 2: `any` Regex Too Narrow

**Problem:** The scanner checked only for `: any` (with a colon) but missed patterns like `as any`, `<any>`, `Array<any>`, and bare `any` type annotations.

**Fix:** Broadened the regex to match common `any` usage patterns:

```bash
# BEFORE
grep -n ': any' "$file"

# AFTER — covers `: any`, `as any`, `<any>`, `Array<any>`
grep -nE '(: any|as any|<any>|Array<any>)' "$file"
```

#### Bug 3: Test-Utils False Positives

**Problem:** The scanner was flagging `any` types in `test-utils/` directories and `vitest.*setup` files. These files intentionally use `any` to provide flexible mock helpers.

**Fix:** Added explicit exclusion for test infrastructure:

```bash
# Skip test utility files — flexible types are intentional there
if [[ "$file" == *"test-utils"* ]] || [[ "$file" =~ vitest.*setup ]]; then
  continue
fi
```

#### Bug 4: Multiline Auth Check

**Problem:** The auth check used single-line grep to detect unprotected Express routes. Routes written across multiple lines (handler on next line, middleware chain split) were not detected.

**Fix:** Rewrote to use a 5-line `sed` sliding window:

```bash
# BEFORE — single-line grep misses multiline route definitions
grep -n 'router\.\(get\|post\|put\|delete\)' "$file" | grep -v 'authenticate'

# AFTER — 5-line sliding window catches multiline route definitions
sed -n '/router\.\(get\|post\|put\|delete\)/,+4p' "$file" \
  | grep -B4 'handler\|Controller' \
  | grep -v 'authenticate'
```

---

### 2. Parallel SSRF Validation in MarketplaceService

**Problem:** Portfolio URL validation ran sequentially. For 20 URLs, this adds ~1–2s latency (50ms DNS per URL).

**Fix:** Changed to `Promise.all()` with a `MAX_PORTFOLIO_URLS` cap:

```typescript
// BEFORE — sequential
for (const url of portfolioUrls) {
  await validateSsrfUrl(url);
}

// AFTER — parallel with cap
const MAX_PORTFOLIO_URLS = 20;

if (portfolioUrls.length > MAX_PORTFOLIO_URLS) {
  throw new ValidationError(`Maximum ${MAX_PORTFOLIO_URLS} portfolio URLs allowed`);
}

await Promise.all(portfolioUrls.map((url) => validateSsrfUrl(url)));
```

**Why `Promise.all` (not `Promise.allSettled`)?** SSRF validation is fail-fast: if ANY URL is invalid, the entire batch should be rejected. `Promise.all` short-circuits on the first rejection, which is the correct semantic for validation.

**Contrast with test utility:** `waitForQueriesToSettle` (below) uses `Promise.allSettled` because partial success is acceptable for test settling — we want to wait for all queries regardless of individual outcomes.

---

### 3. Deterministic BullMQ Job IDs

**Problem:** CrossPostService added BullMQ jobs without specifying a `jobId`. BullMQ generates random UUIDs by default, making it impossible to cancel a pending job without a DB lookup.

**Fix:** Use a deterministic pattern: `{operation}-${entity.id}`:

```typescript
// BEFORE — random job ID, cannot cancel by computation
await queue.add('cross-post', { content_id, platform });

// AFTER — deterministic ID, cancel is a pure computation
await queue.add('cross-post', { content_id, platform }, { jobId: `crosspost-${row.id}` });

// Cancel without DB lookup:
await queue.remove(`crosspost-${row.id}`);
```

**FK violation handling:** When the same `jobId` is submitted twice (e.g., retry after network failure), BullMQ throws an FK violation if `removeOnComplete: false` and the previous job still exists. Added handling:

```typescript
try {
  await queue.add('cross-post', payload, { jobId });
} catch (err) {
  if (err?.code === '23505') {
    // Job already exists — idempotent, not an error
    logger.debug(`Job ${jobId} already queued, skipping duplicate add`);
    return;
  }
  throw err;
}
```

---

### 4. Promise.race Timeout for Env Validation

**Problem:** Env validation fire-and-forget pattern had two issues:

1. No timeout — could block startup indefinitely if the validation endpoint was slow
2. Used `process.exit(1)` which kills the entire process (and test runners)

```typescript
// BEFORE — fire and forget, no timeout, kills test runners
validateEnv().catch(() => process.exit(1));
```

**Fix:** Bounded 5s timeout + `throw new Error()` for testability:

```typescript
// AFTER — bounded, testable
const VALIDATION_TIMEOUT_MS = 5000;

try {
  await Promise.race([
    validateEnv(),
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error('Env validation timed out after 5s')),
        VALIDATION_TIMEOUT_MS
      )
    ),
  ]);
} catch (err) {
  logger.error('Environment validation failed', { error: err });
  throw err; // Let the caller (server startup) decide whether to exit
}
```

**Rule:** Library/utility code must never call `process.exit()`. Only the top-level entry point (`server.ts`, `main.ts`) should decide to terminate the process.

---

### 5. NostrKeyManagementService Memory Leak Fix

**Problem:** A `setInterval` for key rotation polling was created in the constructor but never cleared in `destroy()`. In tests, this kept the Node.js event loop alive after the test ended.

**Fix:**

```typescript
class NostrKeyManagementService {
  private rotationInterval?: NodeJS.Timeout;

  constructor() {
    this.rotationInterval = setInterval(() => this.rotateKeys(), ROTATION_INTERVAL_MS);
  }

  destroy(): void {
    if (this.rotationInterval) {
      clearInterval(this.rotationInterval);
      this.rotationInterval = undefined;
    }
  }
}
```

**Pattern:** Every class that creates timers or event listeners must implement `destroy()` that clears them. This mirrors TTLCache's `destroy()` pattern (common-solutions.md #2).

---

### 6. Frontend: `console.error` → `toast.error` in useCircles

**Problem:** Error handling in `useCircles` hook logged to console but gave no visible feedback to the user.

**Fix:**

```typescript
// BEFORE — invisible to user
} catch (err) {
  console.error('Failed to load circles', err);
}

// AFTER — user-visible feedback
} catch (err) {
  toast.error('Failed to load circles. Please try again.');
  logger.error('Failed to load circles', { error: err }); // Keep server-side log
}
```

---

### 7. Double Redux Store in Test Providers

**Problem:** `test-providers.tsx` was creating two Redux store instances — one in the wrapper and one from the real app config — causing state isolation failures between tests.

**Fix:** Passed the store as a prop to `renderWithProviders`, defaulting to a fresh store per test:

```typescript
function renderWithProviders(
  ui: React.ReactElement,
  { store = setupStore(), ...renderOptions } = {}
) {
  return render(<Provider store={store}>{ui}</Provider>, renderOptions);
}
```

---

### 8. `waitForQueriesToSettle` No-Op Fix

**Problem:** `waitForQueriesToSettle` used `forEach` which returns `undefined`. The `return` statement inside the callback returned from the callback function, not from `waitForQueriesToSettle`. The function always resolved immediately without waiting.

```typescript
// BEFORE — no-op: forEach ignores return values
async function waitForQueriesToSettle(queryClient: QueryClient): Promise<void> {
  return queryClient
    .getQueryCache()
    .getAll()
    .forEach(async (query) => {
      if (query.state.fetchStatus === 'fetching') {
        await query.fetch(); // This await is in callback scope, not outer scope
      }
    });
}
```

**Fix:** Convert to `filter` + `map` + `Promise.allSettled`:

```typescript
// AFTER — correctly awaits all in-flight queries
async function waitForQueriesToSettle(queryClient: QueryClient): Promise<void> {
  const fetchingQueries = queryClient
    .getQueryCache()
    .getAll()
    .filter((query) => query.state.fetchStatus === 'fetching');

  await Promise.allSettled(fetchingQueries.map((query) => query.fetch()));
}
```

**Why `Promise.allSettled` (not `Promise.all`)?** Test utilities want to wait for ALL queries to finish, regardless of which ones succeed or fail. `Promise.allSettled` is the correct choice when "wait for all" is the goal and partial failure is acceptable.

---

### 9. `createMockChain()` Extracted to Shared Test Utilities

`createMockChain()` was duplicated across 4+ test files with slight variations. Extracted to `packages/testing/src/supabase-mock.ts` as the canonical implementation.

---

### 10. `any` → `unknown` in NostrKeyManagementService

Interfaces in `NostrKeyManagementService` used `any` for key metadata and event payloads. Migrated to `unknown` with runtime narrowing.

---

## Review Results (7 Agents)

| Category      | Count | Disposition                      |
| ------------- | ----- | -------------------------------- |
| P1 findings   | 0     | —                                |
| P2 findings   | 2     | Fixed in-sprint (todos 449, 451) |
| P3 findings   | 6     | Deferred (todos 461–466)         |
| Informational | 3     | Noted, no action                 |

### Deferred (todos 461–466)

| Todo | Description                                                        | Severity |
| ---- | ------------------------------------------------------------------ | -------- |
| 461  | Add row count assertion after cancel operation                     | P3       |
| 462  | Mock chain terminal methods missing in some tests                  | P3       |
| 463  | Promise.race timer should be cleaned up if validate resolves first | P3       |
| 464  | Queue mock factory should be extracted to shared test utils        | P3       |
| 465  | Deduplicate URLs before `Promise.all` validation loop              | P3       |
| 466  | `grep -vF` portability: document why `-F` not `-E`                 | P3       |

---

## Patterns Discovered or Refined

### NEW: grep BRE/ERE Portability — macOS BSD grep vs GNU grep

**Problem:** macOS ships with BSD grep where `\+` in BRE mode is NOT the "one or more" quantifier (that's a GNU extension). Code that works on Linux CI breaks on macOS developer machines.

**Rule:** Use `-F` for fixed-string matches, `-E` for extended regex. Never rely on `\+` in BRE mode.

```bash
# WRONG — BRE \+ is a GNU extension, breaks on macOS BSD grep
grep -v '^\+\+\+'  # \+ is not portable

# RIGHT — fixed string match, portable across GNU and BSD
grep -vF '+++'

# RIGHT — explicit ERE mode, portable
grep -Ev '^\+{3}'  # Or: grep -E -v '^\+\+\+'
```

**Detection:** Search for `grep` (without `-F` or `-E`) where the pattern contains `\+`, `\?`, or other BRE/GNU-only constructs.

**When to apply:** All shell scripts intended to run on macOS (developer machines) AND Linux (CI/CD). Default to `-E` for any pattern with quantifiers.

---

### NEW: `Array.forEach` Async No-Op Bug

**Problem:** `forEach` returns `undefined`. Any `return` inside its callback exits the callback, not the enclosing function. `await` inside a `forEach` callback does NOT propagate to the outer function — the outer function resolves immediately.

```typescript
// WRONG — completely no-op async behavior
async function waitForAll(items: Item[]): Promise<void> {
  return items.forEach(async (item) => {
    await processItem(item); // This await is inside the forEach callback
    // The return exits the callback, not waitForAll
  });
  // Function returns before any processing happens
}

// RIGHT — use for...of for sequential, map+Promise.all/allSettled for parallel
async function waitForAll(items: Item[]): Promise<void> {
  // Sequential (when order matters):
  for (const item of items) {
    await processItem(item);
  }
}

async function waitForAllParallel(items: Item[]): Promise<void> {
  // Parallel (when order does not matter):
  await Promise.allSettled(items.map((item) => processItem(item)));
}
```

**Detection:** Grep for `forEach(async` — every instance is a potential no-op bug. Also grep for `return someArray.forEach` since `forEach` always returns `undefined`.

**When to use which Promise combinator:**

| Use Case                                  | Combinator              | Why                                     |
| ----------------------------------------- | ----------------------- | --------------------------------------- |
| Fail-fast validation (SSRF, input checks) | `Promise.all`           | First failure should reject immediately |
| Wait for all, partial success acceptable  | `Promise.allSettled`    | All items run to completion regardless  |
| Sequential dependency chain               | `for...of` with `await` | Each step depends on the previous       |

---

### NEW: Deterministic Job IDs for BullMQ (Cancel-by-Computation)

**Problem:** Random job IDs make cancellation require a DB lookup to find the job ID.

**Pattern:** Use `{operation}-${entity.id}` as a deterministic job ID. Cancel is a pure computation — no DB lookup needed.

```typescript
// Naming convention: {operation}-{entityId}
const jobId = `crosspost-${contentRow.id}`;

// Add with deterministic ID
await queue.add(jobName, payload, { jobId });

// Cancel without DB lookup — reconstruct the ID from context
await queue.remove(`crosspost-${contentRow.id}`);

// Handle idempotent add (retry scenario)
try {
  await queue.add(jobName, payload, { jobId });
} catch (err) {
  if (err?.code === '23505') {
    logger.debug(`Job ${jobId} already queued — idempotent skip`);
    return;
  }
  throw err;
}
```

**Naming convention for other operations:**

```
crosspost-{contentId}
notify-{userId}-{eventId}
invoice-{invoiceId}
```

**When to apply:** Any BullMQ `queue.add()` where the job may need to be cancelled, deduplicated, or idempotently re-submitted.

---

### REFINED: `process.exit()` → `throw` for Testability (Extends existing guidance)

This sprint reinforced the rule that library/utility code must never call `process.exit()`. Only top-level entry points decide to terminate.

```typescript
// WRONG — kills test runner process
validateEnv().catch(() => process.exit(1));

// RIGHT — throw and let caller decide
try {
  await Promise.race([validateEnv(), timeoutAfter(5000, 'Env validation timed out')]);
} catch (err) {
  logger.error('Environment validation failed', { error: err });
  throw err; // Caller (server.ts) does: process.exit(1)
}

// In server.ts (entry point only):
startServer().catch((err) => {
  logger.fatal('Server startup failed', { error: err });
  process.exit(1);
});
```

**Additional rule from this sprint:** Wrap fire-and-forget async validation in `Promise.race()` with a timeout. Unbounded async calls at startup can hang the process silently.

---

### CONFIRMED: `Promise.all` vs `Promise.allSettled` Semantics

This sprint produced two adjacent usages that clarify the distinction:

| Code                     | Combinator           | Rationale                                               |
| ------------------------ | -------------------- | ------------------------------------------------------- |
| SSRF URL validation      | `Promise.all`        | Fail-fast: any bad URL rejects the entire batch         |
| `waitForQueriesToSettle` | `Promise.allSettled` | Wait-for-all: settle all queries regardless of outcomes |

The key question: **Is partial failure acceptable?**

- Yes → `Promise.allSettled`
- No → `Promise.all`

---

### CONFIRMED: Interval Cleanup in `destroy()` (Extension of TTLCache pattern)

Any class creating `setInterval` or `setTimeout` must store the handle and clear it in `destroy()`. This is already documented in common-solutions.md #2 for TTLCache specifically. The same pattern applies to any service class:

```typescript
class SomeService {
  private intervalHandle?: NodeJS.Timeout;

  start(): void {
    this.intervalHandle = setInterval(() => this.poll(), POLL_INTERVAL_MS);
  }

  destroy(): void {
    if (this.intervalHandle !== undefined) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = undefined;
    }
  }
}
```

**Test helper:** In tests, always call `service.destroy()` in `afterEach` to prevent timer leakage across tests.

---

## Process Learnings

### 1. Domain-Grouped Agents: Zero Conflicts (7th Consecutive Sprint)

Five agents with non-overlapping file ownership produced zero merge conflicts. The pattern continues to scale:

| Sprint                         | Agents | Conflicts |
| ------------------------------ | ------ | --------- |
| P2 Final (02-18)               | 6      | 0         |
| Wave 2 P1 R2 (02-19)           | 4      | 0         |
| Wave 2 P2/P3 (02-19)           | 6      | 0         |
| PR #86 P1 R4 (02-19)           | 4      | 0         |
| P2/P3 R6 (02-21)               | 4      | 0         |
| PR #92 R7 (02-21)              | 3      | 0         |
| **PR #93 P3 Sprint 1 (02-21)** | **5**  | **0**     |

**Scaling rule refined:** ~4 items per agent. 5 agents handled 20 items cleanly. Pattern holds at this scale.

### 2. Pre-Commit Scanner False Positives: Must Be Fixed Fast

The scanner had 3 bugs that were causing false positives. Each false positive erodes developer trust. As noted in prior sprints, false positives lead to `--no-verify` habit. This sprint fixed all 3 bugs and the scanner now exits 0 cleanly on the codebase.

**Key lesson:** Scanner false positives have compounding cost. Fix them immediately when discovered, do not defer.

### 3. Post-Sprint Review Found 0 P1s

7 review agents found 0 P1 findings on a +1430/-352 sprint. This is the second consecutive sprint (after PR #92) with zero P1s from review. This signals that prior compound docs (especially critical-patterns.md and common-solutions.md) are being applied effectively.

### 4. Two Review Findings Fixed In-Sprint

Todos 449 (wrong error class) and 451 (`MAX_PORTFOLIO_URLS` duplication) were trivial fixes (<5 min each) found by the post-sprint review. Fixed before merge following the rule established in PR #92: if a finding is <5 minutes and clearly correct, fix it before merge.

### 5. `forEach` Async Bug Is Easy to Miss in Code Review

The `waitForQueriesToSettle` no-op was present in the codebase and passed multiple code review cycles. The function had a plausible-looking signature (`async function`, `await` inside), making the bug invisible without understanding `forEach` return semantics. Automated detection (grep for `forEach(async`) is more reliable than manual review for this class of bug.

### 6. Pre-Commit Hooks: BRE vs ERE Portability Is a Recurring Risk

macOS developer environments (BSD grep) vs Linux CI (GNU grep) creates a silent divergence. Scripts that test fine on CI but silently misbehave on developer machines are particularly dangerous because:

- Developers lose trust in local tooling
- They may not notice when a check silently passes that should fail
- The bug is not obvious from reading the script

**Prevention:** Any new shell script added to the repo must be tested on both macOS (BSD grep) and Linux (GNU grep). Default to `-E` or `-F` modes, never rely on BRE extensions.

---

## Sprint Metrics

| Metric          | Value                                              |
| --------------- | -------------------------------------------------- |
| Findings fixed  | 20 (todos 435–458)                                 |
| Review findings | 8 (2 P2 fixed in-sprint, 6 P3 deferred as 461–466) |
| Domain agents   | 5                                                  |
| Review agents   | 7                                                  |
| Merge conflicts | 0                                                  |
| Files changed   | 41                                                 |
| Lines added     | +1430                                              |
| Lines removed   | -352                                               |
| P1s from review | 0                                                  |
| Scanner status  | Exit 0 (3 bugs fixed)                              |

---

## Files Changed

### Backend Services

- `packages/backend/src/services/marketplace-service.ts` — parallel SSRF, `MAX_PORTFOLIO_URLS` cap
- `packages/backend/src/services/cross-post-service.ts` — deterministic job IDs, FK handling
- `packages/backend/src/services/nostr-key-management-service.ts` — interval cleanup, `any` → `unknown`
- `packages/backend/src/utils/env-validation.ts` — Promise.race timeout, throw instead of exit

### Backend Infra / Tooling

- `scripts/check-antipatterns.sh` — 3 scanner bugs fixed (BRE portability, `any` regex, test-utils exclusion, multiline auth check)

### Frontend Components

- `packages/frontend/src/features/circles/hooks/useCircles.ts` — `console.error` → `toast.error`

### Frontend Tests

- `packages/frontend/src/test-utils/test-providers.tsx` — double Redux store fix
- `packages/frontend/src/test-utils/query-helpers.ts` — `waitForQueriesToSettle` forEach → allSettled

### Shared Testing Utilities

- `packages/testing/src/supabase-mock.ts` — `createMockChain()` extracted

### Todo Files

- `todos/435.md` through `todos/458.md` — marked DONE
- `todos/461.md` through `todos/466.md` — new P3/deferred findings from post-sprint review

---

## Cross-Reference: Pattern File Updates Needed

| Pattern                                         | Action               | Target File         |
| ----------------------------------------------- | -------------------- | ------------------- |
| grep BRE/ERE portability (macOS vs Linux)       | NEW #19              | common-solutions.md |
| `Array.forEach` async no-op                     | NEW #20              | common-solutions.md |
| Deterministic BullMQ job IDs                    | NEW #21              | common-solutions.md |
| `process.exit` → `throw` in library code        | REFINE existing note | common-solutions.md |
| `destroy()` interval cleanup                    | REFINE #2 note       | common-solutions.md |
| `Promise.all` vs `Promise.allSettled` semantics | ADD note to #13      | common-solutions.md |
