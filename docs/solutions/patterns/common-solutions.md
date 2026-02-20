---
title: Common Solutions — Reusable Fixes for Recurring Issues
date: '2026-02-19'
category: patterns
purpose: Consolidated solutions for P2/P3 patterns that recur across sprints. Prevents re-invention.
usage: Reference when implementing features. Check if a solution already exists here before writing new code.
---

# Common Solutions

Reusable solutions extracted from 162 P2/P3 findings across 8 sprints. These are not critical blockers but patterns that waste time when re-discovered. **Check here before implementing anything in these categories.**

---

## 1. Frontend Double-Submit Prevention

**Recurrence:** 4 P1s + 3 P2s across 3 sprints. Every new financial button misses this.

### Standard Pattern: useRef + disabled + aria-busy

```tsx
const [pendingId, setPendingId] = useState<string | null>(null);
const inFlightRef = useRef(false);

const handleAction = (id: string) => {
  if (inFlightRef.current) return;       // Synchronous guard (before re-render)
  inFlightRef.current = true;
  setPendingId(id);
  mutation.mutate({ id }, {
    onSettled: () => {
      inFlightRef.current = false;
      setPendingId(null);
    },
  });
};

// JSX — all three attributes required
<button
  onClick={() => handleAction(item.id)}
  disabled={pendingId !== null || mutation.isPending}
  aria-busy={pendingId === item.id}
  className="disabled:opacity-50 disabled:cursor-not-allowed"
>
  {pendingId === item.id ? 'Processing...' : 'Submit'}
</button>
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
    private readonly ttlMs: number = 300_000,      // 5 min default
    private readonly maxSize: number = 10_000,
    cleanupIntervalMs: number = 60_000
  ) {
    this.cleanupInterval = setInterval(() => this.cleanup(), cleanupIntervalMs);
  }

  get(key: K): V | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expires) { this.cache.delete(key); return undefined; }
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

  delete(key: K): boolean { return this.cache.delete(key); }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (now > entry.expires) this.cache.delete(key);
    }
  }

  destroy(): void { clearInterval(this.cleanupInterval); }
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
throw new NotFoundError('Invoice not found');      // 404
throw new ConflictError('Already claimed');         // 409
throw new AuthorizationError('Not authorized');     // 403
throw new ValidationError('Invalid input');         // 400
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
function createMockChain(terminalData: any = []) {
  const chain: any = {};
  // Chainable methods return `chain`
  ['from', 'select', 'insert', 'update', 'delete',
   'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'is',
   'order', 'not', 'or', 'filter', 'match',
  ].forEach(method => { chain[method] = jest.fn().mockReturnValue(chain); });

  // Terminal methods return data
  chain.single = jest.fn().mockResolvedValue({ data: terminalData, error: null });
  chain.range = jest.fn().mockResolvedValue({ data: terminalData, error: null });
  chain.then = undefined; // Prevent Promise detection

  // For count queries
  chain.select = jest.fn().mockImplementation((_cols: string, opts?: any) => {
    if (opts?.count === 'exact') {
      return { ...chain, data: null, count: terminalData.length ?? 0, error: null };
    }
    return chain;
  });

  return chain;
}

// Usage in test
const mockDb = { from: jest.fn().mockReturnValue(createMockChain(mockData)) };
```

### Pagination Mock (for paginated accumulation)

```typescript
function createPaginatedMock(allRows: any[], pageSize = 500) {
  let callCount = 0;
  const chain = createMockChain();
  chain.range = jest.fn().mockImplementation((start: number, end: number) => {
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

| Issue You're Seeing | Pattern # | File |
|---------------------|-----------|------|
| Race condition on capacity/count | 1a-1c | critical-patterns.md |
| User can access others' data | 2 | critical-patterns.md |
| Query loads too much into memory | 3 | critical-patterns.md |
| Two inserts, second might fail | 4 | critical-patterns.md |
| Payment data could be lost | 5 | critical-patterns.md |
| URL from user input fetched server-side | 6 | critical-patterns.md |
| Can delete a paid/active entity | 7 | critical-patterns.md |
| Button fires duplicate mutations | 1 | common-solutions.md |
| Map grows without bound | 2 | common-solutions.md |
| New env var not validated | 3 | common-solutions.md |
| Inconsistent error responses | 4 | common-solutions.md |
| snake_case in API response | 5 | common-solutions.md |
| Worker running for stub function | 6 | common-solutions.md |
| Tests break after service change | 7 | common-solutions.md |
| New routes missing rate limit | 8 | common-solutions.md |
| Named route not matching | 9 | common-solutions.md |
| `db: any` in constructor | 10 | common-solutions.md |
