# P1 Remediation Plan Round 2 - PR #73 Full Code Review Findings

**Date**: 2026-02-13
**Author**: Architect Agent (Phase 0)
**Status**: Ready for Implementation
**Executor**: Backend Agent (Phase 1)
**Scope**: 7 P1 findings from todos/062-068

---

## Executive Summary

7 P1 critical findings from the full PR #73 code review require remediation. This plan provides exact code changes, dependency ordering, risk assessment, and test requirements for each fix. Fixes are ordered by dependency and risk: security-critical first, then memory/leak fixes, then type safety, then configuration.

---

## Dependency Graph & Execution Order

```
Fix Order:
  1. #062 - Auth Bypass Test Mock (SECURITY - blocks nothing, no deps)
  2. #064 - Health Check WebSocket Leak (blocks #065)
  3. #065 - setMaxListeners(0) (depends on #064 being fixed first)
  4. #063 - Unbounded Lightning Cache Maps (independent)
  5. #066 - sanitizeObject WeakSet False Positive (independent)
  6. #067 - Express.Request.user Conflicting Types (independent)
  7. #068 - .env Plaintext Secrets (independent, audit-only)
```

**Rationale**: #062 is the highest-severity security fix (auth bypass) and should be done first. #064 must precede #065 because fixing the WebSocket leak eliminates one source of excess listeners before we restore the MaxListeners warning. All other fixes are independent and can be done in any order.

---

## Fix 1: Auth Bypass Test Mock (#062)

**Priority**: P1 - SECURITY CRITICAL
**Risk**: Low (removing code, not adding)
**Estimated Lines Changed**: ~25 lines removed across 2 route files, ~40 lines modified in test file
**Dependency**: None

### Problem

`packages/backend/src/routes/auth.ts` lines 64-84 contain a mock auth bypass activated by `NODE_ENV === 'test'` + signature containing `'mock'`. This grants any pubkey any role (including admin) with a real JWT. The same pattern exists in `packages/backend/src/routes/enhanced-auth.ts` lines 121-137.

### Fix Approach

**Step 1**: Remove the mock block from `packages/backend/src/routes/auth.ts`

Delete lines 64-84 (the entire `if (process.env.NODE_ENV === 'test' ...)` block and its comment on line 64):
```typescript
// DELETE lines 64-84:
    // For testing purposes, mock the signature verification
    if (process.env.NODE_ENV === 'test' && req.body.signature?.includes('mock')) {
      // Mock successful verification for tests
      const token = await nostrAuth.generateJWT(
        validatedData.nostr_pubkey,
        validatedData.role
      );

      return res.status(200).json({
        success: true,
        data: {
          token,
          user: {
            nostr_pubkey: validatedData.nostr_pubkey,
            role: validatedData.role,
            signature_verified: true,
          },
          expires_in: '24h',
        },
      });
    }
```

After deletion, line 64 should be the `// Real NOSTR signature verification` comment (previously line 86).

**Step 2**: Remove the same mock block from `packages/backend/src/routes/enhanced-auth.ts`

Delete lines 121-137 (the matching `if (process.env.NODE_ENV === 'test' ...)` block and its comment on line 121).

**Step 3**: Update test file `packages/backend/src/routes/__tests__/auth.test.ts`

The existing tests depend on the mock bypass (sending `signature: 'mock_valid_signature'`). These tests need to mock `nostrAuth` at the service level instead. The approach:

Add `jest.mock` at the top of the test file, BEFORE imports:

```typescript
jest.mock('@/services/nostr-auth', () => {
  const testJWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-jwt-token';
  const refreshedJWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.refreshed-jwt-token';
  const basePubkey = '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

  return {
    nostrAuth: {
      generateChallenge: jest.fn().mockResolvedValue({
        challenge: 'a'.repeat(64),
        timestamp: Date.now(),
        expires_at: Date.now() + 900000,
      }),
      verifySignature: jest.fn().mockResolvedValue({
        valid: true,
        pubkey: basePubkey,
      }),
      generateJWT: jest.fn().mockResolvedValue(testJWT),
      verifyJWT: jest.fn().mockResolvedValue({
        valid: true,
        payload: {
          nostr_pubkey: basePubkey,
          role: 'supporter',
          signature_verified: true,
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 86400,
        },
      }),
      refreshJWT: jest.fn().mockResolvedValue({
        success: true,
        newToken: refreshedJWT,
      }),
      getStats: jest.fn().mockReturnValue({
        activeChallenges: 1,
      }),
    },
  };
});
```

For the admin stats test (around line 268), add per-test mock overrides:

```typescript
it('should return authentication statistics for admins', async () => {
  const { nostrAuth } = require('@/services/nostr-auth');
  const adminPubkey = 'abcd567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

  // Override for admin JWT generation
  nostrAuth.verifySignature.mockResolvedValueOnce({ valid: true, pubkey: adminPubkey });
  nostrAuth.generateJWT.mockResolvedValueOnce('admin-jwt-token');
  nostrAuth.verifyJWT.mockResolvedValueOnce({
    valid: true,
    payload: {
      nostr_pubkey: adminPubkey,
      role: 'admin',
      signature_verified: true,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 86400,
    },
  });
  // ... rest of test stays the same
});
```

For the "expired challenge" test (line 116-132): override `verifySignature` to return `{ valid: false }`:

```typescript
it('should handle expired challenges', async () => {
  const { nostrAuth } = require('@/services/nostr-auth');
  nostrAuth.verifySignature.mockResolvedValueOnce({ valid: false, error: 'Challenge expired' });
  // ... rest stays the same, but remove 'mock' from signature
});
```

Remove all `'mock'` prefixed signatures from test data -- use any string.

### Test Requirements

- All existing auth.test.ts tests must pass with mocked service layer
- Add a new test: verify that `NODE_ENV=test` with `signature: 'mock...'` does NOT bypass authentication
- Verify admin role cannot be self-assigned without proper JWT verification

---

## Fix 2: Health Check WebSocket Leak (#064)

**Priority**: P1 - RESOURCE LEAK
**Risk**: Low
**Estimated Lines Changed**: ~5 lines modified
**Dependency**: None (but must be done BEFORE #065)

### Problem

`packages/backend/src/routes/health.ts` `checkNostr()` function (lines 295-351). The original finding states WebSockets are never closed.

### Current State (Re-Analysis)

The code at lines 313-331 ALREADY has a `try/finally` with `ws.close()`:

```typescript
const ws = new WebSocket(relay);
try {
  await new Promise((resolve, reject) => { ... });
} finally {
  ws.close();
}
```

The `finally` block IS present. However, there is a gap: event handlers (`onopen`, `onerror`) remain registered after close, which can cause stale callbacks or keep the WS object from being GC'd.

### Fix Approach

**In `packages/backend/src/routes/health.ts`, function `checkNostr()`, lines 311-331**:

Replace the existing `try/finally` block content:

```typescript
// CURRENT (lines 313-331):
    try {
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 5000);

        ws.onopen = () => {
          clearTimeout(timeout);
          resolve(void 0);
        };

        ws.onerror = (error) => {
          clearTimeout(timeout);
          reject(error);
        };
      });
    } finally {
      ws.close();
    }

// REPLACE WITH:
    try {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 5000);

        ws.onopen = () => {
          clearTimeout(timeout);
          resolve();
        };

        ws.onerror = (error) => {
          clearTimeout(timeout);
          reject(error);
        };
      });
    } finally {
      ws.onopen = null;
      ws.onerror = null;
      ws.onclose = null;
      ws.onmessage = null;
      ws.close();
    }
```

Key changes:
1. Null out all event handlers before `ws.close()` to prevent stale callbacks
2. Change `resolve(void 0)` to `resolve()` (cleaner)
3. Type the Promise as `Promise<void>`

### Test Requirements

- Verify `/health/detailed` endpoint returns NOSTR relay status correctly
- Verify no connection accumulation under repeated calls (manual test)

---

## Fix 3: setMaxListeners(0) Masks Leaks (#065)

**Priority**: P1 - RELIABILITY
**Risk**: Medium (may surface existing warnings during startup)
**Estimated Lines Changed**: ~3 lines modified
**Dependency**: Fix #064 should be applied first

### Problem

`packages/backend/src/server.ts` line 24: `process.setMaxListeners(0)` disables Node.js EventEmitter leak detection globally.

### Fix Approach

**In `packages/backend/src/server.ts`, line 24**:

Replace:
```typescript
// 🔧 Process Configuration
// WHY: Prevent memory leaks and handle unhandled Promise rejections
process.setMaxListeners(0);
```

With:
```typescript
// Process listener limit: set above known listener count (~15)
// to detect genuine leaks without false positives during normal operation.
process.setMaxListeners(25);
```

**Listener count analysis**: The server registers ~13-15 process listeners:
- `uncaughtException` (1)
- `unhandledRejection` (1)
- `SIGTERM` (1)
- `SIGINT` (1)
- `SIGBREAK` (conditional, 0-1)
- Lightning service event handlers (5-6 via `setupLightningEventHandlers`)
- Receipt service event handlers (3 via `setupReceiptEventHandlers`)

A limit of 25 provides headroom without masking genuine leaks.

### Test Requirements

- Start the server and verify no `MaxListenersExceededWarning` during normal startup
- If warnings appear, count actual process listeners and either increase limit or fix the underlying excess

---

## Fix 4: Unbounded Lightning Cache Maps (#063)

**Priority**: P1 - MEMORY LEAK / OOM RISK
**Risk**: Low
**Estimated Lines Changed**: ~80 lines new (TTLCache utility), ~20 lines modified per service
**Dependency**: None

### Problem

Three `Map` objects grow without bound:
1. `lightning-payment-service.ts` line 118: `invoiceCache: Map<string, LightningInvoice>`
2. `lightning-payment-service.ts` line 117: `paymentMonitors: Map<string, NodeJS.Timeout>` (actually self-cleaning via 1-hour timeout)
3. `lightning-service.ts` line 151: `invoiceCache = new Map<string, LightningInvoice>()`
4. `lightning-service.ts` line 152: `paymentCache = new Map<string, LightningPayment>()`

### Fix Approach

**Step 1**: Create `packages/backend/src/utils/ttl-cache.ts`

```typescript
/**
 * Simple bounded Map with TTL eviction.
 * Entries expire after ttlMs and the map never exceeds maxSize.
 * On overflow, the oldest entry is evicted (FIFO).
 */
export class TTLCache<K, V> {
  private map = new Map<K, { value: V; expiresAt: number }>();
  private maxSize: number;
  private ttlMs: number;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(opts: { maxSize: number; ttlMs: number; cleanupIntervalMs?: number }) {
    this.maxSize = opts.maxSize;
    this.ttlMs = opts.ttlMs;

    const cleanupMs = opts.cleanupIntervalMs ?? Math.min(opts.ttlMs, 60_000);
    this.cleanupInterval = setInterval(() => this.evictExpired(), cleanupMs);
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  get(key: K): V | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.map.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: K, value: V): void {
    if (this.map.size >= this.maxSize && !this.map.has(key)) {
      const firstKey = this.map.keys().next().value;
      if (firstKey !== undefined) this.map.delete(firstKey);
    }
    this.map.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  has(key: K): boolean {
    return this.get(key) !== undefined;
  }

  delete(key: K): boolean {
    return this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
  }

  get size(): number {
    return this.map.size;
  }

  values(): V[] {
    const now = Date.now();
    const result: V[] = [];
    for (const [key, entry] of this.map) {
      if (now > entry.expiresAt) {
        this.map.delete(key);
      } else {
        result.push(entry.value);
      }
    }
    return result;
  }

  private evictExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.map) {
      if (now > entry.expiresAt) {
        this.map.delete(key);
      }
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.map.clear();
  }
}
```

**Step 2**: Update `packages/backend/src/services/lightning-payment-service.ts`

Add import at top:
```typescript
import { TTLCache } from '../utils/ttl-cache';
```

Change type declarations (lines 117-118):
```typescript
// BEFORE:
private paymentMonitors: Map<string, NodeJS.Timeout>;
private invoiceCache: Map<string, LightningInvoice>;

// AFTER:
private paymentMonitors: Map<string, NodeJS.Timeout>; // Self-cleaning via 1hr timeout in startPaymentMonitoring
private invoiceCache: TTLCache<string, LightningInvoice>;
```

Change constructor (lines 128-129):
```typescript
// BEFORE:
this.paymentMonitors = new Map();
this.invoiceCache = new Map();

// AFTER:
this.paymentMonitors = new Map();
this.invoiceCache = new TTLCache({ maxSize: 10_000, ttlMs: 30 * 60 * 1000 }); // 30 min TTL, 10k max
```

Change `shutdown()` method (line 831):
```typescript
// BEFORE:
this.invoiceCache.clear();
// AFTER:
this.invoiceCache.destroy();
```

**Step 3**: Update `packages/backend/src/services/lightning-service.ts`

Add import at top:
```typescript
import { TTLCache } from '../utils/ttl-cache';
```

Change declarations (lines 151-152):
```typescript
// BEFORE:
private invoiceCache = new Map<string, LightningInvoice>();
private paymentCache = new Map<string, LightningPayment>();

// AFTER:
private invoiceCache = new TTLCache<string, LightningInvoice>({ maxSize: 10_000, ttlMs: 60 * 60 * 1000 }); // 1hr TTL
private paymentCache = new TTLCache<string, LightningPayment>({ maxSize: 50_000, ttlMs: 24 * 60 * 60 * 1000 }); // 24hr TTL
```

Update `Array.from(this.xxxCache.values())` calls to `this.xxxCache.values()`:
- `processWebhook()` line 536: `Array.from(this.invoiceCache.values())` -> `this.invoiceCache.values()`
- `getCreatorPayments()` line 603: `Array.from(this.paymentCache.values())` -> `this.paymentCache.values()`
- `getStats()` lines 652-653: same for both caches

### Test Requirements

- Unit tests for `TTLCache` class:
  - Entries expire after TTL
  - Max size is enforced (oldest evicted on overflow)
  - `get()` on expired entry returns `undefined`
  - `values()` excludes expired entries
  - `destroy()` cleans up interval
- Existing Lightning service tests should pass unchanged

---

## Fix 5: sanitizeObject WeakSet False Positive (#066)

**Priority**: P1 - DATA INTEGRITY
**Risk**: Low
**Estimated Lines Changed**: ~10 lines modified
**Dependency**: None

### Problem

`packages/backend/src/lib/sensitive-fields.ts` `sanitizeObject()` (lines 36-62) uses a `WeakSet` to track visited objects. Shared (non-circular) references are falsely treated as circular, silently dropping data.

### Fix Approach

**In `packages/backend/src/lib/sensitive-fields.ts`**:

Replace the entire `sanitizeObject` function (lines 36-62) with:

```typescript
export function sanitizeObject(
  data: Record<string, unknown>,
  depth: number = 0,
  seen: WeakMap<object, Record<string, unknown>> = new WeakMap()
): Record<string, unknown> {
  if (depth >= MAX_SANITIZE_DEPTH) return { _truncated: '[MAX_DEPTH]' };
  if (seen.has(data)) return seen.get(data)!;

  const sanitized: Record<string, unknown> = {};
  seen.set(data, sanitized);

  for (const [key, value] of Object.entries(data)) {
    if (isSensitiveKey(key)) {
      sanitized[key] = '[REDACTED]';
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map((item) =>
        item !== null && typeof item === 'object'
          ? sanitizeObject(item as Record<string, unknown>, depth + 1, seen)
          : item
      );
    } else if (value !== null && typeof value === 'object') {
      sanitized[key] = sanitizeObject(value as Record<string, unknown>, depth + 1, seen);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}
```

**Key changes from current code**:
1. Parameter type: `seen: WeakSet<object>` -> `seen: WeakMap<object, Record<string, unknown>>`
2. Registration: `seen.add(data)` -> `seen.set(data, sanitized)` (register BEFORE recursing)
3. Re-encounter: `return { _circular: '[CIRCULAR]' }` -> `return seen.get(data)!` (return cached sanitized copy)

**How this handles both cases**:
- **Circular** (`a.self = a`): Creates `sanitized`, registers `seen.set(a, sanitized)`, recurses on `a.self` -> finds `a` in `seen` -> returns `sanitized` (self-referencing object, correct)
- **Shared** (`{a: obj, b: obj}`): First encounter sanitizes `obj` and caches it. Second encounter returns the cached sanitized copy. Both fields contain correct data.

### Test Requirements

- Test: `{a: sharedObj, b: sharedObj}` -> both fields contain sanitized data (NOT `[CIRCULAR]`)
- Test: circular reference `a.self = a` -> no infinite recursion, `a.self` is the sanitized object
- Test: shared reference with sensitive keys is redacted in both locations
- Test: deep nesting beyond MAX_SANITIZE_DEPTH returns `[MAX_DEPTH]`

---

## Fix 6: Express.Request.user Conflicting Types (#067)

**Priority**: P1 - TYPE SAFETY
**Risk**: Low (TypeScript-only change, no runtime impact)
**Estimated Lines Changed**: ~15 lines modified across 3 files
**Dependency**: None

### Problem

Three files declare `Express.Request.user` via `declare global`:
1. `packages/backend/src/types/express.d.ts` line 5: `role?: string` (TOO WIDE)
2. `packages/backend/src/middleware/auth.ts` lines 6-18: `role?: 'creator' | 'supporter' | 'admin'` (correct but conflicts)
3. `packages/backend/src/middleware/nostr-auth.ts` lines 16-28: adds `req.nostr` property

### Fix Approach

**Step 1**: Update `packages/backend/src/types/express.d.ts` to be the single canonical source

Replace full file content with:
```typescript
declare global {
  namespace Express {
    interface AuthenticatedUser {
      nostr_pubkey: string;
      role?: 'creator' | 'supporter' | 'admin';
      id?: string;
      signature_verified?: boolean;
      iat?: number;
      exp?: number;
    }

    interface Request {
      rawBody?: Buffer;
      user?: AuthenticatedUser;
      nostr?: {
        pubkey: string;
        npub?: string;
        sessionId?: string;
        role?: 'creator' | 'supporter' | 'admin';
        session?: any;
      };
    }
  }
}

export {};
```

Changes from current:
- `role?: string` -> `role?: 'creator' | 'supporter' | 'admin'` (narrow union)
- Add `nostr?` property (moved from nostr-auth.ts)

**Step 2**: Remove `declare global` block from `packages/backend/src/middleware/auth.ts`

Delete lines 5-18 (the comment and `declare global` block):
```typescript
// DELETE lines 5-18:
// 🌟 Extended Request interface with NOSTR authentication
declare global {
  namespace Express {
    interface Request {
      user?: {
        nostr_pubkey: string;
        role?: 'creator' | 'supporter' | 'admin' | undefined;
        signature_verified: boolean;
        iat: number;
        exp: number;
      };
    }
  }
}
```

**Step 3**: Remove `declare global` block from `packages/backend/src/middleware/nostr-auth.ts`

Delete lines 16-28:
```typescript
// DELETE lines 16-28:
declare global {
  namespace Express {
    interface Request {
      nostr?: {
        pubkey: string;
        npub?: string;
        sessionId?: string;
        role?: 'creator' | 'supporter' | 'admin';
        session?: any;
      };
    }
  }
}
```

### Test Requirements

- Run `npx tsc --noEmit` from `packages/backend/` to verify no type errors
- Verify `req.user.role` narrows to the union type (not `string`)
- Existing tests should pass unchanged

---

## Fix 7: .env Plaintext Secrets (#068)

**Priority**: P1 - SECRET EXPOSURE
**Risk**: Low (configuration audit)
**Estimated Lines Changed**: ~5 lines
**Dependency**: None

### Problem

Multiple `.env` files exist in the working tree. While `.gitignore` covers `.env` and `.env.local`, we need to verify no `.env` files are currently tracked in git, and that `.env.example` files contain only placeholders.

### Current State

Files found:
- `/.env` -- placeholder values (OK)
- `/packages/backend/.env` -- placeholder values (OK)
- `/packages/backend/.env.example` -- placeholder values (OK, should be tracked)
- `/packages/backend/.env.example.new` -- unclear purpose, needs review
- `/packages/frontend/.env` -- contains rotated credentials + real Supabase project ID
- `/packages/frontend/.env.local` -- needs review
- `/monitoring/dashboard/grafana/.env.example` -- needs review

`.gitignore` covers: `.env`, `.env.local`, `.env.development.local`, `.env.test.local`, `.env.production.local`

Note: `.gitignore` line 117 also ignores `.env.example` which is unusual.

### Fix Approach

**Step 1**: Verify no `.env` files are tracked in git

```bash
git ls-files '*.env' '.env' '*/.env' '*/.env.local' '*/.env.*.local' 2>/dev/null
```

If any results, remove from tracking: `git rm --cached <file>`

**Step 2**: Fix `.gitignore` if `.env.example` is being ignored

Check `.gitignore` line 117. If it says `.env.example`, remove that line. `.env.example` files SHOULD be tracked (they contain only placeholders).

**Step 3**: Clean up `/packages/frontend/.env`

The file contains `DATABASE_URL` with a real Supabase project ID. Even though the password placeholder says `REPLACE_WITH_NEW_PASSWORD`, the project ID (`jubwmdvjaeznrgvmabyx`) is exposed. This is a frontend `.env` file which should NOT have a `DATABASE_URL`.

Action: Verify this file is NOT tracked. If the content is not needed for frontend, it may be a misplaced file.

**Step 4**: Remove or rename `/packages/backend/.env.example.new`

If its content is a better template than `.env.example`, rename it. Otherwise delete it.

**Step 5**: Review all `.env.example` files for real secrets

Check each `.env.example` file for any values that look like real credentials (long random strings, actual URLs with credentials, etc.). Replace with obvious placeholders like `your-xxx-here`.

### Test Requirements

- `git ls-files` returns no `.env` files (only `.env.example` files)
- All `.env.example` files contain only placeholder values
- `.gitignore` properly covers `.env`, `.env.local`, etc.
- Note: Pre-commit secret detection hook (gitleaks/detect-secrets) is a follow-up item, not this sprint

---

## Summary Table

| # | Finding | File(s) | Risk | Est. LOC | Deps | Tests Needed |
|---|---------|---------|------|----------|------|-------------|
| 062 | Auth Bypass Mock | auth.ts, enhanced-auth.ts, auth.test.ts | Low | ~65 | None | Mock service layer tests |
| 064 | WS Leak in Health | health.ts | Low | ~5 | None | WS close verification |
| 065 | setMaxListeners(0) | server.ts | Med | ~3 | #064 | No MaxListeners warnings |
| 063 | Unbounded Caches | lightning-*.ts, new ttl-cache.ts | Low | ~100 | None | TTLCache unit tests |
| 066 | WeakSet False Positive | sensitive-fields.ts | Low | ~10 | None | Shared ref + circular tests |
| 067 | Conflicting Types | express.d.ts, auth.ts, nostr-auth.ts | Low | ~15 | None | tsc --noEmit |
| 068 | .env Secrets | .env files, .gitignore | Low | ~5 | None | git ls-files audit |

**Total estimated changes**: ~200 lines across ~10 files + 1 new file (ttl-cache.ts)

---

## Implementation Notes for Backend Agent

1. **Execute in order**: 062 -> 064 -> 065 -> 063 -> 066 -> 067 -> 068
2. **Test after each fix**: Run relevant tests before moving to the next fix
3. **TypeScript compilation**: After fix #067, run `npx tsc --noEmit` to verify no type errors
4. **Do not add new npm dependencies**: The TTLCache is a hand-written utility (~80 lines)
5. **Git verification for #068**: Use git commands to verify tracking status
6. **Enhanced-auth.ts**: Fix #062 applies to BOTH `auth.ts` AND `enhanced-auth.ts`
7. **The `finally` block in health.ts already exists**: Fix #064 is defensive hardening (null out handlers)
8. **sanitizeObject change is subtle**: The WeakMap approach must register the sanitized object BEFORE recursing (line order matters for circular ref handling)
