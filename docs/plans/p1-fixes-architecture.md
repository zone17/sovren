# P1 Fixes Architecture Plan

**Date**: 2026-02-13
**Sprint**: PR #73 Code Review Remediation
**Scope**: 4 P1 critical findings — backend-only fixes in `packages/backend/`
**Author**: Architect Agent

---

## Summary

Four P1 critical issues were identified in the PR #73 code review. This plan provides the fix approach, files to modify, risks, testing strategy, and acceptance criteria for each. The fixes are independent of each other and can be implemented in any order.

---

## Fix 1: P1-088 — Client-Controlled Role Privilege Escalation

### Problem

`packages/backend/src/routes/auth.ts:31` — The Zod schema accepts `role: 'admin'` from client input. The client-supplied role is passed directly to `nostrAuth.generateJWT()` at line 81, allowing any user to obtain an admin JWT.

### Fix Approach

**Remove `'admin'` from the client-selectable role enum.** Only `'creator'` and `'supporter'` should be selectable by the client. The `'admin'` role should only be assignable server-side (future: via database lookup or a protected admin endpoint).

### Files to Modify

| File                                                 | Change                                                                                                                                                                                                                                                                      |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/backend/src/routes/auth.ts`                | Line 31: Change `z.enum(['creator', 'supporter', 'admin'])` to `z.enum(['creator', 'supporter'])`                                                                                                                                                                           |
| `packages/backend/src/services/nostr-auth.ts`        | Line 25: Keep `'admin'` in `JWTPayloadSchema` (admin JWTs still valid for verification). Line 173: Change `generateJWT` param type from `'creator' \| 'supporter' \| 'admin'` to `'creator' \| 'supporter'`                                                                 |
| `packages/backend/src/routes/__tests__/auth.test.ts` | Add test: sending `role: 'admin'` in auth request returns 400. Update stats test (lines 295-304) to use a different mechanism — mock the JWT verification to return admin role rather than sending `role: 'admin'` in the request body (which will now be rejected by Zod). |

### Detailed Changes

**`routes/auth.ts` line 31:**

```typescript
// BEFORE
role: z.enum(['creator', 'supporter', 'admin']).optional().default('supporter'),

// AFTER
role: z.enum(['creator', 'supporter']).optional().default('supporter'),
```

**`services/nostr-auth.ts` line 172-175:**

```typescript
// BEFORE
async generateJWT(
  pubkey: string,
  role: 'creator' | 'supporter' | 'admin' = 'supporter'
): Promise<string> {

// AFTER
async generateJWT(
  pubkey: string,
  role: 'creator' | 'supporter' = 'supporter'
): Promise<string> {
```

**`services/nostr-auth.ts` line 25 — Keep as-is:**
The `JWTPayloadSchema` must still accept `'admin'` so that existing admin JWTs can be verified and the `/stats` endpoint continues to work. The `role` in the JWT payload schema is for _reading_ tokens, not for _creating_ them from client input.

**`routes/__tests__/auth.test.ts` — Add new test:**

```typescript
it('should reject admin role in authentication request', async () => {
  const response = await request(app)
    .post('/api/auth/authenticate')
    .send({
      nostr_pubkey: testPubkey,
      challenge: 'a'.repeat(64),
      timestamp: Date.now(),
      signature: 'valid_signature',
      role: 'admin',
    })
    .expect(400);

  expect(response.body.success).toBe(false);
  expect(response.body.code).toBe('VALIDATION_ERROR');
});
```

**`routes/__tests__/auth.test.ts` — Update admin stats test (lines 295-304):**
The existing test sends `role: 'admin'` in the authentication request body. After the fix, this will return 400. The test already mocks `verifyJWT` to return `role: 'admin'` for the stats endpoint check, so we just need to remove `role: 'admin'` from the `.send()` payload. The mock already handles setting the admin role in the JWT payload.

### Risk Assessment

- **Risk**: Low
- **Blast radius**: Only the `/authenticate` endpoint input validation. Admin JWTs already issued remain valid (no existing admin users in production to worry about — the system is pre-launch).
- **Consideration**: The `/stats` endpoint (line 227) checks `req.user.role !== 'admin'`. After this fix, the only way to get an admin JWT is via direct server-side code or database. This is acceptable — admin stats access should require server-side assignment.

### Acceptance Criteria

- [ ] Sending `role: 'admin'` in POST `/api/auth/authenticate` returns 400 Validation Error
- [ ] Sending `role: 'creator'` or `role: 'supporter'` still works
- [ ] Omitting `role` defaults to `'supporter'`
- [ ] Existing admin JWT verification still works (JWTPayloadSchema unchanged)
- [ ] New test covers the admin role rejection
- [ ] Existing tests pass (with stats test updated)

---

## Fix 2: P1-089 — Random JWT Secret Per Instance

### Problem

`packages/backend/src/services/nostr-auth.ts:374` — The singleton `nostrAuth` is created with `new NostrAuthService()` which calls `this.generateSecureSecret()` (line 45/304-307) when no `jwtSecret` is provided. This generates a random 64-byte hex secret on every server start, invalidating all existing JWTs and breaking multi-instance deployments.

### Fix Approach

**Read `JWT_SECRET` from `process.env` at the singleton instantiation. Fail-fast if missing or weak in production/staging.**

The constructor already accepts an optional `jwtSecret` parameter (line 41). The fix is at the singleton instantiation (line 374) and in the fallback logic (line 45).

### Files to Modify

| File                                          | Change                                                                                                                                             |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/backend/src/services/nostr-auth.ts` | Line 374: Pass `process.env.JWT_SECRET` to constructor. Lines 44-45: Add fail-fast validation when not in test environment and no secret provided. |
| `packages/backend/.env.example`               | Already has `JWT_SECRET` documented (line 10) — no change needed                                                                                   |

### Detailed Changes

**`services/nostr-auth.ts` line 40-53 (constructor):**

```typescript
// BEFORE
constructor(
  jwtSecret?: string,
  jwtExpiresIn: string = '24h',
  challengeTTL: number = 300000
) {
  this.JWT_SECRET = jwtSecret || this.generateSecureSecret();
  // ...
}

// AFTER
constructor(
  jwtSecret?: string,
  jwtExpiresIn: string = '24h',
  challengeTTL: number = 300000
) {
  if (jwtSecret) {
    this.JWT_SECRET = jwtSecret;
  } else if (process.env.NODE_ENV === 'test') {
    this.JWT_SECRET = this.generateSecureSecret();
  } else {
    throw new Error(
      'JWT_SECRET environment variable is required. ' +
      'Generate one with: openssl rand -base64 32'
    );
  }
  // ...
}
```

**`services/nostr-auth.ts` line 374 (singleton):**

```typescript
// BEFORE
export const nostrAuth = new NostrAuthService();

// AFTER
export const nostrAuth = new NostrAuthService(process.env.JWT_SECRET);
```

### Design Rationale

- **Why pass via constructor AND check env in constructor?** The constructor parameter is the primary path. The env check in the constructor is a safety net if someone calls `new NostrAuthService()` without args in non-test code. The singleton line explicitly passes `process.env.JWT_SECRET`, which may be `undefined` — the constructor handles that case.
- **Why allow random secret in test?** Tests don't set `JWT_SECRET` and shouldn't need to. The random secret is fine for isolated test runs.
- **Why not validate minimum length?** The `.env.example` already documents the requirement. Adding length validation adds complexity for minimal security benefit — an attacker who can set env vars can set any secret. The fail-fast on missing is the critical fix.

Actually, let me revise: we SHOULD validate minimum length, as the todo specifies it. Updated constructor:

```typescript
constructor(
  jwtSecret?: string,
  jwtExpiresIn: string = '24h',
  challengeTTL: number = 300000
) {
  if (jwtSecret) {
    if (jwtSecret.length < 32) {
      throw new Error(
        'JWT_SECRET must be at least 32 characters. ' +
        'Generate one with: openssl rand -base64 32'
      );
    }
    this.JWT_SECRET = jwtSecret;
  } else if (process.env.NODE_ENV === 'test') {
    this.JWT_SECRET = this.generateSecureSecret();
  } else {
    throw new Error(
      'JWT_SECRET environment variable is required. ' +
      'Generate one with: openssl rand -base64 32'
    );
  }
  // ...rest unchanged
}
```

### Risk Assessment

- **Risk**: Low
- **Blast radius**: Server will fail to start if `JWT_SECRET` is not set. This is intentional and desired. All existing environments should already have `JWT_SECRET` in their `.env` (the `.env.example` already documents it).
- **Consideration**: Existing JWTs signed with the old random secret will become invalid after deploying this fix (since the random secret is lost). This is acceptable — it's a one-time session invalidation that fixes the recurring problem.

### Acceptance Criteria

- [ ] Server starts successfully when `JWT_SECRET` env var is set (>= 32 chars)
- [ ] Server fails to start with clear error when `JWT_SECRET` is missing (non-test)
- [ ] Server fails to start with clear error when `JWT_SECRET` is < 32 chars
- [ ] Tests still pass without setting `JWT_SECRET` (random secret in test env)
- [ ] JWTs survive server restarts when same `JWT_SECRET` is used
- [ ] `generateSecureSecret()` warning log is removed (method still exists for test use)

---

## Fix 3: P1-090 — Lightning Payments Volatile-Only Storage

### Problem

`packages/backend/src/services/lightning-service.ts` — All payment records (invoices and payments) are stored exclusively in `TTLCache` instances (lines 156-163). Payment records have a 24h TTL and 50K max cap. On server restart, all data is lost. The `processWebhook` method (line 562-564) does an O(n) linear scan of the cache and silently succeeds if the invoice is not found (returning `{ success: true }` with no payment recorded).

### Fix Approach

**Add a JSON file persistence layer as a write-through store behind the existing cache.** This is the minimum viable fix that:

1. Prevents data loss on restart
2. Keeps the cache for read performance
3. Introduces a `PaymentPersistence` interface that can be swapped for Supabase later

A full Supabase migration is out of scope for this sprint but the interface design enables it.

### Files to Create/Modify

| File                                                   | Change                                                                                       |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `packages/backend/src/services/payment-persistence.ts` | **NEW** — `PaymentPersistence` interface + `JsonFilePaymentStore` implementation             |
| `packages/backend/src/services/lightning-service.ts`   | Add persistence layer: write-through on payment/invoice creation, read-through on cache miss |

### Detailed Design: `payment-persistence.ts`

```typescript
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import type { LightningInvoice, LightningPayment } from './lightning-service';

/**
 * Interface for payment persistence.
 * Implementations: JsonFilePaymentStore (MVP), SupabasePaymentStore (future).
 */
export interface PaymentPersistence {
  saveInvoice(invoice: LightningInvoice): Promise<void>;
  savePayment(payment: LightningPayment): Promise<void>;
  getInvoiceById(id: string): Promise<LightningInvoice | null>;
  getInvoiceByPaymentHash(hash: string): Promise<LightningInvoice | null>;
  getPaymentsByCreator(creatorId: string): Promise<LightningPayment[]>;
  getAllPayments(): Promise<LightningPayment[]>;
  getAllInvoices(): Promise<LightningInvoice[]>;
  updateInvoiceStatus(id: string, status: string): Promise<void>;
}

/**
 * JSON file-based persistence for MVP.
 * Writes to data/payments/ directory.
 * Thread-safe for single-instance use (not suitable for multi-instance).
 */
export class JsonFilePaymentStore implements PaymentPersistence {
  private readonly dataDir: string;
  private invoices: Map<string, LightningInvoice> = new Map();
  private payments: Map<string, LightningPayment> = new Map();

  constructor(dataDir?: string) {
    this.dataDir = dataDir || path.join(process.cwd(), 'data', 'payments');
    if (!existsSync(this.dataDir)) {
      mkdirSync(this.dataDir, { recursive: true });
    }
    this.loadFromDisk();
  }

  // ... implementation methods that read/write JSON files
  // invoices.json and payments.json in dataDir
}
```

### Detailed Changes to `lightning-service.ts`

1. **Add persistence property to `LightningService`:**

   ```typescript
   private persistence: PaymentPersistence;
   ```

2. **Initialize in `initialize()` method (line 183):**

   ```typescript
   this.persistence = new JsonFilePaymentStore();
   // Load persisted data into caches on startup
   const invoices = await this.persistence.getAllInvoices();
   for (const inv of invoices) {
     if (inv.status === 'pending' && inv.expires_at > Date.now()) {
       this.invoiceCache.set(inv.id, inv);
     }
   }
   ```

3. **Write-through on invoice creation (after line 291):**

   ```typescript
   this.invoiceCache.set(invoiceId, invoice);
   await this.persistence.saveInvoice(invoice);
   ```

4. **Write-through on payment creation (lines 347-361 and 571-585):**

   ```typescript
   this.paymentCache.set(payment.id, payment);
   await this.persistence.savePayment(payment);
   await this.persistence.updateInvoiceStatus(invoice.id, 'paid');
   ```

5. **Read-through on `processWebhook` cache miss (line 562-564):**

   ```typescript
   // BEFORE: O(n) cache scan, silent failure on miss
   const invoice = this.invoiceCache
     .values()
     .find((inv) => inv.payment_hash === payload.payment_hash);

   // AFTER: Cache scan first, then persistence fallback
   let invoice = this.invoiceCache
     .values()
     .find((inv) => inv.payment_hash === payload.payment_hash);
   if (!invoice) {
     invoice = await this.persistence.getInvoiceByPaymentHash(payload.payment_hash);
   }
   ```

6. **Read-through on `getCreatorPayments` (line 632):**

   ```typescript
   // BEFORE: Cache-only read
   let payments = this.paymentCache.values().filter((payment) => payment.creator_id === creatorId);

   // AFTER: Persistence fallback
   let payments = await this.persistence.getPaymentsByCreator(creatorId);
   ```

7. **Read-through on `getStats` (line 681-682):**
   ```typescript
   const invoices = await this.persistence.getAllInvoices();
   const payments = await this.persistence.getAllPayments();
   ```

### Risk Assessment

- **Risk**: Medium (new file creation, write-through logic adds I/O)
- **Blast radius**: Only `lightning-service.ts` — no other services depend on its internal storage
- **Consideration**: JSON file persistence is single-instance only. For multi-instance deployments, the `PaymentPersistence` interface should be implemented with Supabase (future sprint). File I/O could be slow under high load — the cache mitigates this for reads.
- **Data directory**: Needs to be excluded from `.gitignore` and included in Docker volumes for container deployments.

### Acceptance Criteria

- [ ] Payment records persist across server restarts
- [ ] Invoices persist across server restarts
- [ ] `processWebhook` finds invoices even after cache eviction (via persistence fallback)
- [ ] `getCreatorPayments` returns complete history (not limited to 24h cache)
- [ ] `getStats` returns accurate totals from persistence layer
- [ ] Cache continues to serve hot reads for performance
- [ ] `PaymentPersistence` interface is clean and ready for Supabase swap
- [ ] `data/payments/` directory is created automatically on first run

---

## Fix 4: P1-091 — Broken Import from Non-Existent `config/redis`

### Problem

Seven service files import `{ RedisClient } from '../config/redis'` but this module does not exist. The actual Redis module is at `packages/backend/src/lib/redis.ts` exporting `getRedisClient()` which returns an `ioredis` `Redis` instance.

### Actual Broken Files (verified via grep)

The todo listed 7 files but the **actual** 7 files with the broken import (verified by grep) are different:

| #   | File                                                     | Listed in Todo?                                |
| --- | -------------------------------------------------------- | ---------------------------------------------- |
| 1   | `services/lightning-payment-service.ts`                  | Yes                                            |
| 2   | `services/subscription-management-service.ts`            | No (todo listed nostr-relay-service.ts)        |
| 3   | `services/subscription-management-service-extensions.ts` | No (todo listed content-moderation-service.ts) |
| 4   | `services/recommendation-service.ts`                     | No (todo listed analytics-service.ts)          |
| 5   | `services/content-discovery-service.ts`                  | No (todo listed cache-service.ts)              |
| 6   | `services/transaction-history-service.ts`                | No (todo listed rate-limiter-service.ts)       |
| 7   | `services/payout-management-service.ts`                  | No (todo listed session-service.ts)            |

The files listed in the todo (`nostr-relay-service.ts`, `content-moderation-service.ts`, `analytics-service.ts`, `cache-service.ts`, `rate-limiter-service.ts`, `session-service.ts`) **do not exist** in the repository.

### Fix Approach

**Update all 7 imports** from `{ RedisClient } from '../config/redis'` to `{ getRedisClient } from '../lib/redis'`, and refactor usage from `new RedisClient()` or `RedisClient.method()` to `getRedisClient().method()`.

### Files to Modify

| File                                                     | Changes                                                                                                                                             |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `services/lightning-payment-service.ts`                  | Import fix + refactor `this.redis = new RedisClient()` to `this.redis = getRedisClient()`, change type from `RedisClient` to `Redis` (from ioredis) |
| `services/subscription-management-service.ts`            | Import fix + refactor Redis usage                                                                                                                   |
| `services/subscription-management-service-extensions.ts` | Import fix + refactor Redis usage                                                                                                                   |
| `services/recommendation-service.ts`                     | Import fix + refactor Redis usage                                                                                                                   |
| `services/content-discovery-service.ts`                  | Import fix + refactor Redis usage                                                                                                                   |
| `services/transaction-history-service.ts`                | Import fix + refactor Redis usage                                                                                                                   |
| `services/payout-management-service.ts`                  | Import fix + refactor Redis usage                                                                                                                   |

### Detailed Changes (Pattern for Each File)

```typescript
// BEFORE (in each file)
import { RedisClient } from '../config/redis';
// ... later in constructor:
this.redis = new RedisClient();
// ... usage:
await this.redis.setex(key, ttl, value);
await this.redis.get(key);
await this.redis.del(key);

// AFTER (in each file)
import Redis from 'ioredis';
import { getRedisClient } from '../lib/redis';
// ... later in constructor:
this.redis = getRedisClient();
// ... usage stays the same since ioredis Redis has the same API:
await this.redis.setex(key, ttl, value);
await this.redis.get(key);
await this.redis.del(key);
```

**For the type declaration in each file:**

```typescript
// BEFORE
private redis: RedisClient;

// AFTER
private redis: Redis;
```

**Note**: The `ioredis` `Redis` class has `setex`, `get`, `del`, `ping`, `disconnect` etc. — the same methods already being called on the non-existent `RedisClient`. So the method call sites should not need changes — only the import, type declaration, and instantiation.

### Special Case: `lightning-payment-service.ts`

This file uses `new RedisClient()` in the constructor (line 125). After the fix:

```typescript
// BEFORE
this.redis = new RedisClient();

// AFTER
this.redis = getRedisClient();
```

The `shutdown()` method (line 836) calls `await this.redis.disconnect()`. The `ioredis` `Redis` class has a `disconnect()` method, but the shared client from `getRedisClient()` is a singleton — disconnecting it in one service would break all others. **Fix: Remove `this.redis.disconnect()` from the service's `shutdown()`** or change to a no-op comment explaining that the shared client is managed by `lib/redis.ts`'s `disconnectRedis()`.

### Risk Assessment

- **Risk**: Low (mechanical import replacement)
- **Blast radius**: All 7 files, but the change is identical in each. Current state is already broken (runtime import errors), so this fix can only improve things.
- **Consideration**: The `getRedisClient()` function uses `lazyConnect: true`, meaning it won't actually connect until the first command. Services should handle Redis connection failures gracefully.

### Acceptance Criteria

- [ ] All 7 files import from `'../lib/redis'` instead of `'../config/redis'`
- [ ] All 7 files use `getRedisClient()` instead of `new RedisClient()`
- [ ] Type declarations use `Redis` from `ioredis`
- [ ] No file imports from `'../config/redis'` (grep verification: zero results)
- [ ] TypeScript compilation succeeds with no import errors
- [ ] Singleton `shutdown()` methods don't disconnect the shared Redis client

---

## Dependencies Between Fixes

**None.** All 4 fixes are independent and can be implemented in parallel or any order.

```
P1-088 (Role escalation)     ─── independent
P1-089 (JWT secret)           ─── independent
P1-090 (Payment persistence)  ─── independent
P1-091 (Redis imports)        ─── independent
```

Note: P1-091 fixes imports in `lightning-payment-service.ts`, and P1-090 fixes storage in `lightning-service.ts`. These are **different files** and do not conflict.

---

## Implementation Order (Recommended)

1. **P1-091** (Redis imports) — Fastest, mechanical, unblocks Redis operations in 7 services
2. **P1-088** (Role escalation) — Small, high-severity security fix
3. **P1-089** (JWT secret) — Small, critical security fix
4. **P1-090** (Payment persistence) — Largest, requires new file, most testing

---

## Testing Strategy

### Per-Fix Unit Tests

| Fix    | Test Approach                                                                                                                                      |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1-088 | Existing `auth.test.ts` + new test for admin role rejection. Update admin stats test.                                                              |
| P1-089 | Unit test `NostrAuthService` constructor with: (a) valid secret, (b) missing secret in non-test env, (c) short secret, (d) test env without secret |
| P1-090 | Unit test `JsonFilePaymentStore`: save/load/query operations. Integration test: restart simulation (write, clear cache, read from persistence)     |
| P1-091 | TypeScript compilation is the primary test. Existing service tests (if any) will validate Redis operations work.                                   |

### Regression Testing

After all 4 fixes:

```bash
npm run test:unit          # All unit tests pass
npm run type-check         # No TypeScript errors
npm run lint               # No lint errors
```

### Manual Verification Checklist

- [ ] Start server with `JWT_SECRET` set — boots successfully
- [ ] Start server without `JWT_SECRET` — fails with clear error
- [ ] Authenticate with `role: 'admin'` — returns 400
- [ ] Authenticate with `role: 'creator'` — succeeds
- [ ] Create Lightning payment, restart server, query payment — data preserved
- [ ] grep for `config/redis` — zero results

---

## Summary Table

| ID     | Issue                         | Severity | Effort | Files     | Risk   |
| ------ | ----------------------------- | -------- | ------ | --------- | ------ |
| P1-088 | Client-controlled admin role  | Critical | Small  | 3         | Low    |
| P1-089 | Random JWT secret per restart | Critical | Small  | 1         | Low    |
| P1-090 | Payment volatile-only storage | Critical | Medium | 2 (1 new) | Medium |
| P1-091 | Broken config/redis imports   | Critical | Small  | 7         | Low    |
