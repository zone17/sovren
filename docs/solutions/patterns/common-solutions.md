---
title: Common Solutions — Reusable Fixes for Recurring Issues
date: '2026-02-22'
category: patterns
purpose: Consolidated solutions for P2/P3 patterns that recur across sprints. Prevents re-invention.
usage: Reference when implementing features. Check if a solution already exists here before writing new code.
---

# Common Solutions

Reusable solutions extracted from 180+ P2/P3 findings across 12 sprints. These are not critical blockers but patterns that waste time when re-discovered. **Check here before implementing anything in these categories.**

---

## 1. Frontend Double-Submit Prevention

**Recurrence:** 4 P1s + 3 P2s across 3 sprints. Every new financial button misses this.

### Standard Pattern: useRef + disabled + aria-busy

```tsx
const [pendingId, setPendingId] = useState<string | null>(null);
const inFlightRef = useRef(false);

const handleAction = (id: string) => {
  if (inFlightRef.current) return; // Synchronous guard (before re-render)
  inFlightRef.current = true;
  setPendingId(id);
  mutation.mutate(
    { id },
    {
      onSettled: () => {
        inFlightRef.current = false;
        setPendingId(null);
      },
    }
  );
};

// JSX — all three attributes required
<button
  onClick={() => handleAction(item.id)}
  disabled={pendingId !== null || mutation.isPending}
  aria-busy={pendingId === item.id}
  className="disabled:opacity-50 disabled:cursor-not-allowed"
>
  {pendingId === item.id ? 'Processing...' : 'Submit'}
</button>;
```

**Why both `useRef` AND `disabled`?**

- `useRef` fires synchronously — catches clicks before React re-renders
- `disabled` provides visual feedback and accessibility
- Either alone has a race window

**Checklist for every financial button:**

- [ ] `disabled={mutation.isPending}` or `disabled={pendingId !== null}`
- [ ] `aria-busy={mutation.isPending}`
- [ ] Loading text change during pending
- [ ] `disabled:cursor-not-allowed` in className
- [ ] `onSettled` (not `onSuccess`) clears the guard — handles errors too

---

## 2. TTLCache for In-Memory Maps

**Recurrence:** 4 P2s across 2 sprints. Plain `Map` without eviction = unbounded memory growth.

### Standard Pattern: TTLCache with Max Size

```typescript
class TTLCache<K, V> {
  private cache = new Map<K, { value: V; expires: number }>();
  private cleanupInterval: NodeJS.Timeout;

  constructor(
    private readonly ttlMs: number = 300_000, // 5 min default
    private readonly maxSize: number = 10_000,
    cleanupIntervalMs: number = 60_000
  ) {
    this.cleanupInterval = setInterval(() => this.cleanup(), cleanupIntervalMs);
  }

  get(key: K): V | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: K, value: V): void {
    if (this.cache.size >= this.maxSize) {
      // FIFO eviction — delete oldest entry
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) this.cache.delete(firstKey);
    }
    this.cache.set(key, { value, expires: Date.now() + this.ttlMs });
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (now > entry.expires) this.cache.delete(key);
    }
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
  }
}
```

**Rule:** Replace every `new Map()` that stores runtime data with `new TTLCache()`. The only exception is static config loaded once at startup.

**Usage:** Import from `packages/backend/src/utils/ttl-cache.ts` (already exists in codebase).

---

## 3. Environment Variable Validation

**Recurrence:** 2 P1s + 3 P2s. New env vars added to code but not to `.env.example` or Zod schema.

### Standard Pattern: Zod Schema + Production Enforcement

```typescript
// 1. Add to Zod schema (env-validation.ts)
MY_NEW_KEY: z.string()
  .regex(/^[0-9a-f]{64}$/i, 'Must be 64-char hex (generate: openssl rand -hex 32)')
  .optional(),

// 2. Add production presence check
if (env.NODE_ENV === 'production' && !env.MY_NEW_KEY) {
  issues.push('MY_NEW_KEY required in production (generate: openssl rand -hex 32)');
}

// 3. Add cross-key check if there's a related key
if (env.MY_NEW_KEY && env.OTHER_KEY &&
    env.MY_NEW_KEY.toLowerCase() === env.OTHER_KEY.toLowerCase()) {
  issues.push('MY_NEW_KEY must differ from OTHER_KEY');
}
```

**Checklist for every new env var:**

- [ ] Added to root `.env` with comment
- [ ] Added to `packages/backend/.env.example` with generation instructions
- [ ] Added to Zod schema in `env-validation.ts`
- [ ] Production presence check if required
- [ ] Cross-key check if related keys exist

---

## 4. Error Response Format (createApiResponse)

**Recurrence:** 5 P2s. Inconsistent error shapes across routes.

### Standard Pattern: Always use createApiResponse

```typescript
import { createApiResponse } from '@/utils/api-response';

// Success — auto-transforms snake_case to camelCase
res.json(createApiResponse({ data: result, startTime }));

// Success with raw DB rows (skip transform)
res.json(createApiResponse({ data: result, startTime, raw: true }));

// Error — use error classes, let middleware handle
throw new NotFoundError('Invoice not found'); // 404
throw new ConflictError('Already claimed'); // 409
throw new AuthorizationError('Not authorized'); // 403
throw new ValidationError('Invalid input'); // 400
// Never: res.status(500).json({ error: ... })
```

**Rule:** Never construct error responses manually. Use error classes from `utils/errors.ts` and let `error-handler-middleware.ts` format the response.

---

## 5. API Contract Synchronization (snake_case/camelCase)

**Recurrence:** 8 P1s across 2 sprints. DB returns `snake_case`, frontend expects `camelCase`.

### Standard Pattern: Case-Transform Layer

```typescript
import { snakeToCamel, camelToSnake } from '@/utils/case-transform';

// DB → API (automatic in createApiResponse)
res.json(createApiResponse({ data: dbRows, startTime }));
// dbRows: { creator_id, revenue_sats } → response: { creatorId, revenueSats }

// API → DB (in service layer)
const dbData = camelToSnake(requestBody);
await db.from('table').insert(dbData);
```

**Rule:** `createApiResponse()` transforms by default. Use `{ raw: true }` only for data already in camelCase. Never manually rename fields.

---

## 6. Feature Flag for Stub/Incomplete Services

**Recurrence:** 2 P1s. BullMQ workers, cron jobs, and pollers registered for unimplemented functions.

### Standard Pattern: Opt-In Flag

```typescript
async startService(): Promise<void> {
  if (process.env.ENABLE_MY_SERVICE !== 'true') {
    this.logger.warn('[MyService] Disabled — implementation incomplete. '
      + 'Set ENABLE_MY_SERVICE=true to enable.');
    return;
  }
  // ... register workers, queues, schedulers ...
}
```

**Rules:**

- Use opt-IN (`ENABLE_X=true`) not opt-OUT (`DISABLE_X=true`)
- Log a warning (not error) on early return
- Include the env var name in the log message
- Add to `.env` with `=false` default
- Don't register any resources (Redis connections, workers) when disabled

---

## 7. Supabase Mock Chain Pattern (for tests)

**Recurrence:** Every sprint's test fix pass. Supabase's chainable API breaks mocks when services change.

### Standard Pattern: Chainable Mock Builder

```typescript
import { vi } from 'vitest';

function createMockChain(terminalData: any = []) {
  const chain: any = {};
  // Chainable methods return `chain`
  [
    'from',
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
    'in',
    'is',
    'order',
    'not',
    'or',
    'filter',
    'match',
    'limit',
    'maybeSingle',
  ].forEach((method) => {
    chain[method] = vi.fn().mockReturnValue(chain);
  });

  // Terminal methods return data
  chain.single = vi.fn().mockResolvedValue({ data: terminalData, error: null });
  chain.range = vi.fn().mockResolvedValue({ data: terminalData, error: null });
  chain.then = undefined; // Prevent Promise detection

  // For count queries
  chain.select = vi.fn().mockImplementation((_cols: string, opts?: any) => {
    if (opts?.count === 'exact') {
      return { ...chain, data: null, count: terminalData.length ?? 0, error: null };
    }
    return chain;
  });

  return chain;
}

// Usage in test
const mockDb = { from: vi.fn().mockReturnValue(createMockChain(mockData)) };
```

### Pagination Mock (for paginated accumulation)

```typescript
function createPaginatedMock(allRows: any[], pageSize = 500) {
  let callCount = 0;
  const chain = createMockChain();
  chain.range = vi.fn().mockImplementation((start: number, end: number) => {
    const page = allRows.slice(start, end + 1);
    callCount++;
    return Promise.resolve({ data: page, error: null });
  });
  return chain;
}
```

**Rule:** When a service adds `.order()` or `.range()`, the test mock MUST add those methods to the chain. Missing chain methods are the #1 cause of test failures after P1 fixes.

---

## 8. Rate Limiting on Mutation Routes

**Recurrence:** 2 P1s. New route groups miss rate limiting that existing groups have.

### Standard Pattern: Copy from Working Routes

```typescript
import { mutationRateLimiter } from '@/middleware/rate-limiter';

// Apply to all mutation routes in a group
router.post('/resource', authenticate, mutationRateLimiter, createHandler);
router.put('/resource/:id', authenticate, mutationRateLimiter, updateHandler);
router.delete('/resource/:id', authenticate, mutationRateLimiter, deleteHandler);

// GET routes don't need mutation limiter (they have a separate read limiter)
router.get('/resource', authenticate, listHandler);
```

**Detection:** Grep for `router.post(` or `router.put(` or `router.delete(` without `mutationRateLimiter` in the middleware chain.

---

## 9. Express Route Ordering

**Recurrence:** 2 P2s. Named routes after `/:id` never match.

### Standard Pattern: Specific Before Dynamic

```typescript
// WRONG — '/resource/stats' matches /:id with id='stats'
router.get('/resource/:id', getById);
router.get('/resource/stats', getStats);

// RIGHT — specific routes first
router.get('/resource/stats', getStats);
router.get('/resource/:id', getById);
```

**Rule:** All named routes (`/stats`, `/summary`, `/export`) must appear BEFORE `/:id` in the same router.

---

## 10. DI Container Type Safety

**Recurrence:** 4 P1s. `db: any` and unsafe casts in service constructors.

### Standard Pattern: Interface-Based Injection

```typescript
// Define interface (not the implementation)
interface ISupabaseClient {
  from<T>(table: string): SupabaseQueryBuilder<T>;
  rpc(fn: string, params?: Record<string, unknown>): Promise<PostgrestResponse>;
}

// Service constructor uses interface
class MyService {
  constructor(private readonly db: ISupabaseClient) {}
}

// Registration uses import type
import type { ISupabaseClient } from '@/types/database';
container.register('db', { useValue: supabaseClient as ISupabaseClient });
```

**Rules:**

- Never `db: any` in constructors — use `ISupabaseClient`
- Use `import type` for DI registry imports (prevents circular deps)
- Never `as unknown as T` — if the cast is needed, the interface is wrong

---

## 11. Vitest OOM Prevention

**Recurrence:** 3 agent crashes during quality pipeline migration (02-20). Default `pool: 'forks'` spawns one worker per CPU core, each consuming ~4GB for large codebases.

### Standard Pattern: Cap maxForks

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    pool: 'forks',
    poolOptions: {
      forks: {
        maxForks: 2, // Workers × 4GB = total RAM. Cap to avoid OOM.
      },
    },
  },
});
```

**Rule:** Always set `maxForks` explicitly. Formula: `maxForks = Math.floor(availableRAM / 4) - 1`. For 24GB machines, use `maxForks: 2`. For CI runners with 8GB, use `maxForks: 1`.

**Agent briefs:** Include `maxForks: 2` and `timeout: 120000` constraints when assigning test migration tasks.

---

## 12. Git Diff for Hooks (Pre-Commit vs Pre-Push)

**Recurrence:** 5 instances of wrong `git diff` variant in hooks (02-20). `git diff --cached` is empty at push time because files are already committed.

### Standard Pattern: Match diff to hook type

```bash
# Pre-commit (staged files — not yet committed):
git diff --cached --name-only

# Pre-push (committed files vs remote):
git diff origin/main...HEAD --name-only
```

**Rule:** `--cached` is for pre-commit ONLY. At push time, files are committed, so `--cached` returns nothing. Use `origin/main...HEAD` to compare committed changes against the remote branch.

**Detection:** Grep for `git diff --cached` in any file under `.husky/pre-push` or hook scripts that run at push time.

---

## 13. Promise.allSettled for Batch Operations

**Recurrence:** 3 P2s across 2 sprints. `Promise.all` used for batch operations where partial success is acceptable, causing total failure on any single rejection.

### Standard Pattern: allSettled with Typed Filtering

```typescript
const results = await Promise.allSettled(items.map((item) => processItem(item)));

const succeeded = results.filter(
  (r): r is PromiseFulfilledResult<ProcessResult> => r.status === 'fulfilled'
);
const failed = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');

if (failed.length > 0) {
  logger.warn(`${failed.length}/${results.length} items failed`, {
    errors: failed.map((f) => f.reason?.message),
  });
}

return { succeeded: succeeded.map((s) => s.value), failedCount: failed.length };
```

**When to use:** Batch notifications, multi-relay NOSTR publishing, bulk imports/exports, webhook fanout, test utility settling -- any operation where partial success is acceptable.

**When NOT to use:** Financial transactions (use atomic patterns from critical-patterns.md), input validation where any failure should reject the batch (use `Promise.all`), sequential operations where each step depends on the previous.

**Clarification — `Promise.all` vs `Promise.allSettled`:**

| Question                                             | Answer                         | Use                                  |
| ---------------------------------------------------- | ------------------------------ | ------------------------------------ |
| Should ANY failure reject the whole batch?           | Yes                            | `Promise.all`                        |
| Should we wait for ALL items regardless of failures? | Yes                            | `Promise.allSettled`                 |
| Examples                                             | SSRF validation, schema checks | Test settling, notifications, fanout |

**Detection:** Grep for `Promise.all(` where the mapped function can independently fail (e.g., network calls, DB writes to separate rows). Replace with `Promise.allSettled(`. Conversely, grep for `Promise.allSettled(` used for validation — these should be `Promise.all`.

---

## 14. Shared Utility Extraction Threshold

**Recurrence:** 3 P2s across 2 sprints. Inline utility logic duplicated across 3+ feature files with slight variations, causing inconsistency and maintenance burden.

### Standard Pattern: Extract at 3+ Copies

```typescript
// BEFORE: 8 inline copies with slight variations
// features/dashboard/components/Stats.tsx
const formatted =
  amount >= 1000000
    ? `${(amount / 1000000).toFixed(1)}M`
    : amount >= 1000
      ? `${(amount / 1000).toFixed(1)}K`
      : `${amount}`;

// AFTER: Single parameterized utility
// packages/shared/src/utils/format-sats.ts
interface FormatSatsOptions {
  abbreviate?: boolean; // true: 1.5M, false: 1,500,000
  suffix?: string; // e.g., ' sats', ' BTC'
}

export function formatSats(amount: number, options: FormatSatsOptions = {}): string {
  const { abbreviate = true, suffix = '' } = options;
  if (!abbreviate) return `${amount.toLocaleString()}${suffix}`;
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M${suffix}`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(1)}K${suffix}`;
  return `${amount}${suffix}`;
}
```

**Rule:** When a utility function appears in **3+ files** with slight variations:

1. Extract to `packages/shared/src/utils/` with a parameterized interface covering all variation points
2. Replace ALL call sites in the same PR (no partial migration)
3. Add unit tests for each variation the parameters enable

**Special case -- test mock factories:** When extracting a shared mock factory (e.g., `createQueueServiceMock()`), the PR MUST also migrate at least one existing test file to use the factory. A factory without consumers is dead code that drifts silently. Mapped types like `{ [K in keyof T]: Mock<any> }` erase parameter types -- without a real consumer, no one notices the type loss.

**Detection:** Grep for repeated patterns like formatting logic, validation regexes, or transformation functions. If 3+ files have similar implementations, extract.

---

## 15. Task-Completion Hooks Must Not Run Full Quality Gates

**Recurrence:** 1 critical incident (02-20). `verify-task-complete` hook ran full monorepo lint/typecheck/tests on every `TaskUpdate` call. With pre-existing issues (2,957 type errors, 121 failing suites, 6,443 ESLint issues), the hook never passed, causing agents to loop indefinitely and burn tokens.

### Standard Pattern: Log-Only Hooks + CI Enforcement

```bash
#!/bin/bash
# verify-task-complete.sh (log-only version)
# Quality gates enforced at CI/PR level, not per-task
echo "[$(date)] Task completed: $1" >> /tmp/task-completions.log
```

**Enforcement layers (in order of frequency):**

| Layer       | Scope              | Frequency         | Blocks? |
| ----------- | ------------------ | ----------------- | ------- |
| Task hooks  | Log only           | Every task update | No      |
| Pre-commit  | Changed files only | Every commit      | Yes     |
| CI pipeline | Full monorepo      | Every push        | Yes     |
| PR review   | Full review suite  | Every PR          | Yes     |

**Rules:**

- Task-completion hooks: Log only, never run quality checks
- Pre-commit hooks: Scope to staged files (`git diff --cached --name-only`)
- Never run `npm run lint` / `npm run type-check` / `npm test` in any hook that fires per-task-update
- Full quality gates belong in CI/CD, where they run once per push

**Prevention checklist before deploying any new hook:**

- [ ] Hook has been tested against a codebase with pre-existing issues
- [ ] Hook has a timeout (max 30 seconds)
- [ ] Hook failure does NOT block agent progress
- [ ] Hook only checks files the agent actually changed (if it checks anything)

---

## 16. Security-Critical File Mapping (Source -> Test Suite)

**Recurrence:** 2 P1 SSRF findings (#423, #424) in PR #89 would have been caught if security tests ran during development. Pre-commit hook was broken (PR #90).

### Standard Pattern: Declarative Source-to-Test Map in Pre-Commit

```bash
#!/usr/bin/env bash
# scripts/run-security-tests.sh — called from .husky/pre-commit
set -euo pipefail

# Extensible map: add new entries when creating security-critical files
SECURITY_MAP=(
  "packages/backend/src/utils/ssrf.ts:packages/backend/src/utils/__tests__/ssrf.test.ts"
  "packages/backend/src/middleware/auth.ts:packages/backend/src/middleware/__tests__/auth.test.ts"
  "packages/backend/src/middleware/csrf.ts:packages/backend/src/__tests__/middleware/csrf.test.ts"
  "packages/backend/src/routes/auth.ts:packages/backend/src/middleware/__tests__/auth.test.ts"
)

STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM 2>/dev/null || true)
[ -z "$STAGED_FILES" ] && exit 0

SECURITY_TESTS=""
for mapping in "${SECURITY_MAP[@]}"; do
  source_pattern="${mapping%%:*}"
  test_file="${mapping##*:}"
  if echo "$STAGED_FILES" | grep -q "$source_pattern"; then
    [ -f "$test_file" ] && SECURITY_TESTS="$SECURITY_TESTS $test_file"
  fi
done

[ -z "$SECURITY_TESTS" ] && exit 0
npx vitest run --bail 1 $SECURITY_TESTS
```

**Why not `vitest related`?** `vitest related` uses static import analysis which (a) loads the entire project and hits compile errors in unrelated files, and (b) only finds direct import dependents, missing integration-level coverage. Explicit mapping is deterministic, fast, and documents the security boundary.

**Checklist when adding a new security-critical file:**

- [ ] Add source:test mapping to `SECURITY_MAP` in `scripts/run-security-tests.sh`
- [ ] Verify test file exists and passes: `npx vitest run path/to/test.ts`
- [ ] Test the hook: stage the file, confirm security tests fire

**Detection:** Grep for new files in `middleware/`, `utils/` that handle auth, validation, SSRF, CSRF, rate limiting, or encryption. If no SECURITY_MAP entry exists, flag it.

---

## 17. Hook Migration Checklist (Test Framework Switches)

**Recurrence:** 1 P1 (PR #90). Vitest migration (PR #86) updated 220+ test files but missed husky hooks. Broken hooks went undetected because of error suppression.

### Standard Pattern: Checklist for Every Test Framework Migration

When switching test frameworks (Jest -> Vitest, Mocha -> Jest, etc.), these artifacts MUST be updated in the same PR:

```markdown
## Test Framework Migration Checklist

### Test Infrastructure

- [ ] Test config files (jest.config.js -> vitest.config.ts)
- [ ] Test files (API changes: jest.fn -> vi.fn, etc.)
- [ ] Test utilities and helpers

### Developer Tooling (OFTEN MISSED)

- [ ] `.husky/pre-commit` — test runner invocations
- [ ] `.husky/pre-push` — test runner invocations
- [ ] `scripts/` — any custom test scripts (run-security-tests.sh, etc.)
- [ ] `package.json` — npm test scripts and their arguments

### CI/CD

- [ ] `.github/workflows/` — CI test steps
- [ ] Docker test stages (if applicable)

### Documentation

- [ ] `CLAUDE.md` / `README.md` — test command references
- [ ] `CONTRIBUTING.md` — developer workflow docs

### Verification

- [ ] Pre-commit hook runs tests successfully (stage a file, commit)
- [ ] Pre-push hook runs tests successfully (push to feature branch)
- [ ] `npm test` succeeds (or fails only on pre-existing issues)
- [ ] No `2>/dev/null || true` suppressing test runner errors
```

**Rule:** The PR description for any test framework migration MUST include this checklist with all items checked. Reviewer should verify hooks are tested.

---

## 18. Error Suppression Anti-Pattern in Git Hooks

**Recurrence:** 1 P1 (PR #90). `2>/dev/null || true` after `jest --findRelatedTests` made the broken hook invisible for an entire sprint.

### The Anti-Pattern

```bash
# WRONG — suppresses ALL errors, including the tool being completely broken
npx jest --findRelatedTests $FILES 2>/dev/null || true
npx some-tool --check $FILES 2>&1 | head -1 || true

# The hook's entire purpose is to BLOCK on failure.
# Suppressing errors defeats the hook.
```

### Standard Pattern: Conditional Execution Without Suppression

```bash
# RIGHT — only run if there are files to test; let errors propagate
if [ -n "$TEST_FILES" ]; then
  npx vitest run --bail 1 --passWithNoTests $TEST_FILES
fi

# RIGHT — handle specific expected conditions, not all errors
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM || true)
# The || true here is correct: git diff can fail if .git is missing,
# and we want a graceful empty result. But the TEST RUNNER must not be suppressed.

# RIGHT — fallback chain for git diff variants
CHANGED=$(git diff origin/main...HEAD --name-only 2>/dev/null || \
          git diff HEAD~1...HEAD --name-only 2>/dev/null || true)
# The 2>/dev/null here is acceptable: we're handling missing remote/ref gracefully
# with a fallback. The test runner output is NEVER suppressed.
```

**Rules:**

- NEVER suppress test runner output (`vitest`, `jest`, `eslint`, `tsc`)
- Acceptable suppression: `git diff` with fallback chain, `which`/`command -v` checks
- After any hook modification, grep for `|| true` and `2>/dev/null` — each instance must be justified
- The test runner exit code must propagate to the hook exit code (no `|| true` after test commands)

**Detection:** `grep -n '|| true\|2>/dev/null' .husky/*` — review every match for appropriate vs. inappropriate suppression.

---

## 19. grep BRE/ERE Portability (macOS BSD grep vs GNU grep)

**Recurrence:** 1 scanner bug (PR #93) caused false positives on macOS. BRE `\+` works on GNU grep (Linux CI) but breaks silently on BSD grep (macOS developer machines).

### The Problem

macOS ships BSD grep. GNU extensions like `\+` (one-or-more in BRE), `\?`, and `\|` are not available in BSD grep's BRE mode. A pattern that works perfectly on Linux CI may silently produce wrong results on macOS.

```bash
# WRONG — BRE \+ is a GNU extension, silently broken on macOS
grep -v '^\+\+\+'   # BSD grep: \+ may match literal +, not "one or more +"

# WRONG — BRE \? is also GNU-only
grep '^\+\?fix'
```

### Standard Pattern: Use -F or -E Explicitly

```bash
# RIGHT — fixed-string match, portable everywhere
grep -vF '+++'        # Equivalent to grep -v '^\+\+\+' on GNU, but portable

# RIGHT — ERE mode, portable across GNU and BSD
grep -Ev '^\+{3}'     # Explicit ERE quantifier
grep -E '^\+\+\+'     # Three literal + characters in ERE (+ is not special without a preceding atom)

# RIGHT — when you need alternation
grep -E 'foo|bar'     # ERE -E works on both GNU and BSD
# WRONG: grep 'foo\|bar'  — \| alternation is GNU BRE extension only
```

### Decision Table

| Pattern                     | Mode      | macOS BSD | Linux GNU | Recommendation                                         |
| --------------------------- | --------- | --------- | --------- | ------------------------------------------------------ |
| Fixed string                | `-F`      | Yes       | Yes       | Preferred for literals                                 |
| Standard ERE                | `-E`      | Yes       | Yes       | Preferred for patterns with quantifiers or alternation |
| BRE with `\+` (one-or-more) | (default) | No        | Yes       | Never use — silent failure (fixed PR #93)              |
| BRE with `\?` (zero-or-one) | (default) | No        | Yes       | Never use — silent failure                             |
| BRE with `\|` (alternation) | (default) | No        | Yes       | Never use — silent failure (fixed PR #94)              |
| BRE with `*`, `.`, `^`, `$` | (default) | Yes       | Yes       | Safe subset only                                       |

**Rule:** For any shell script that runs on both macOS (developer) and Linux (CI):

1. Use `-F` when matching fixed/literal strings
2. Use `-E` when quantifiers or alternation are needed
3. Never rely on `\+`, `\?`, or `\|` in BRE mode

**Detection:** `grep -r "grep '[^']*\\\\+" scripts/ .husky/` — flag any grep without `-E` or `-F` where the pattern contains `\+`, `\?`, or `\|`.

---

## 20. `Array.forEach` Async No-Op Bug

**Recurrence:** 1 P3 (PR #93 `waitForQueriesToSettle`). `forEach` silently swallows async work, making functions look correct but do nothing.

### The Problem

`forEach` always returns `undefined`. When its callback is `async`, the callback returns a Promise — but `forEach` discards it. Any `await` inside the callback awaits within the callback's own microtask queue, not the caller's.

```typescript
// WRONG — completely no-op: forEach discards all returned Promises
async function waitForAll(items: Item[]): Promise<void> {
  return items.forEach(async (item) => {
    await processItem(item); // This await is local to the callback
  });
  // Function returns immediately with undefined cast to Promise<void>
}

// ALSO WRONG — return inside forEach exits the callback, not the outer function
function findFirst(items: Item[]): Item | undefined {
  items.forEach((item) => {
    if (item.valid) return item; // Returns from forEach callback, not findFirst
  });
  // Always returns undefined
}
```

### Standard Pattern: Use for...of or map + Promise combinator

```typescript
// SEQUENTIAL — when each step depends on the previous
async function processSequentially(items: Item[]): Promise<void> {
  for (const item of items) {
    await processItem(item);
  }
}

// PARALLEL fail-fast — reject immediately if any item fails (validation, SSRF checks)
async function processParallelFailFast(items: Item[]): Promise<void> {
  await Promise.all(items.map((item) => processItem(item)));
}

// PARALLEL wait-for-all — continue even if some fail (test settling, notifications)
async function processParallelWaitAll(items: Item[]): Promise<ProcessResult[]> {
  const results = await Promise.allSettled(items.map((item) => processItem(item)));
  return results
    .filter((r): r is PromiseFulfilledResult<ProcessResult> => r.status === 'fulfilled')
    .map((r) => r.value);
}
```

### Which Promise Combinator?

| Use Case                             | Use                                 | Why                                      |
| ------------------------------------ | ----------------------------------- | ---------------------------------------- |
| Input validation (SSRF, schema)      | `Promise.all`                       | First failure should reject entire batch |
| Test utility settling, notifications | `Promise.allSettled`                | Wait for all; partial success acceptable |
| Sequential dependency chain          | `for...of` + `await`                | Each step depends on previous            |
| Finding an element                   | `Array.find()` (sync) or `for...of` | `forEach` cannot short-circuit           |

**Detection:** Grep for `forEach(async` — every instance is a potential no-op bug. Also grep for `return.*\.forEach(` since `forEach` always returns `undefined`.

```bash
# Detection commands
grep -rn 'forEach(async' packages/
grep -rn 'return.*\.forEach(' packages/
```

---

## 21. Deterministic BullMQ Job IDs (Cancel-by-Computation)

**Recurrence:** 1 P3 (PR #93 CrossPostService). Random job IDs require DB lookups to cancel; deterministic IDs enable pure computation.

### The Problem

By default, BullMQ generates random UUID job IDs. To cancel a queued job, you must first query the DB to retrieve its ID — an extra round-trip that also creates a TOCTOU window.

### Standard Pattern: `{operation}-${entityId}`

```typescript
// WRONG — random ID, cannot cancel without DB lookup
await queue.add('cross-post', { contentId, platform });

// RIGHT — deterministic ID, cancel is a pure computation
const jobId = `crosspost-${contentRow.id}`;
await queue.add('cross-post', { contentId, platform }, { jobId });

// Cancel without any DB lookup:
const jobIdToCancel = `crosspost-${contentRow.id}`; // Reconstructed from context
await queue.remove(jobIdToCancel);
```

### Naming Convention

```
{operation}-{primaryEntityId}

crosspost-{contentId}          // Cross-posting a piece of content
notify-{userId}-{eventId}      // Notification for a specific event
invoice-{invoiceId}            // Invoice processing job
```

Keep it human-readable — the ID appears in BullMQ dashboard and error logs.

### Handling Idempotent Re-Adds (Retry Safety)

When the same `jobId` is added twice (e.g., network failure retry), BullMQ may throw a constraint violation if the previous job still exists in the queue:

```typescript
try {
  await queue.add(jobName, payload, { jobId });
} catch (err) {
  // FK/unique violation: job already exists — idempotent, not an error
  if (err?.code === '23505' || err?.message?.includes('duplicate')) {
    logger.debug(`Job ${jobId} already queued — idempotent skip`);
    return;
  }
  throw err;
}
```

### Adding `removeJob()` to Queue Interfaces

When the queue is injected via interface, ensure the interface includes `remove()`:

```typescript
interface IJobQueue {
  add(name: string, data: unknown, opts?: { jobId?: string }): Promise<void>;
  remove(jobId: string): Promise<void>; // Required for deterministic cancel
}
```

**When to apply:** Any `queue.add()` call where the job may need to be cancelled, deduplicated, or idempotently re-submitted. If you ever need to "cancel a job for entity X", the job ID for X must be deterministic.

**Detection:** Grep for `queue.add(` without a `jobId` option in service files where cancellation is a use case.

---

## 22. Promise.race Timer Cleanup

**Recurrence:** 1 P3 (PR #94 env-validation.ts). `Promise.race` with `setTimeout` as the timeout leg leaks the timer when the work promise resolves first. Detected by Vitest `--detectOpenHandles`.

### Standard Pattern: `.finally(() => clearTimeout(timer!))`

```typescript
let timer: NodeJS.Timeout;
await Promise.race([
  doWork().finally(() => clearTimeout(timer!)),
  new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('Operation timed out')), timeoutMs);
  }),
]);
```

**Why `timer!` is safe:** The Promise executor runs synchronously. By the time `.finally` can fire (after microtask queue drains), `timer` is guaranteed to be assigned.

**Alternative (avoids non-null assertion):**

```typescript
let timer: NodeJS.Timeout | undefined;
await Promise.race([
  doWork().finally(() => {
    if (timer !== undefined) clearTimeout(timer);
  }),
  new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('Timed out')), timeoutMs);
  }),
]);
```

**Rule:** Every `Promise.race` that uses `setTimeout` must clean up the timer. Grep for `Promise.race` + `setTimeout` without `clearTimeout` in the same scope.

**Detection:** `grep -rn 'Promise.race' packages/ | xargs grep -l setTimeout | xargs grep -L clearTimeout`

---

## 23. Set Dedup Before External Validation

**Recurrence:** 1 P3 (PR #94 marketplace-service.ts). Duplicate URLs in user input caused redundant DNS lookups during SSRF validation.

### Standard Pattern: `[...new Set(array)]` Before I/O Validation

```typescript
// Dedup before validation -- avoids redundant I/O
const uniqueItems = [...new Set(rawItems)];

// Limit applies to unique count (not raw input count)
if (uniqueItems.length > MAX_ITEMS) {
  throw new ValidationError(`Maximum ${MAX_ITEMS} unique items`);
}

// Validate unique items only
await Promise.all(uniqueItems.map((item) => validateExternally(item)));
```

**Key design decision:** Dedup happens BEFORE the count check. The limit constrains unique items, not raw duplicates. Submitting 15 copies of 3 URLs should count as 3, not 15.

**When to apply:** Any array from user input that feeds into I/O-bound validation (DNS, HTTP, DB lookup). Common cases:

- Portfolio URLs before SSRF validation
- Email addresses before verification
- External API keys before health checks
- Relay URLs before connection attempts

**Detection:** Grep for `Promise.all(*.map(*validate*))` where the input comes from user request body without a preceding `new Set()`.

---

## 24. Error Class Selection for Service Methods

**Recurrence:** 3 P2s across PRs #92, #96. Bare `Error` in service methods produces HTTP 500 on client-triggerable paths. Wrong error class (ValidationError instead of AuthorizationError, or vice versa) corrupts security monitoring.

### Decision Matrix

| Scenario                    | Error class                          | HTTP    | Example                          |
| --------------------------- | ------------------------------------ | ------- | -------------------------------- |
| Resource not found          | `ValidationError` or `NotFoundError` | 400/404 | Content ID doesn't exist         |
| Resource in wrong state     | `ValidationError`                    | 400     | Cancel on already-published post |
| Caller doesn't own resource | `AuthorizationError`                 | 403     | Edit someone else's content      |
| Caller not authenticated    | `UnauthorizedError`                  | 401     | Missing/expired token            |
| Infrastructure failure      | raw error (rethrow)                  | 500     | DB connection lost               |

```typescript
import { ValidationError, AuthorizationError } from '../../utils/errors';

// Ownership check → AuthorizationError (403)
if (content.creator_id !== creatorId) {
  throw new AuthorizationError('Not authorized to modify this content');
}

// State guard rejection → ValidationError (400)
if (count === 0) {
  throw new ValidationError('Resource not found or not in expected state');
}

// NEVER: bare Error on client-triggerable path
// throw new Error('something went wrong'); // → 500, pages on-call
```

**Detection:** Grep for `throw new Error(` inside service methods. Any match is a candidate for replacement with a typed error class.

**When to apply:** Every service method that can fail due to client input or state. The only acceptable bare `Error` throw is in catch blocks rethrowing infrastructure failures.

---

## 25. Stale Todo Detection — Triage Before Implementing

**Recurrence:** 2 sprints (PR #93: 40% stale, PR #96: 76% stale). Todos from prior review cycles go stale as subsequent PRs fix the described issues.

### Triage Methodology

1. Spawn lightweight Explore agents grouped by domain (3 agents for ~15-20 items)
2. Each agent reads the referenced source file and checks if the described defect still exists
3. Classify each item: DO / ALREADY_FIXED / WONT_FIX / DEFERRED / FALSE_POSITIVE
4. Only send DO items to implementation agents

```bash
# Quick stale check: grep for the expected fix pattern
grep -n "ValidationError" src/services/SomeService.ts
# If the fix is already present, mark ALREADY_FIXED
```

**Key rules:**

- Never assign a todo without verifying the defect exists at the referenced line in current HEAD
- Use Explore agents (read-only) for triage, not general-purpose agents
- Group by domain to minimize context: backend-routes, types-infra, service-specific
- Budget: 3 agents can triage ~20 items in <5 minutes

**Detection:** When `todos/` has >10 pending items from a previous sprint, run triage before any implementation sprint.

---

## 26. E2E Tests Must Not Mock API Calls

**Recurrence:** 14 test files (6,145 lines) all used `page.route()` to mock every API call. 18 wellness test failures proved mock data diverged from reality. Tests gave false confidence while duplicating Vitest+RTL coverage.

### The Rule

E2E tests exercise real user flows through a real browser. Mocking the API layer turns them into slow component tests.

```typescript
// WRONG: Mock-based "E2E" — tests UI rendering, not integration
await page.route('**/api/**', (route) => route.fulfill({ json: mockData }));
await expect(page.getByText('Dashboard')).toBeVisible(); // Always passes

// RIGHT: Real E2E — tests actual user journey
await loginPage.loginWithEmail('test@sovren.app', 'password123');
await expect(page).toHaveURL(/\/profile/); // Fails if auth is broken
```

### Standard Pattern: Page Object Model + Storage State

```typescript
// 1. POMs centralize locators (e2e/pages/login.page.ts)
export class LoginPage {
  readonly emailTab: Locator;
  readonly emailInput: Locator;
  constructor(page: Page) {
    this.emailTab = page.getByRole('button', { name: /Email/ });
    this.emailInput = page.getByLabel('Email address');
  }
  async loginWithEmail(email: string, password: string) {
    /* ... */
  }
}

// 2. Auth setup saves state once (e2e/auth.setup.ts)
setup('authenticate', async ({ page }) => {
  // Real login flow — no mocks
  await page.context().storageState({ path: authFile });
});

// 3. Config uses 3-tier projects
projects: [
  { name: 'setup', testMatch: /auth\.setup\.ts/ },
  { name: 'authenticated', dependencies: ['setup'], use: { storageState: authFile } },
  { name: 'public', testMatch: /home\.spec\.ts/ },
];
```

### Checklist

- [ ] Zero `page.route()` calls in any E2E test
- [ ] Role-based locators (`getByRole`, `getByLabel`) — no CSS selectors
- [ ] No `waitForTimeout` — use web-first assertions
- [ ] Page Object Model for all pages under test
- [ ] Storage state auth (authenticate once, reuse)
- [ ] ESM-compatible (`import.meta.url` not `__dirname`)

**Detection:** `grep -r "page.route" e2e/` should return zero results. Any `page.route()` in E2E = use Vitest+RTL instead.

---

## 27. New Test Types Need Three Integration Points

**Recurrence:** Playwright E2E existed locally but was missing from CI pipeline and agent briefs. Frontend agents were told "E2E tests (QA agent in Phase 3)" and never wrote E2E tests during implementation. QA brief referenced wrong monorepo paths.

### The Rule

When adding any new test type (E2E, a11y, performance, security), it must be wired into three places or it becomes a dead artifact:

1. **CI pipeline** — a stage that gates deploys
2. **Agent brief deliverables** — agents must write these tests during implementation
3. **Project CLAUDE.md** — structure, conventions, and commands documented

### Checklist

- [ ] CI pipeline stage added with artifact upload on failure
- [ ] Deploy stages depend on new test stage passing
- [ ] Project CLAUDE.md section added (structure, conventions, commands)
- [ ] Frontend agent brief: test type added as deliverable checklist item
- [ ] QA agent brief: correct monorepo paths + conventions documented
- [ ] Backend agent brief: scope boundary updated (who creates what)
- [ ] `npm run test:*` script exists in package.json

### Anti-Pattern: "QA Handles It in Phase 3"

```markdown
# WRONG: Frontend brief defers all E2E to QA

**You DO NOT OWN:**

- E2E tests (QA agent in Phase 3)

# RIGHT: Frontend creates E2E alongside UI, QA hardens

**Deliverables:**

- [ ] E2E Page Object + spec for the new page/feature
```

When E2E is deferred entirely to Phase 3, the QA agent lacks context about implementation details and the E2E coverage arrives too late to catch integration issues during development.

**Detection:** `grep -r "QA.*Phase 3.*handles" briefs/` — any brief that fully defers a test type to QA is a gap. Implementation agents should create initial coverage; QA extends and hardens.

---

## 28. Grep Same File After Fixing a Class Method

**Recurrence:** `isValidSignature()` standalone export had the same bug as `verifySignature()` class method — but only the method was fixed. Bug survived 7 sprints until full-file review caught it. 9/10 agents flagged it independently.

### The Rule

When fixing a pattern in a class method, **always grep the same file** for the identical pattern in:

- Standalone exported functions
- Other class methods
- Helper utilities at the bottom of the file

### Checklist

```bash
# After fixing a bug, search for the same broken pattern
grep -n "BROKEN_PATTERN" path/to/fixed-file.ts

# Example: after fixing id: '' in verifySignature(), check the rest of the file
grep -n "id: ''" packages/backend/src/services/nostr-auth.ts
```

### Why This Happens

1. **Copy-paste during initial development** — standalone utility duplicates class method logic
2. **Diff-based reviews** only see the fixed method, not the still-broken utility below
3. **Test coverage gaps** — if the standalone utility isn't called by any test, the bug is invisible

### Prevention

- After any fix, run: `grep -n "OLD_BROKEN_PATTERN" <fixed-file>` to find remaining instances
- Use full-file reviews (not diff reviews) for security-critical files
- Agent consensus ≥ 6 = confirmed true positive — strongest signal possible

---

## 29. Silent Fallback / Lazy Init Must Log a Warning

**Recurrence:** Redis `getRedisClient()` lazy-created a client bypassing `ping()` health check with zero logging. Services silently got unverified connections. Pattern also appeared in feature flag fallbacks and config defaults across 3 prior sprints.

### The Rule

Every code path that falls back to a default, lazy-creates a resource, or bypasses a verification step **must emit a `logger.warn()`**. Silent fallbacks hide operational problems until they cascade.

### Pattern

```typescript
// ❌ WRONG: Silent fallback — if Redis is down, no one knows
export function getRedisClient(): Redis {
  if (!sharedClient) {
    sharedClient = createClient();
  }
  return sharedClient;
}

// ✅ RIGHT: Warn so ops can see lazy init in logs
export function getRedisClient(): Redis {
  if (!sharedClient) {
    logger.warn(
      '[Redis] Lazy-creating client — connectRedis() was not called first. Ping verification skipped.'
    );
    sharedClient = createClient();
  }
  return sharedClient;
}
```

### Applies To

- Lazy singleton initialization (Redis, DB, cache clients)
- Config fallback values (e.g., `process.env.FOO || 'default'` for non-trivial defaults)
- Feature flag fallbacks (`flag ?? false`)
- Retry exhaustion fallbacks (`return cachedValue` when API call fails)

### Detection

```bash
# Find lazy-init patterns without logging
grep -n "if (!.*) {" src/lib/*.ts | grep -v "logger\|console\|throw"
```

---

## Agent Brief Template Addition

Add this to every agent brief's CONTEXT TO LOAD section:

```
CONTEXT TO LOAD:
- Read docs/solutions/patterns/critical-patterns.md (MANDATORY — P1 prevention)
- Read docs/solutions/patterns/common-solutions.md (reference for recurring fixes)
- Read these files: {domain-specific files}
```

---

## Index: Which Pattern Solves Which Issue

| Issue You're Seeing                          | Pattern # | File                 |
| -------------------------------------------- | --------- | -------------------- |
| Race condition on capacity/count             | 1a-1c     | critical-patterns.md |
| User can access others' data                 | 2         | critical-patterns.md |
| Query loads too much into memory             | 3         | critical-patterns.md |
| Two inserts, second might fail               | 4         | critical-patterns.md |
| Payment data could be lost                   | 5         | critical-patterns.md |
| URL from user input fetched server-side      | 6a-6c     | critical-patterns.md |
| DNS TOCTOU between validate and fetch        | 6b        | critical-patterns.md |
| IPv6 encoding bypasses SSRF check            | 6c        | critical-patterns.md |
| Can delete a paid/active entity              | 7         | critical-patterns.md |
| Button fires duplicate mutations             | 1         | common-solutions.md  |
| Map grows without bound                      | 2         | common-solutions.md  |
| New env var not validated                    | 3         | common-solutions.md  |
| Inconsistent error responses                 | 4         | common-solutions.md  |
| snake_case in API response                   | 5         | common-solutions.md  |
| Worker running for stub function             | 6         | common-solutions.md  |
| Tests break after service change             | 7         | common-solutions.md  |
| New routes missing rate limit                | 8         | common-solutions.md  |
| Named route not matching                     | 9         | common-solutions.md  |
| `db: any` in constructor                     | 10        | common-solutions.md  |
| Vitest OOM / worker crashes                  | 11        | common-solutions.md  |
| `git diff --cached` empty at push            | 12        | common-solutions.md  |
| Batch op fails on single rejection           | 13        | common-solutions.md  |
| Same utility in 3+ files                     | 14        | common-solutions.md  |
| Hook loops agents on pre-existing issues     | 15        | common-solutions.md  |
| Security file changed, no tests ran          | 16        | common-solutions.md  |
| Test framework migrated, hooks broken        | 17        | common-solutions.md  |
| Hook error suppressed, failures hidden       | 18        | common-solutions.md  |
| grep breaks on macOS / portability issue     | 19        | common-solutions.md  |
| `forEach(async` does nothing / returns early | 20        | common-solutions.md  |
| Need to cancel BullMQ job without DB lookup  | 21        | common-solutions.md  |
| Promise.race leaks setTimeout handle         | 22        | common-solutions.md  |
| Duplicate items cause redundant I/O          | 23        | common-solutions.md  |
| Bare `Error` in service method → 500         | 24        | common-solutions.md  |
| DB insert + queue enqueue partial failure    | 4c        | critical-patterns.md |
| Todos from prior sprint, many may be stale   | 25        | common-solutions.md  |
| E2E tests mock API via `page.route()`        | 26        | common-solutions.md  |
| New test type exists locally but not in CI   | 8a-8c     | critical-patterns.md |
| NOSTR verifyEvent with `id: ''`              | 9a-9b     | critical-patterns.md |
| Fixed method but standalone utility broken   | 28        | common-solutions.md  |
| Silent fallback with no logging              | 29        | common-solutions.md  |
| String duplicated across packages            | 10a       | critical-patterns.md |
| Lazy init with no logging                    | 10b       | critical-patterns.md |
