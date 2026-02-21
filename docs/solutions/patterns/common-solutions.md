---
title: Common Solutions — Reusable Fixes for Recurring Issues
date: '2026-02-21'
category: patterns
purpose: Consolidated solutions for P2/P3 patterns that recur across sprints. Prevents re-invention.
usage: Reference when implementing features. Check if a solution already exists here before writing new code.
---

# Common Solutions

Reusable solutions extracted from 180+ P2/P3 findings across 11 sprints. These are not critical blockers but patterns that waste time when re-discovered. **Check here before implementing anything in these categories.**

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

**When to use:** Batch notifications, multi-relay NOSTR publishing, bulk imports/exports, webhook fanout -- any operation where partial success is acceptable.

**When NOT to use:** Financial transactions (use atomic patterns from critical-patterns.md), operations where partial completion leaves inconsistent state, sequential operations where each step depends on the previous.

**Detection:** Grep for `Promise.all(` where the mapped function can independently fail (e.g., network calls, DB writes to separate rows). Replace with `Promise.allSettled(`.

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

| Issue You're Seeing                      | Pattern # | File                 |
| ---------------------------------------- | --------- | -------------------- |
| Race condition on capacity/count         | 1a-1c     | critical-patterns.md |
| User can access others' data             | 2         | critical-patterns.md |
| Query loads too much into memory         | 3         | critical-patterns.md |
| Two inserts, second might fail           | 4         | critical-patterns.md |
| Payment data could be lost               | 5         | critical-patterns.md |
| URL from user input fetched server-side  | 6         | critical-patterns.md |
| Can delete a paid/active entity          | 7         | critical-patterns.md |
| Button fires duplicate mutations         | 1         | common-solutions.md  |
| Map grows without bound                  | 2         | common-solutions.md  |
| New env var not validated                | 3         | common-solutions.md  |
| Inconsistent error responses             | 4         | common-solutions.md  |
| snake_case in API response               | 5         | common-solutions.md  |
| Worker running for stub function         | 6         | common-solutions.md  |
| Tests break after service change         | 7         | common-solutions.md  |
| New routes missing rate limit            | 8         | common-solutions.md  |
| Named route not matching                 | 9         | common-solutions.md  |
| `db: any` in constructor                 | 10        | common-solutions.md  |
| Vitest OOM / worker crashes              | 11        | common-solutions.md  |
| `git diff --cached` empty at push        | 12        | common-solutions.md  |
| Batch op fails on single rejection       | 13        | common-solutions.md  |
| Same utility in 3+ files                 | 14        | common-solutions.md  |
| Hook loops agents on pre-existing issues | 15        | common-solutions.md  |
| Security file changed, no tests ran      | 16        | common-solutions.md  |
| Test framework migrated, hooks broken    | 17        | common-solutions.md  |
| Hook error suppressed, failures hidden   | 18        | common-solutions.md  |
