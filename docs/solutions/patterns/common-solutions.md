---
title: Common Solutions — Reusable Fixes for Recurring Issues
date: '2026-02-26'
category: patterns
purpose: Consolidated solutions for P2/P3 patterns that recur across sprints. Prevents re-invention.
usage: Reference when implementing features. Check if a solution already exists here before writing new code.
---

# Common Solutions

Reusable solutions extracted from 180+ P2/P3 findings across 14 sprints. These are not critical blockers but patterns that waste time when re-discovered. **Check here before implementing anything in these categories.**

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

### Table-Aware Mock Routing (multi-table services)

Services querying 2+ tables get `undefined` from single-chain mocks. Route `from()` by table name:

```typescript
const userChain = createMockChain(mockUsers);
const paymentChain = createMockChain(mockPayments);
const defaultChain = createMockChain([]);

mockDb.from = vi.fn((table: string) => {
  switch (table) {
    case 'users':
      return userChain;
    case 'payments':
      return paymentChain;
    default:
      return defaultChain;
  }
});
```

**When to use:** Any service whose constructor or methods call `db.from()` with 2+ different table names. Single-chain mocks silently return `undefined` for the second table.

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

**Recurrence:** 3 sprints (PR #93: 40% stale, PR #96: 76% stale, E2E review #472-478: 71% stale). Todos from prior review cycles go stale as subsequent PRs fix the described issues.

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

// 3. Config uses 3-tier projects with convention-based discovery
projects: [
  { name: 'setup', testMatch: /\.setup\.ts$/ },
  {
    name: 'authenticated',
    testMatch: /\.auth\.spec\.ts$/,
    dependencies: ['setup'],
    use: { storageState: authFile },
  },
  { name: 'public', testMatch: /\.public\.spec\.ts$/ },
];
```

### Checklist

- [ ] Zero `page.route()` calls in any E2E test
- [ ] Role-based locators (`getByRole`, `getByLabel`) — no CSS selectors
- [ ] No `waitForTimeout` — use web-first assertions
- [ ] Page Object Model for all pages under test
- [ ] All locators centralized in POMs — no raw `page.getBy*()` in spec files
- [ ] `beforeEach` extracts shared POM instantiation + `goto()` when 2+ tests repeat it
- [ ] `.first()` on any POM heading/logo locator that may match multiple DOM elements
- [ ] `as const` on credential exports for narrower types
- [ ] Storage state auth (authenticate once, reuse)
- [ ] ESM-compatible (`import.meta.url` not `__dirname`)
- [ ] Import order: `@playwright/test` first, then local imports

**Detection:** `grep -r "page.route" e2e/` should return zero results. Any `page.route()` in E2E = use Vitest+RTL instead. `grep -rn "page.getBy" e2e/*.spec.ts` flags raw locators that should be in POMs.

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

## 30. Convention-Based Playwright Spec Naming (Eliminates Silent Test Exclusion)

**Recurrence:** 1 P2. Hardcoded `testMatch` arrays in `playwright.config.ts` create a hidden contract — every new spec must be manually registered. Missing registration = silent exclusion with exit code 0 and zero warnings. Playwright runs the listed files and ignores the new one.

### The Rule

Use suffix-based wildcard patterns that auto-discover specs by naming convention. Never hardcode individual filenames in `testMatch`.

```typescript
// ❌ WRONG: Manual registry — new specs silently excluded if not listed
testMatch: ['**/auth.spec.ts', '**/home.spec.ts', '**/navigation.spec.ts'],

// ✅ RIGHT: Convention-based — new specs auto-discovered by suffix
{
  name: 'chromium-authenticated',
  testMatch: /\.auth\.spec\.ts$/,     // auto-discovers all *.auth.spec.ts
  dependencies: ['setup'],
  use: { storageState: authFile },
},
{
  name: 'chromium-public',
  testMatch: /\.public\.spec\.ts$/,   // auto-discovers all *.public.spec.ts
},
```

### Naming Convention

- Authenticated tests: `{name}.auth.spec.ts` (matched by `chromium-authenticated` project)
- Public page tests: `{name}.public.spec.ts` (matched by `chromium-public` project)
- No config change needed when adding a new spec — just use the correct suffix

### Detection

If `testMatch` in `playwright.config.ts` contains specific file names rather than glob/regex patterns, flag for refactor. `grep -n "testMatch.*spec\.ts" playwright.config.ts` and check for file names instead of wildcards.

---

## 31. `unknown` Is the Correct Input Type for Type Guards

**Recurrence:** 1 P2. `isValidEvent(event: any)` defeated TypeScript's type checking at call sites. Callers could pass `string`, `number`, or `null` without a compile error. The runtime checks inside the function were correct, but `any` erased the safety signal.

### The Rule

Type guards over untrusted data must use `unknown` as the input type. The compiler enforces this because property access on `unknown` requires a cast or narrowing step first.

```typescript
// ❌ WRONG: any disables type checking at call sites
function isValidEvent(event: any): event is NostrEvent {
  return typeof event === 'object' && event !== null && typeof event.id === 'string';
}

// ✅ RIGHT: unknown forces callers to explicitly pass untrusted data
function isValidEvent(event: unknown): event is NostrEvent {
  if (typeof event !== 'object' || event === null) return false;
  const e = event as Record<string, unknown>;
  return (
    typeof e.id === 'string' &&
    typeof e.pubkey === 'string' &&
    typeof e.kind === 'number' &&
    typeof e.content === 'string' &&
    Array.isArray(e.tags)
  );
}
```

### Key Points

- The intermediate cast to `Record<string, unknown>` is required because TypeScript doesn't allow property access on `unknown` directly
- This is the idiomatic pattern for runtime type guards over untrusted data
- Use `any` only when the function is genuinely flexible and NOT acting as a type guard

### Detection

```bash
# Find type guards with 'any' input
grep -rn "(.*: any).*is " --include="*.ts" src/ e2e/
```

---

## 32. Agent-Native Discoverability Scoring for CLAUDE.md

**Recurrence:** 1 P2. Agent-native reviewer scored 4 E2E areas at 6-7/10 — POM template, auth setup chain, credential enumeration, USE_BACKEND explanation. Agents building new E2E specs lacked guidance and reinvented patterns or asked clarifying questions.

### The Rule

After any structural change (new test framework, new file conventions, new workflow), run the agent-native reviewer and score each capability on a 1-10 scale. Any score <8/10 is an actionable documentation gap in CLAUDE.md.

### What to Score

For each agent task ("create a new POM", "write an authenticated spec", "understand auth setup"), ask:

1. Can the agent find the relevant section in CLAUDE.md?
2. Does it include a concrete example (template, code snippet)?
3. Are all options enumerated (credential names, command flags)?
4. Is the "why" explained (not just "what")?

### Standard CLAUDE.md Expansion Pattern

```markdown
## [Feature] Section

**Setup chain:** [numbered steps showing the dependency flow]

**Available [resources]:** [table with Name, Purpose, Used by columns]

**Template:**
[complete code example an agent can copy-paste and adapt]

**Conventions:**

- [rule 1 with rationale]
- [rule 2 with rationale]
```

### Checklist

- [ ] Agent-native review run after structural changes
- [ ] All capabilities score 8+/10
- [ ] CLAUDE.md includes templates for creating new artifacts
- [ ] All available resources enumerated (credentials, commands, config options)
- [ ] Setup chains documented as numbered dependency flows

**Detection:** Run agent-native-reviewer on CLAUDE.md after any framework/convention change. Scores <8/10 = documentation gap.

---

## 33. MSW v2 WebSocket Mock Override

**Recurrence:** 2 sprints (Phase 9 analytics + CollaborativeFeatures). MSW v2 locks `globalThis.WebSocket` as non-writable via `Object.defineProperty`.

### When You See It

- `(WebSocket as any).mock.results[0].value` is `undefined`
- WebSocket constructor spy shows 0 calls despite component creating WebSocket
- `global.WebSocket = vi.fn()` silently fails (no error, just ignored)

### Fix: Object.defineProperty in beforeEach

```typescript
const mockWsInstance = {
  close: vi.fn(),
  send: vi.fn(),
  readyState: 1,
  onopen: null as any,
  onclose: null as any,
  onmessage: null as any,
  onerror: null as any,
};
const MockWebSocket = vi.fn(() => mockWsInstance) as any;
MockWebSocket.CONNECTING = 0;
MockWebSocket.OPEN = 1;
MockWebSocket.CLOSING = 2;
MockWebSocket.CLOSED = 3;

beforeEach(() => {
  MockWebSocket.mockClear();
  Object.defineProperty(globalThis, 'WebSocket', {
    value: MockWebSocket,
    configurable: true,
    writable: true,
  });
});
```

**When MSW is NOT intercepting WebSocket**: `vi.stubGlobal('WebSocket', MockWebSocket)` works.

---

## 34. React Effect Flushing with Fake Timers

**Recurrence:** 2 sprints. Effects don't fire after mounting because React's scheduler uses MessageChannel (unaffected by `vi.useFakeTimers`).

### Fix

```typescript
// After render + state change, flush React's scheduler:
await act(async () => {}); // flushes MessageChannel-based queue
```

**Do NOT** use `vi.advanceTimersByTime()` to flush effects — it only advances setTimeout/setInterval.

---

## 35. Test QueryClient retryDelay

**Recurrence:** PaymentHistory + any component using React Query with `retry > 0`. Error-state tests timeout because retries use exponential backoff.

### Fix

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, retryDelay: 0, gcTime: 0 },
  },
});
```

Always set `retryDelay: 0` in test QueryClients, even if `retry: false` — some components override retry at the hook level.

---

## 36. vi.hoisted() for Mock Factory Variables

**Recurrence:** 3 sprints. `vi.mock()` factories cannot reference variables declared below them in source — Vitest hoists `vi.mock()` to the top.

### When You See It

`ReferenceError: Cannot access 'MyVariable' before initialization` pointing at a `vi.mock()` factory.

### Fix

```typescript
// Declare with vi.hoisted() — runs at hoist time, before vi.mock factories
const { MyStub } = vi.hoisted(() => {
  const MyStub = () => <div>Stub</div>;
  return { MyStub };
});

vi.mock('../MyComponent', () => ({ MyComponent: MyStub }));
```

---

## 37. React Version Hoisting in npm Workspaces

**Recurrence:** 1 P1 (PR #99). Any `npm update` in a monorepo with React 18 apps risks this.

After `npm update`, transitive peer deps (Radix UI, etc.) that accept `react: "^18 || ^19"` cause npm to hoist React 19 to root `node_modules/`. Two React instances coexist — hooks break with "Objects are not valid as a React child" (1,541 test failures).

### Fix: Pin React via overrides

```json
// root package.json
"overrides": {
  "react": "^18.3.1",
  "react-dom": "^18.3.1"
}
```

### Detection

Run tests immediately after `npm update`. React conflicts manifest as mass test failures, not build errors.

### When to use

Always pin framework packages via overrides in monorepos when the ecosystem has split peer dependency ranges across major versions.

---

## 38. GitHub Action Major Version Silent Parameter Renames

**Recurrence:** 1 P1 (PR #99). Every GitHub Action major bump risks this.

`slackapi/slack-github-action@v2` renamed `webhook-url` to `webhook`. The action silently ignores unknown inputs — no error, exit code 0, but no notification sent. Especially dangerous for rollback alerts.

### Detection

```bash
# After bumping any action version, find ALL usages across workflows
grep -rn "uses: slackapi/slack-github-action" .github/workflows/
```

Check the action's release notes for renamed/removed inputs. Partial migration across workflow files is the common failure mode — one file gets updated, others don't.

### Checklist for action major bumps

1. `grep -rn "uses: {action}@" .github/workflows/` — find ALL usages
2. Read the action's `CHANGELOG.md` or release notes for the new major version
3. Check for renamed inputs, changed defaults, removed features
4. Update ALL workflow files in the same commit
5. Test with `act` or a dry-run workflow dispatch if possible

---

## 39. npm Lockfile Stale Workspace Resolutions

**Recurrence:** 1 P2 (PR #99). Affects any npm workspace version alignment.

After updating all 4 `package.json` files to `nostr-tools: ^2.23.1`, the lockfile kept per-workspace resolutions at `2.23.0`. Neither `npm install` nor `npm update` re-resolved them.

### Fix: Override + lockfile regeneration

```json
// root package.json — force single version
"overrides": {
  "nostr-tools": "2.23.1"
}
```

```bash
rm package-lock.json && npm install
```

### When to use

Always use overrides for security-critical libraries (crypto, auth, payment SDKs) in monorepos. Verify resolution:

```bash
grep -B1 '"version":' package-lock.json | grep -A1 '{package-name}'
```

---

## 40. Verify Import Chain Before Modifying Config Files

**Recurrence:** 1 P2 (PR #99). 4/8 review agents flagged dead code migration.

Before modifying any singleton/config file during a migration, verify it's actually imported:

```bash
# Check if the module has any importers
grep -rn "from.*{module-path}" packages/ --include="*.ts" --include="*.tsx"
```

If no results → the file is dead code. Don't modify it — either delete it or skip. Modifying dead code creates a false sense of coverage.

---

## 41. `vi.resetAllMocks()` vs `vi.clearAllMocks()`

**Recurrence:** 87 test files in one sprint (PR #100). This is the #1 root cause of mock-related test failures.

- `vi.clearAllMocks()` — clears call history only, preserves `mockResolvedValue` implementations
- `vi.resetAllMocks()` — clears EVERYTHING including `mockResolvedValueOnce` queues

**Rule:** If your `afterEach` uses `vi.resetAllMocks()`, you MUST re-apply mock implementations in `beforeEach()`. Otherwise the second test in every suite gets `undefined`.

```typescript
// ❌ WRONG — resetAllMocks wipes the implementation set in describe scope
const mockFn = vi.fn().mockResolvedValue({ data: [], error: null });
afterEach(() => vi.resetAllMocks()); // Second test: mockFn returns undefined

// ✅ RIGHT — re-apply in beforeEach
let mockFn: ReturnType<typeof vi.fn>;
beforeEach(() => {
  mockFn = vi.fn().mockResolvedValue({ data: [], error: null });
});
afterEach(() => vi.resetAllMocks());
```

**Detection:** Grep for `resetAllMocks` in `afterEach` — then check if `beforeEach` re-applies all mock implementations.

---

## 42. `structuredClone()` for Shared Test Data

**Recurrence:** 2 sprints. Shallow spread `{ ...obj }` leaks nested references between tests, causing flaky test ordering.

```typescript
// ❌ WRONG — nested objects are shared references
const DEFAULT_PREFS = { notifications: { email: true, push: false } };
const getDefaults = () => ({ ...DEFAULT_PREFS }); // notifications is same ref

// ✅ RIGHT — deep copy prevents cross-test pollution
const DEFAULT_PREFS = { notifications: { email: true, push: false } };
const getDefaults = () => structuredClone(DEFAULT_PREFS);
```

**When to use:** Any service method that returns a module-level default object. Also any test fixture with nested objects shared across tests.

**Detection:** Grep for `{ ...DEFAULT_` or `{ ...INITIAL_` patterns in service code. If the object has nested properties, it needs `structuredClone()`.

---

## 43. ESM Default Export Mocking (`{ default: mockFn }`)

**Recurrence:** 2 sprints. `vi.mock()` for modules with `export default` requires explicit `default` key.

```typescript
// ❌ WRONG — mock doesn't match ESM default export shape
vi.mock('ws', () => ({ WebSocket: vi.fn(() => mockWs) }));

// ✅ RIGHT — ESM default export needs { default: ... }
vi.mock('ws', () => ({ default: vi.fn(() => mockWs) }));
```

**When to use:** Any `vi.mock()` targeting a module that uses `export default`. Check the source module — if it uses `export default class/function`, the mock factory must return `{ default: ... }`.

---

## 44. `process.nextTick` Flush for Fire-and-Forget Async

**Recurrence:** 2 sprints. Express `asyncHandler` patterns that fire async work without `await` leave assertions racing against microtasks.

```typescript
// Route handler fires async work without awaiting
app.post(
  '/route',
  asyncHandler(async (req, res) => {
    res.json({ ok: true });
    backgroundService.process(req.body); // fire-and-forget, no await
  })
);

// ❌ WRONG — assertion runs before backgroundService.process completes
await request(app).post('/route').send(data);
expect(backgroundService.process).toHaveBeenCalled(); // Fails intermittently

// ✅ RIGHT — flush microtask queue first
await request(app).post('/route').send(data);
await new Promise(process.nextTick); // flush fire-and-forget
expect(backgroundService.process).toHaveBeenCalled();
```

**Detection:** Grep for test assertions on mocked services called from route handlers where the route sends the response before the service call.

---

## 45. Class-Based Mocks Need Re-Init After `vi.resetAllMocks()`

**Recurrence:** 2 sprints. Class instances with `vi.fn()` methods get cleared by `resetAllMocks()` but the instance itself persists — methods become `undefined`.

```typescript
// ❌ WRONG — mockPool methods cleared after first test
const mockPool = { close: vi.fn(), subscribeMany: vi.fn() };
afterEach(() => vi.resetAllMocks());

// ✅ RIGHT — create fresh instance in beforeEach
let mockPool: { close: ReturnType<typeof vi.fn>; subscribeMany: ReturnType<typeof vi.fn> };
beforeEach(() => {
  mockPool = { close: vi.fn(), subscribeMany: vi.fn() };
});
afterEach(() => vi.resetAllMocks());
```

**When to use:** Any mock object whose methods are `vi.fn()` AND whose test suite uses `vi.resetAllMocks()`. Particularly common with `SimplePool` (nostr-tools), WebSocket mocks, and service class mocks.

---

## 46. `global.fetch` Must Exist Before Service Instantiation

**Recurrence:** 1 sprint (87 files). Services that capture `fetch` at construction time get `undefined` if the mock is applied after `new Service()`.

```typescript
// ❌ WRONG — service captures fetch in constructor, mock applied too late
const service = new MyService(db);
global.fetch = vi.fn().mockResolvedValue(new Response('ok'));
// service.fetch is still the original (or undefined)

// ✅ RIGHT — mock fetch before instantiating the service
global.fetch = vi.fn().mockResolvedValue(new Response('ok'));
const service = new MyService(db);
```

**When to use:** Any service that uses `fetch` (directly or via a captured reference) AND is constructed in test setup. Check the service constructor for `this.fetch = fetch` or similar captures.

---

## 47. Sprint Boundary Checklist for Repo Health

**Recurrence:** 1 sprint. After 20+ sprints, 16 stale branches + 25 remote branches + 9 stashes + orphaned PR + dirty tree accumulated.

**Problem:** Repo cruft (stale branches, stashes, orphaned PRs) accumulates silently between sprints. No automated verification before work starts.

**Solution:** Execute 7-step checklist at sprint start:

```bash
# 1. Sync with remote
git fetch origin

# 2. Run repo health check
npm run verify:repo-health
# ✅ Verifies: working tree clean, no stashes, no stale branches, main up-to-date

# 3. Detect branches not updated in 7 days (likely squash-merged)
scripts/detect-stale-branches.sh 7 | xargs -I {} git branch -d {}

# 4. Check for orphaned PRs
gh pr list --state open | grep -v "base: main"

# 5. Verify .gitignore is current
git status  # Should show no untracked files (except .env.local)

# 6. Ensure yarn.lock is fresh
git log --oneline yarn.lock | head -1

# 7. Ensure main is up-to-date
git switch main && git pull origin main
```

**Key metrics to track:**

- Stale branches count — target: 0 at sprint boundary
- Orphaned PRs — target: 0
- Stash count — target: 0
- Dirty working tree failures — target: 0 per sprint

**When to use:** Start of every sprint, before claiming first task. Takes 2-3 minutes.

---

## 48. Post-Merge Branch Cleanup

**Recurrence:** Every PR merge. After squash-merge, both local and remote branches remain, risking accidental branches off stale code.

**Problem:** `git branch --merged` doesn't detect squash merges (original commits lost in rewrite). Manual deletion of remote branches forgotten.

**Solution:** Delete both local and remote branch immediately after squash-merge.

```bash
# After gh pr merge --squash
BRANCH=$(git rev-parse --abbrev-ref HEAD)
git switch main
git branch -d "$BRANCH"
git push origin :"$BRANCH" 2>/dev/null || true
echo "✅ Cleaned up $BRANCH"
```

**Where to integrate:**

- GitHub Actions CI workflow post-merge (create `.github/workflows/branch-cleanup.yml`)
- CLI wrapper for `gh pr merge` (add to local shell aliases)
- Manual PR merge checklist (if automation unavailable)

**When to use:** Every PR merge to main.

---

## 49. .gitignore Proactive Updates

**Recurrence:** 20+ sprints. New local tools (Supabase CLI, test data dirs, IDE files) accumulate without `.gitignore` entries, forcing `git update-index --skip-worktree` hacks.

**Problem:** New dev tools added over time without updating `.gitignore`. Later developers see untracked files, either commit them or use skip-worktree (which breaks CI).

**Solution:** Update `.gitignore` in the same PR as new tooling. Include categories:

```
# Local development
.env.local
.env.*.local
.supabase/
.supabase-local/

# Build and test artifacts
dist/
coverage/
test-results/
.turbo/

# IDE and OS
.DS_Store
.vscode/local.env
*.swp
*.swo

# Node
node_modules/
npm-debug.log*
yarn-error.log*

# Test data (temporary)
test-data/
fixtures/temp/
seeds/temp/
```

**Process:**

1. Before adding new tool, identify what untracked files it creates
2. Add those patterns to `.gitignore` in the same commit as the tool
3. Verify `git status` shows no unexpected untracked files
4. Note in PR description: "Updated .gitignore for {tool-name} artifacts"

**Code review checklist:**

- ✅ New local tool added? → Did PR update `.gitignore`?
- ✅ Does `git status` show clean after running the tool?

**When to use:** Any PR adding new local tooling, build artifact type, or IDE integration. **Zero tolerance: PR cannot merge without .gitignore update if introducing new untracked files.**

---

## 50. Real Services > vi.fn() Mocks for Integration Tests

**Recurrence:** 317 mocks across 3 test files. When `PaymentProcessingService` grew from 8→28 methods, all mock stubs broke silently — tests passed but exercised no real behavior.

**Problem:** `vi.fn()` mocks couple tests to implementation details. When a service grows, every mock must be updated manually. Single-chain mocks can't serve multi-table queries or arbitrary state permutations.

**Solution:** Create a shared test harness with real service instances backed by in-memory storage:

```typescript
// packages/backend/src/test-utils/payment-test-harness.ts
export function createPaymentTestHarness(): PaymentTestHarness {
  const logger = new SilentLogger();
  const eventBus = new TestableEventBus(logger);
  const cache = new InMemoryCacheService();
  const paymentService = new PaymentProcessingService(eventBus, logger, cache);
  // ... wire all services with real instances
  return { paymentService, refundService, ..., dispose, seedCompletedTransaction };
}
```

**Detection rule:** If a test file has >10 `vi.fn()` stubs for a single service interface, or the service has >5 methods, it's a candidate for a test harness.

**When to use:** Any service with >5 methods or cross-service interactions. Tests exercise actual behavior including edge cases mocks would miss.

**Cross-reference:** [Payment Test Harness — Mock Elimination](../testing/payment-test-harness-mock-elimination-20260226.md)

---

## 51. Runtime Guard for Private Field Access in Tests

**Recurrence:** 2 sprints. Test harness accesses private internals via `as any`, then service refactors produce cryptic `TypeError: Cannot read properties of undefined`.

**Problem:** `(service as any).repository.saveTransaction(tx)` breaks silently when the private field name changes.

**Solution:** Add a runtime guard with descriptive error before accessing private fields:

```typescript
const repo = (service as any).repository;
if (!repo || typeof repo.saveTransaction !== 'function') {
  throw new Error(
    'seedRawTransaction: PaymentProcessingService internal API changed. ' +
      'Expected (paymentService as any).repository.saveTransaction to exist.'
  );
}
await repo.saveTransaction(tx);
```

**Detection rule:** Any `(x as any).privateField` in test utilities without a preceding null/typeof check.

**When to use:** Every test helper that accesses private fields via `as any`. Fails fast with a descriptive error instead of cryptic `TypeError` deep in test execution.

---

## 52. dispose() Must Cover ALL Timer-Based Services

**Recurrence:** ~1200 timer handles leaked per test run (4/8 services missing from dispose). Causes flaky tests and Node.js `--detectOpenHandles` warnings.

**Problem:** Test harness creates multiple services with `setInterval`/`setTimeout` in constructors, but `dispose()` only cleans up some of them.

**Solution:** Every service that starts a timer MUST have its `dispose()` called in teardown:

```typescript
const dispose = async (): Promise<void> => {
  await paymentService.dispose(); // clears expirationCheckInterval
  await currencyService.dispose(); // clears refreshInterval
  await auditLog.dispose(); // clears archiveInterval
  await analyticsService.dispose(); // clears subscriptions + jobs
  await refundService.dispose();
  await subscriptionService.dispose();
  await eventBus.dispose();
  await cache.dispose();
};
```

**Detection checklist:**

1. `grep -rn 'setInterval\|setTimeout' packages/backend/src/services/` — list all timer-based services
2. Verify each one appears in the harness `dispose()` function
3. When adding a new service to the harness, add it to `dispose()` in the same commit

**When to use:** Any test harness that creates services with timers/intervals. Missing even one service leaks handles that accumulate across the test suite.

---

## 53. Factory Return Types Must Match Consumer Parameter Types

**Recurrence:** 20 `as any` casts in SubscriptionService tests. Factory returns `{createdAt, updatedAt}` but `createPlan()` expects `Omit<..., 'createdAt' | 'updatedAt'>`.

**Problem:** Test factories create objects with extra fields that the service method doesn't accept. The mismatch requires `as any` casts that mask real type errors.

**Solution:** Define a type alias matching the consumer's parameter type:

```typescript
// ❌ WRONG — factory returns superset, needs `as any` cast
function makeCreatorPlan(): Omit<SubscriptionPlan, 'id'> & { id?: string } { ... }
service.createPlan(makeCreatorPlan() as any);  // 20 casts

// ✅ CORRECT — factory returns exactly what createPlan() expects
type CreatePlanInput = Omit<SubscriptionPlan, 'id' | 'createdAt' | 'updatedAt'>;
function makeCreatorPlan(): CreatePlanInput { ... }
service.createPlan(makeCreatorPlan());  // no cast needed
```

**Detection rule:** `grep -c 'as any' path/to/test.ts` — if >5 `as any` casts in a test file, check if factory return types match consumer parameter types.

**When to use:** Every test factory that creates objects consumed by service methods. Extra fields require `as any` casts that mask real type errors. Define the factory return type from the consumer's parameter type, not from the domain model.

---

## 54. Re-Export Does NOT Create Local Scope

**Recurrence:** 1 P1-class pre-existing bug (PR #103). `export { X } from './module'` makes `X` available to consumers but NOT the re-exporting file itself. Causes runtime `ReferenceError` that TypeScript cannot detect at compile time.

### The Problem

```typescript
// error-handler-middleware.ts

// WRONG — NotFoundError is available to importers of THIS file,
// but NOT usable within this file's own functions
export { NotFoundError } from '../utils/errors';

function handleError(err: unknown) {
  if (err instanceof NotFoundError) {
    // ReferenceError at runtime!
    res.status(404).json({ error: err.message });
  }
}
```

### Standard Pattern: Import + Re-Export

```typescript
// RIGHT — two-step: import for local use, then re-export
import { NotFoundError } from '../utils/errors';
export { NotFoundError };

function handleError(err: unknown) {
  if (err instanceof NotFoundError) {
    // Works correctly
    res.status(404).json({ error: err.message });
  }
}
```

### Why TypeScript Doesn't Catch It

TypeScript type-checks `export { X } from` as valid syntax for the re-export declaration. But `instanceof` is a runtime operation — TypeScript doesn't verify that the name is in scope for runtime use within the same file. The file compiles cleanly and crashes at runtime.

**Detection:** Files that have `export { X } from` AND use `X` in their own function bodies. The grep is tricky because the export is syntactically valid:

```bash
# Find files with re-exports that may use the name locally
grep -l "export {.*} from" packages/ --include="*.ts" -r | while read f; do
  names=$(grep -oP "export \{ \K[^}]+" "$f" | tr ',' '\n' | tr -d ' ')
  for name in $names; do
    if grep -q "instanceof $name\|new $name\|$name\." "$f"; then
      echo "POTENTIAL BUG: $f re-exports and locally uses $name"
    fi
  done
done
```

**When to apply:** Any barrel file or middleware that both re-exports and uses the same symbols.

---

## 55. Service Stub Name Collisions on Case-Insensitive Filesystems

**Recurrence:** 1 P2 (PR #103, 5/7 agent consensus). Creating `notification-service.ts` alongside existing `NotificationService.ts` on macOS APFS (case-insensitive by default) can cause silent import misdirection.

### The Problem

macOS APFS and Windows NTFS are case-insensitive by default. Two files differing only by case (`NotificationService.ts` vs `notification-service.ts`) may resolve to the same file depending on import casing and module resolution order. CI on Linux (ext4, case-sensitive) passes fine — the collision only manifests on developer machines.

### Standard Pattern: Use Explicitly Different Names for Stubs

```
# WRONG — case-insensitive collision risk
services/
  NotificationService.ts   # Real DI-registered service
  notification-service.ts  # Stub — APFS may confuse these

# RIGHT — no possible collision
services/
  NotificationService.ts   # Real DI-registered service
  notification-stub.ts     # Clearly a stub, different name entirely
```

### Naming Convention for Stubs

| Real File                | Stub File              | Why            |
| ------------------------ | ---------------------- | -------------- |
| `NotificationService.ts` | `notification-stub.ts` | `-stub` suffix |
| `AnalyticsService.ts`    | `analytics-stub.ts`    | `-stub` suffix |
| `WebSocketService.ts`    | `websocket-stub.ts`    | `-stub` suffix |

**Rules:**

- Never create two files in the same directory that differ only by case
- Use `-stub` or `-mock` suffix for placeholder/stub files
- CI passing on Linux does NOT guarantee macOS safety

**Detection:**

```bash
# Find case-colliding filenames in the same directory
find packages/ -type f -name "*.ts" | while read f; do
  dir=$(dirname "$f")
  base=$(basename "$f" | tr '[:upper:]' '[:lower:]')
  count=$(ls "$dir" | tr '[:upper:]' '[:lower:]' | grep -c "^${base}$")
  [ "$count" -gt 1 ] && echo "COLLISION: $f"
done
```

---

## 56. Spread Operator in Logger Metadata Is Unsafe

**Recurrence:** 1 P3 (PR #103). `logger.info('msg', { event, ...properties })` lets callers shadow Winston built-in keys (`level`, `message`, `timestamp`, `service`).

### The Problem

Winston (and most structured loggers) use flat metadata objects. When caller-controlled data is spread into the root metadata, any key matching a Winston built-in silently overwrites it.

```typescript
// WRONG — caller properties can shadow Winston built-ins
function trackEvent(event: string, properties: Record<string, unknown>) {
  logger.info('Event tracked', { event, ...properties });
  // If properties = { message: 'hello', level: 'error' }
  // Winston sees level='error' and message='hello' — corrupted log entry
}

// RIGHT — nest caller data under a dedicated key
function trackEvent(event: string, properties: Record<string, unknown>) {
  logger.info('Event tracked', { event, properties });
  // Winston built-ins are safe; all caller data under 'properties'
}
```

### Winston Built-In Keys (Do Not Shadow)

- `level` — log severity
- `message` — log message text
- `timestamp` — ISO timestamp
- `service` — service name (if configured)
- `[Symbol.for('splat')]` — internal formatting

**Rules:**

- Never spread external/caller-controlled data into logger metadata root
- Always nest under a dedicated key: `{ event, properties }` or `{ event, data }`
- Applies to Winston, Pino, Bunyan — any logger with flat metadata

**Detection:**

```bash
grep -rn 'logger\.\(info\|warn\|error\|debug\).*\.\.\.' packages/ --include="*.ts"
```

Any spread in a logger call is suspect. Verify the spread source is not caller-controlled.

---

## 57. API Root Discovery Must List All Monitoring Endpoints

**Recurrence:** 1 P3 (PR #103, agent-native reviewer). `/api` root listed `/health` but omitted 5 other monitoring endpoints. Agents and automated tools cannot discover what is not listed.

### The Rule

Every endpoint registered in Express (especially monitoring/operational endpoints) must appear in the `/api` root discovery response. This is the machine-readable equivalent of API documentation.

### Standard Pattern

```typescript
// When adding new monitoring endpoints, update the discovery response
app.get('/api', (req, res) => {
  res.json({
    name: 'Sovren API',
    version: '1.0.0',
    endpoints: {
      // Monitoring (keep this section up to date)
      health: '/health',
      ready: '/ready',
      live: '/live',
      healthDetailed: '/health/detailed',
      metrics: '/metrics',
      metricsApi: '/api/v1/metrics',
      // Business endpoints
      auth: '/api/v1/auth',
      content: '/api/v1/content',
      // ... etc
    },
  });
});
```

### Checklist When Adding New Endpoints

- [ ] Endpoint registered in Express
- [ ] Endpoint added to `/api` root discovery response
- [ ] Endpoint documented in CLAUDE.md (if operational/monitoring)
- [ ] If authenticated, noted in discovery response or separate auth docs

**Detection:** Compare `app.get`/`router.get` registrations with keys in the `/api` discovery response. Script:

```bash
# List all registered routes
grep -rn "app\.\(get\|post\|put\|delete\)\|router\.\(get\|post\|put\|delete\)" packages/backend/src/ --include="*.ts" | grep -oP "'[^']+'" | sort -u
# Compare against the discovery object keys in app.ts
```

**When to apply:** Every new endpoint, especially monitoring/health/metrics endpoints that automated agents rely on for observability.

---

## 58. keepPreviousData Gate — Pagination Only, Not Filters

**Recurrence:** 1 P2 in Discovery MVP. Will recur in every search/filter/pagination feature.

### Problem

React Query's `keepPreviousData` (or `placeholderData: keepPreviousData`) applied unconditionally shows stale results when switching category/search filters. Users see old category data for 500ms+ while new results load.

### Standard Pattern: useRef to Track Page Changes

```tsx
const prevPageRef = useRef(page);
const isPageChange = prevPageRef.current !== page;
prevPageRef.current = page;

const { data } = useQuery({
  queryKey: ['items', { page, category, search }],
  queryFn: () => fetchItems({ page, category, search }),
  placeholderData: isPageChange ? keepPreviousData : undefined,
});
```

**Why?** `keepPreviousData` is a UX optimization for pagination (show page N-1 while N loads), but a UX degradation for filter changes where users expect immediate fresh results.

**Checklist:**

- [ ] `keepPreviousData` gated by `useRef` comparison (not unconditional)
- [ ] Filter changes (category, search, sort) get `undefined` placeholder
- [ ] Page changes get `keepPreviousData` placeholder
- [ ] `isFetching` indicator shown during background refetch

**Detection:** `grep -rn "keepPreviousData" packages/frontend/` — verify each usage compares previous vs current change type.

---

## 59. COALESCE Nullable Columns at VIEW Level

**Recurrence:** 1 P2 in Discovery MVP. Will recur with every new VIEW joining nullable columns.

### Problem

DB columns (bio, categories, display_name, nip05_verified) can be NULL but TypeScript interfaces declare them non-nullable. Runtime crashes on `.toLocaleString()`, `.charAt()`, `.map()` when NULL returned.

### Standard Pattern: COALESCE in SQL VIEW

```sql
CREATE OR REPLACE VIEW my_view AS
SELECT
  COALESCE(t.text_col, '') AS text_col,           -- string default
  COALESCE(t.array_col, ARRAY[]::text[]) AS arr,  -- empty array default
  COALESCE(t.bool_col, false) AS bool_col,         -- boolean default
  COALESCE(t.int_col, 0) AS int_col,              -- numeric default
  COALESCE(t.name, t.fallback_name, 'Anonymous') AS name, -- cascade fallback
FROM my_table t;
```

**Why at the VIEW level?** One COALESCE in SQL prevents N null checks scattered across TypeScript. Guarantees type definitions match runtime reality.

**Checklist:**

- [ ] Every nullable column in JOIN has COALESCE with sensible default
- [ ] String columns → `''`, arrays → `ARRAY[]::type[]`, booleans → `false`, numbers → `0`
- [ ] Cascade fallbacks for display names: `COALESCE(display_name, username, 'Anonymous')`
- [ ] TypeScript interface matches COALESCE guarantees (non-nullable types)

**Detection:** Compare VIEW columns against source table nullable columns. `\d+ view_name` in psql shows column types.

---

## 60. pg_trgm Indexes for ILIKE Full-Text Search

**Recurrence:** 1 P2 in Discovery MVP. Required for every ILIKE `%pattern%` search.

### Problem

ILIKE with leading wildcard (`%query`) is not B-tree indexable — forces sequential scan. 500ms+ on tables with 100K+ rows.

### Standard Pattern: GIN Trigram Indexes

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN indexes for ILIKE %pattern% searches
CREATE INDEX IF NOT EXISTS idx_users_display_name_trgm
  ON users USING gin (display_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_users_username_trgm
  ON users USING gin (username gin_trgm_ops);

-- B-tree for ORDER BY (sorting)
CREATE INDEX IF NOT EXISTS idx_creators_follower_count_desc
  ON creators (follower_count DESC);

-- GIN for array containment (@>)
CREATE INDEX IF NOT EXISTS idx_creator_profiles_categories_gin
  ON creator_profiles USING gin (categories);
```

**Index type selection:**

| Query Pattern       | Index Type    | Example                  |
| ------------------- | ------------- | ------------------------ |
| `ILIKE '%foo%'`     | GIN (pg_trgm) | `gin (col gin_trgm_ops)` |
| `= 'exact'`         | B-tree        | `btree (col)`            |
| `ORDER BY col DESC` | B-tree DESC   | `btree (col DESC)`       |
| `@> ARRAY['val']`   | GIN           | `gin (col)`              |

**Checklist:**

- [ ] `pg_trgm` extension enabled (`CREATE EXTENSION IF NOT EXISTS pg_trgm`)
- [ ] Every ILIKE column has GIN trigram index
- [ ] Every ORDER BY column has B-tree index (match sort direction)
- [ ] Array filter columns have GIN index
- [ ] Verify with `EXPLAIN ANALYZE` on production-size data

**Detection:** `grep -rn "ILIKE\|ilike" packages/backend/` — check each column has a corresponding trigram index in migrations.

---

## 61. Error Cause Sanitization — Log Internally, Throw Clean

**Recurrence:** 1 P2 in Discovery MVP. Common in every service that catches and re-throws.

### Problem

`throw new ServiceError('msg', { cause: error })` passes raw Error objects (with stack traces, file paths, internal details) that can leak to API consumers via serialization.

### Standard Pattern: Log Full, Throw Clean

```typescript
try {
  const result = await db.from('table').select('*');
  if (result.error) throw result.error;
  return result.data;
} catch (error) {
  // Log full error internally (for debugging)
  logger.error('Operation failed', { error: String(error) });
  // Throw clean error to consumer (no cause, no internals)
  throw new ServiceError('Operation failed');
}
```

**Why not `{ cause: error }`?**

- Error objects contain stack traces with file paths
- `JSON.stringify(error)` may include internal state
- Express error handlers may serialize the entire cause chain
- The `cause` property is for programmatic error chaining within a service, not across API boundaries

**Checklist:**

- [ ] No `{ cause: error }` in errors thrown from route handlers
- [ ] `logger.error()` captures full error before throwing
- [ ] ServiceError message is user-safe (no internal details)
- [ ] Stack traces never appear in API response bodies

**Detection:** `grep -rn "new ServiceError.*cause\|new Error.*cause" packages/backend/src/routes/` — verify no raw errors passed as cause in route-level throws.

---

## 62. Per-Package tsc in Monorepos — Never Root-Only

**Recurrence:** 1 P1 (2,610 phantom errors from root tsc). Path aliases differ per package.

### Pattern

```yaml
# CI: run tsc per-package, not from root
- name: TypeScript (per-package)
  run: |
    for PKG in backend frontend; do
      npx tsc -p "packages/$PKG/tsconfig.json" --noEmit
    done
```

**Why root tsc fails:** Root tsconfig defines `@sovren/*` paths. Backend uses `@/*`. Frontend uses `@shared/*`. Running tsc from root resolves against root paths → 455 false TS2307 errors.

**Checklist:**

- [ ] CI runs `tsc -p packages/{pkg}/tsconfig.json` per package
- [ ] Root tsconfig only has workspace-level paths
- [ ] Per-package tsconfigs have their own `baseUrl` and `paths`
- [ ] ESLint parser uses per-package tsconfig via `project` option

**Detection:** `npx tsc --noEmit 2>&1 | grep TS2307 | head -5` — if you see path alias errors, you're running from wrong tsconfig.

---

## 63. ESLint Rule Severity Matrix for Legacy Codebases

**Recurrence:** 1 P1 (6,636 violations from inflated rules). Every inherited codebase has this.

### Pattern

| Tier           | Action                    | Examples                                           |
| -------------- | ------------------------- | -------------------------------------------------- |
| Keep ERROR     | Legitimate safety         | `no-debugger`, `prefer-const`, `no-var`            |
| Downgrade WARN | Fix incrementally         | `no-case-declarations`, `no-redeclare`             |
| Turn OFF       | Noisy / handled elsewhere | `no-explicit-any`, `no-console`                    |
| Replace        | Better plugin exists      | `no-unused-vars` → `unused-imports/no-unused-vars` |

```javascript
// eslint.config.js — unused-imports replaces no-unused-vars
plugins: { 'unused-imports': unusedImports },
rules: {
  'no-unused-vars': 'off',
  '@typescript-eslint/no-unused-vars': 'off',
  'unused-imports/no-unused-imports': 'error',
  'unused-imports/no-unused-vars': ['warn', {
    varsIgnorePattern: '^_', argsIgnorePattern: '^_'
  }],
}
```

**Checklist:**

- [ ] Classify every rule as keep/downgrade/off/replace
- [ ] Run `npx eslint . --fix` after config change (auto-removes unused imports)
- [ ] Verify 0 errors remain (warnings OK for incremental fix)
- [ ] Document disabled rules with owner and deadline

**Detection:** `npx eslint . 2>&1 | grep "error" | wc -l` — should be 0. Warnings tracked separately.

---

## 64. Advisory CI Jobs for Missing Infrastructure

**Recurrence:** E2E tests need Supabase secrets, integration tests need Docker. Blocking CI on unavailable infrastructure creates permanent red builds.

### Pattern

```yaml
e2e:
  name: E2E Tests
  continue-on-error: true # Advisory until secrets configured
  # TODO: Remove continue-on-error after Supabase test secrets added
```

**When to use:**

- Job needs secrets not yet in CI (Supabase, Stripe, etc.)
- Job needs infrastructure not available (Docker, GPUs)
- Job is informational, not a quality gate

**When NOT to use:**

- Job is a required merge check (lint, typecheck, unit tests)
- Job validates code correctness (not infrastructure)

**Checklist:**

- [ ] `continue-on-error: true` added with TODO comment
- [ ] Job NOT in `test-gate` blocking list
- [ ] Tracking issue for missing infrastructure
- [ ] Remove `continue-on-error` once infra available

---

## 65. Satellite Workflow Deprecation — Don't Delete, Disable

**Recurrence:** 13 redundant workflows accumulated. Deleting loses history; deprecating preserves it.

### Pattern

```yaml
# .github/workflows/old-workflow.yml
name: Old Workflow (DEPRECATED)
on:
  workflow_dispatch:
    # DEPRECATED — consolidated into ci.yml
    # Manual-only trigger preserves history while preventing automatic runs
```

**Checklist:**

- [ ] Changed trigger to `workflow_dispatch` only
- [ ] Added DEPRECATED label to workflow name
- [ ] Added comment explaining consolidation target
- [ ] Updated CI docs to reference consolidated workflow

---

## 66. Rollup treeshake moduleSideEffects:false Empties All JS Chunks

**Recurrence:** 1 P1 — production build produced blank white page for 5+ PRs before diagnosis.

### Problem

```typescript
// vite.config.ts — BROKEN
rollupOptions: {
  treeshake: {
    moduleSideEffects: false,    // Strips EVERYTHING
    propertyReadSideEffects: false,
    unknownGlobalSideEffects: false,
  },
}
```

All JS chunks become 1 byte (empty). CSS still generates. Build reports success. App is a blank page.

### Fix

```typescript
// vite.config.ts — FIXED
rollupOptions: {
  treeshake: true,  // Use Rollup defaults
}
```

### Detection

```bash
# Check for the dangerous setting
grep -r "moduleSideEffects.*false" vite.config.* rollup.config.*
# Check for empty chunks after build
find dist/assets/js -name '*.js' -size -10c | wc -l
```

### Why It's Invisible

Local dev server (`npm run dev`) does NOT apply Rollup treeshaking. Tests against dev server pass. Only production builds (`npm run build` + `vite preview`) are affected. Always test E2E against production build.

---

## 67. Vite VITE\_\* Env Vars Must Be Present at Build Time

**Recurrence:** 1 P1 — CI E2E tests failed because `VITE_SUPABASE_URL` was only in the E2E step, not the Build step.

### Problem

Vite statically replaces `import.meta.env.VITE_*` at **build time** via string substitution. If the variable isn't set when `npm run build` runs, it becomes `undefined` in the bundle.

```yaml
# BROKEN — vars only in E2E step
- name: Build frontend
  run: npm run build
  env:
    NODE_ENV: production
    # Missing: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY

- name: Run E2E tests
  env:
    VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }} # Too late!
```

### Fix

```yaml
# FIXED — vars in Build step
- name: Build frontend
  run: npm run build
  env:
    NODE_ENV: production
    VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
    VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
```

### Rule

Any `VITE_*` variable used via `import.meta.env.*` must be in the CI **Build** step env, not just the runtime/test step. This is fundamentally different from Node.js `process.env` which is read at runtime.

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

| Issue You're Seeing                             | Pattern # | File                 |
| ----------------------------------------------- | --------- | -------------------- |
| Race condition on capacity/count                | 1a-1c     | critical-patterns.md |
| User can access others' data                    | 2         | critical-patterns.md |
| Query loads too much into memory                | 3         | critical-patterns.md |
| Two inserts, second might fail                  | 4         | critical-patterns.md |
| Payment data could be lost                      | 5         | critical-patterns.md |
| URL from user input fetched server-side         | 6a-6c     | critical-patterns.md |
| DNS TOCTOU between validate and fetch           | 6b        | critical-patterns.md |
| IPv6 encoding bypasses SSRF check               | 6c        | critical-patterns.md |
| Can delete a paid/active entity                 | 7         | critical-patterns.md |
| Button fires duplicate mutations                | 1         | common-solutions.md  |
| Map grows without bound                         | 2         | common-solutions.md  |
| New env var not validated                       | 3         | common-solutions.md  |
| Inconsistent error responses                    | 4         | common-solutions.md  |
| snake_case in API response                      | 5         | common-solutions.md  |
| Worker running for stub function                | 6         | common-solutions.md  |
| Tests break after service change                | 7         | common-solutions.md  |
| New routes missing rate limit                   | 8         | common-solutions.md  |
| Named route not matching                        | 9         | common-solutions.md  |
| `db: any` in constructor                        | 10        | common-solutions.md  |
| Vitest OOM / worker crashes                     | 11        | common-solutions.md  |
| `git diff --cached` empty at push               | 12        | common-solutions.md  |
| Batch op fails on single rejection              | 13        | common-solutions.md  |
| Same utility in 3+ files                        | 14        | common-solutions.md  |
| Hook loops agents on pre-existing issues        | 15        | common-solutions.md  |
| Security file changed, no tests ran             | 16        | common-solutions.md  |
| Test framework migrated, hooks broken           | 17        | common-solutions.md  |
| Hook error suppressed, failures hidden          | 18        | common-solutions.md  |
| grep breaks on macOS / portability issue        | 19        | common-solutions.md  |
| `forEach(async` does nothing / returns early    | 20        | common-solutions.md  |
| Need to cancel BullMQ job without DB lookup     | 21        | common-solutions.md  |
| Promise.race leaks setTimeout handle            | 22        | common-solutions.md  |
| Duplicate items cause redundant I/O             | 23        | common-solutions.md  |
| Bare `Error` in service method → 500            | 24        | common-solutions.md  |
| DB insert + queue enqueue partial failure       | 4c        | critical-patterns.md |
| Todos from prior sprint, many may be stale      | 25        | common-solutions.md  |
| E2E tests mock API via `page.route()`           | 26        | common-solutions.md  |
| New test type exists locally but not in CI      | 8a-8c     | critical-patterns.md |
| NOSTR verifyEvent with `id: ''`                 | 9a-9b     | critical-patterns.md |
| Fixed method but standalone utility broken      | 28        | common-solutions.md  |
| Silent fallback with no logging                 | 29        | common-solutions.md  |
| String duplicated across packages               | 10a       | critical-patterns.md |
| Lazy init with no logging                       | 10b       | critical-patterns.md |
| New spec silently excluded from test run        | 30        | common-solutions.md  |
| Type guard uses `any` instead of `unknown`      | 31        | common-solutions.md  |
| Agent can't create new artifact from CLAUDE.md  | 32        | common-solutions.md  |
| WebSocket mock silently ignored by MSW v2       | 33        | common-solutions.md  |
| React effects don't fire with fake timers       | 34        | common-solutions.md  |
| Error-state test times out (React Query)        | 35        | common-solutions.md  |
| vi.mock factory: variable before init           | 36        | common-solutions.md  |
| React 19 hoisted after npm update               | 37        | common-solutions.md  |
| Action bumped, notifications silently fail      | 38        | common-solutions.md  |
| Lockfile keeps stale workspace resolutions      | 39        | common-solutions.md  |
| Migrated dead code nobody imports               | 40        | common-solutions.md  |
| `resetAllMocks` wipes mock implementations      | 41        | common-solutions.md  |
| Nested test data leaks between tests            | 42        | common-solutions.md  |
| ESM default export mock returns undefined       | 43        | common-solutions.md  |
| Fire-and-forget assertion fails intermittently  | 44        | common-solutions.md  |
| Class mock methods undefined after reset        | 45        | common-solutions.md  |
| Service constructor captures undefined fetch    | 46        | common-solutions.md  |
| Stale branches, stashes, orphaned PRs pile up   | 47        | common-solutions.md  |
| Branch not deleted after squash-merge to main   | 48        | common-solutions.md  |
| New tool added, untracked artifacts in tree     | 49        | common-solutions.md  |
| >10 vi.fn() stubs for one service interface     | 50        | common-solutions.md  |
| `as any` for private field in test helper       | 51        | common-solutions.md  |
| Timer handles leaked after test run             | 52        | common-solutions.md  |
| >5 `as any` casts in test factory consumers     | 53        | common-solutions.md  |
| Re-export used locally but not in scope         | 54        | common-solutions.md  |
| Stub file name-collides on case-insensitive FS  | 55        | common-solutions.md  |
| Spread in logger metadata shadows built-ins     | 56        | common-solutions.md  |
| Monitoring endpoint missing from `/api` root    | 57        | common-solutions.md  |
| keepPreviousData shows stale filter results     | 58        | common-solutions.md  |
| Nullable DB col crashes TS at runtime           | 59        | common-solutions.md  |
| ILIKE `%query%` causes sequential scan          | 60        | common-solutions.md  |
| ServiceError cause leaks stack trace to client  | 61        | common-solutions.md  |
| PostgREST filter injection via metacharacters   | 11        | critical-patterns.md |
| VIEW exposes admin/inactive users               | 12        | critical-patterns.md |
| Root tsc generates phantom path alias errors    | 62        | common-solutions.md  |
| ESLint has 1000+ violations, all noise          | 63        | common-solutions.md  |
| CI job needs missing infra (secrets/Docker)     | 64        | common-solutions.md  |
| Redundant workflows accumulating                | 65        | common-solutions.md  |
| Production build JS chunks are empty (1 byte)   | 66        | common-solutions.md  |
| VITE\_\* env var undefined in production bundle | 67        | common-solutions.md  |
