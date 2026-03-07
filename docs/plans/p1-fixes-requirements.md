# P1 Fixes Requirements Validation

**Validated by**: Product Owner
**Date**: 2026-02-13
**Source**: PR #73 Code Review Findings (088-091)
**Status**: Requirements Validated

---

## Executive Summary

4 P1 critical findings from the code review of PR #73. All 4 are legitimate, confirmed by source code cross-reference. One finding (091) has an inaccurate affected-file list that needs correction before implementation.

**Business Impact Priority Order** (fix in this sequence):

| Order | Finding                        | Business Impact                             | Blast Radius                     |
| ----- | ------------------------------ | ------------------------------------------- | -------------------------------- |
| 1     | 088 - Privilege Escalation     | **CRITICAL** - Any user can become admin    | All users, all data              |
| 2     | 091 - Broken Redis Import      | **HIGH** - 7 services silently degraded     | Caching, rate-limiting, sessions |
| 3     | 089 - Random JWT Secret        | **HIGH** - Sessions lost on restart         | All authenticated users          |
| 4     | 090 - Volatile Payment Storage | **CRITICAL** - Payment data lost on restart | All financial transactions       |

**Rationale**: 088 first because it is actively exploitable by any unauthenticated user. 091 second because it is a quick fix (import paths) that unblocks Redis for all 7 services. 089 third because it prevents session loss. 090 last because it is the largest change (new DB table, write-through logic) and benefits from having Redis working (091) first.

---

## Finding 088: Client-Controlled Role Privilege Escalation

### Source Code Verification

**CONFIRMED**. Cross-referenced against `packages/backend/src/routes/auth.ts`:

- Line 31: `role: z.enum(['creator', 'supporter', 'admin']).optional().default('supporter')` -- accepts `admin` from client
- Line 81: `nostrAuth.generateJWT(verification.pubkey, validatedData.role)` -- passes client role directly to JWT
- `packages/backend/src/services/nostr-auth.ts` line 172-175: `generateJWT()` accepts role parameter with no server-side validation

**Note**: The todo says roles are `['user', 'creator', 'admin']` but actual code has `['creator', 'supporter', 'admin']`. This discrepancy does not change the severity -- the vulnerability is the same.

### Acceptance Criteria Validation

| #   | Criterion                                                | Verdict     | Notes                                                                                                                                                                                        |
| --- | -------------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Client cannot set `role: 'admin'` in auth request        | **PASS**    | Clear, testable. Verify Zod schema rejects admin.                                                                                                                                            |
| 2   | Admin role assignment requires server-side authorization | **PASS**    | Needs spec: what IS the admin assignment mechanism? Allowlist? DB lookup?                                                                                                                    |
| 3   | All existing admin tokens are invalidated                | **PARTIAL** | Not testable without defining HOW tokens are invalidated. Since JWT is stateless, this requires either: (a) secret rotation (couples to 089), or (b) a token blocklist. Needs clarification. |
| 4   | Role claims in JWT derived from server-side source       | **PASS**    | Clear outcome. Requires DB or env-based role lookup.                                                                                                                                         |
| 5   | Security test verifying escalation is blocked            | **PASS**    | Standard test: POST /auth/authenticate with `role: 'admin'` should either reject or ignore the role.                                                                                         |

### Additional Edge Cases Identified

1. **What happens to the `/stats` endpoint?** (`auth.ts:227`) -- It checks `req.user.role !== 'admin'`. If no one can get admin role, this endpoint becomes permanently inaccessible. The fix must define how admin access is granted.
2. **Refresh token preserves role** (`nostr-auth.ts:263`) -- `refreshJWT()` copies `verification.payload.role` into new token. If an existing admin token is refreshed, the admin role persists. Token invalidation must also block refresh.
3. **What about `creator` role?** -- Is creator self-selectable or also server-assigned? Current schema allows client to pick `creator`. The product decision here affects the fix scope.
4. **Race condition**: If fix is deployed while admin tokens are live, those tokens remain valid until expiry (24h). Acceptance criterion 3 implies immediate invalidation, which requires secret rotation or blocklist.

### Missing Requirements

- **MR-088-1**: Define the admin role assignment mechanism (DB table? env allowlist? separate endpoint?)
- **MR-088-2**: Define whether `creator` role is client-selectable or server-assigned
- **MR-088-3**: Define token invalidation strategy for existing admin tokens (couples to 089 JWT secret change)

---

## Finding 089: NostrAuth Random JWT Secret Generation

### Source Code Verification

**CONFIRMED** with nuance. Cross-referenced against `packages/backend/src/services/nostr-auth.ts`:

- Line 45: `this.JWT_SECRET = jwtSecret || this.generateSecureSecret();`
- Line 304-307: `generateSecureSecret()` generates random bytes and logs a warning
- Line 374: `export const nostrAuth = new NostrAuthService();` -- instantiated with NO arguments

The constructor accepts an optional `jwtSecret` parameter, but the singleton at line 374 is created without one, so it falls through to random generation every time. This is slightly different from the todo's description (which says `private jwtSecret: string = crypto.randomBytes(32).toString('hex')` at line 374) -- the actual code uses a constructor fallback pattern. Same outcome, different mechanism.

### Acceptance Criteria Validation

| #   | Criterion                                              | Verdict  | Notes                                                                 |
| --- | ------------------------------------------------------ | -------- | --------------------------------------------------------------------- |
| 1   | JWT_SECRET read from environment variable              | **PASS** | Clear, testable.                                                      |
| 2   | Server fails to start if JWT_SECRET is missing or weak | **PASS** | Clear. Define "weak" threshold (todo says < 32 chars, which is good). |
| 3   | Existing JWTs remain valid across server restarts      | **PASS** | Testable: sign token, restart, verify same token.                     |
| 4   | Multi-instance deployments share same JWT_SECRET       | **PASS** | Operational criterion -- testable in integration/staging.             |
| 5   | Documentation includes JWT_SECRET setup instructions   | **PASS** | Verifiable artifact.                                                  |
| 6   | .env.example includes JWT_SECRET                       | **PASS** | Verifiable artifact.                                                  |

### Additional Edge Cases Identified

1. **First deploy invalidates all sessions**: When switching from random to env-based secret, ALL existing tokens become invalid. This is expected but should be documented as a breaking change with a migration note.
2. **What if JWT_SECRET is set but is the literal string from .env.example?** Should the app reject known-insecure example values (e.g., "change-me-to-a-secure-value")?
3. **Secret rotation path**: What happens when the secret needs to be rotated in the future? Should the service support reading a previous secret for graceful rotation? (Out of scope for P1, but worth noting.)
4. **Test environment**: The constructor fallback (`this.generateSecureSecret()`) is actually useful for tests. Ensure the fix does not break test harness by requiring JWT_SECRET in `NODE_ENV=test`.

### Missing Requirements

- **MR-089-1**: Define behavior in test environment (fail-fast should be production-only, or tests must set JWT_SECRET)
- **MR-089-2**: Document the breaking change (all existing sessions invalidated on first deploy)

---

## Finding 090: Lightning Payments Volatile-Only Storage

### Source Code Verification

**CONFIRMED**. Cross-referenced against `packages/backend/src/services/lightning-service.ts`:

- Lines 156-163: `invoiceCache` (TTL 1hr, max 10K) and `paymentCache` (TTL 24hr, max 50K) are the ONLY storage
- Line 291: `this.invoiceCache.set(invoiceId, invoice)` -- cache-only write on invoice creation
- Line 361: `this.paymentCache.set(payment.id, payment)` -- cache-only write on payment completion
- Line 585: `this.paymentCache.set(payment.id, payment)` -- cache-only write on webhook processing
- Lines 632-634: `getCreatorPayments()` reads from cache only
- Lines 681-682: `getStats()` reads from cache only
- Lines 562-564: `processWebhook()` searches invoice cache via `.find()` -- if invoice expired from cache, webhook returns `{ success: true }` silently (line 600-602, not lines 558-582 as todo states)

**Note on line numbers**: The todo references line numbers that are slightly off from actual source (e.g., webhook silent success is at lines 600-602, not 558-582). The described behavior is correct regardless.

### Acceptance Criteria Validation

| #   | Criterion                                             | Verdict     | Notes                                                                                                                                                                                                                                                                  |
| --- | ----------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | All payment records persisted to DB on creation       | **PASS**    | Clear, testable.                                                                                                                                                                                                                                                       |
| 2   | Server restart does not lose payment history          | **PASS**    | Integration test: create payment, restart, query.                                                                                                                                                                                                                      |
| 3   | Payments older than 24h remain queryable              | **PASS**    | Testable with time manipulation or direct DB query.                                                                                                                                                                                                                    |
| 4   | Webhook processing idempotent via payment_hash        | **PASS**    | Send same webhook twice, verify single payment record.                                                                                                                                                                                                                 |
| 5   | getCreatorPayments() returns complete history from DB | **PASS**    | Verify returns DB records, not just cache.                                                                                                                                                                                                                             |
| 6   | Cache continues to optimize hot-path reads            | **PASS**    | Verify cache is populated on read-through.                                                                                                                                                                                                                             |
| 7   | Migration script handles existing cache data          | **PARTIAL** | In-memory cache is ephemeral -- there is nothing to migrate. If the server hasn't restarted, there may be live cache data, but a migration script cannot access in-process memory. This criterion should be reworded to: "No data loss during deployment of this fix." |
| 8   | Payment statistics remain accurate beyond 24h         | **PASS**    | Verify getStats() queries DB, not just cache.                                                                                                                                                                                                                          |

### Additional Edge Cases Identified

1. **DB write fails after cache write**: If DB is down but cache write succeeds, the system shows the payment as existing but it will vanish on restart. Need write-through with rollback: fail the entire operation if DB write fails.
2. **Duplicate webhook delivery**: LNbits can send webhooks multiple times. The payment_hash unique constraint handles this, but the code must handle the DB unique constraint violation gracefully (upsert or catch-and-ignore duplicate error).
3. **Invoice cache miss during webhook**: Currently, if invoice is not in cache, webhook silently succeeds. After the fix, webhook should query DB for the invoice. But what if the invoice is not in DB either? (e.g., created before the fix was deployed). Define behavior.
4. **Cache eviction vs DB source of truth**: After this fix, should `checkInvoiceStatus()` also fall through to DB on cache miss? Currently it returns "Invoice not found" if not in cache (line 324).
5. **Database table schema**: The recommended schema in the todo lists `pubkey` as a column, but `LightningPayment` type has `creator_id` and `supporter_id` instead. Schema must match the actual type.
6. **Transaction amount precision**: Satoshi amounts are integers but should be validated as such in the DB schema (no floating point).

### Missing Requirements

- **MR-090-1**: Define behavior when DB write fails (should the API return an error to the caller, or silently degrade to cache-only?)
- **MR-090-2**: Define behavior for webhook when invoice is missing from both cache AND DB
- **MR-090-3**: Clarify that `checkInvoiceStatus()` should also fall through to DB on cache miss
- **MR-090-4**: Correct the DB schema to use `creator_id`/`supporter_id` (not `pubkey`) to match the existing `LightningPayment` type

---

## Finding 091: Broken Redis Import Path

### Source Code Verification

**CONFIRMED** that `config/redis` does not exist. `Glob` search returns no results for `**/config/redis*` under `packages/backend/`.

The actual Redis module is at `packages/backend/src/lib/redis.ts` and exports `getRedisClient()` and `disconnectRedis()`.

**DISCREPANCY in affected file list**: The todo lists these 7 files:

1. lightning-payment-service.ts
2. nostr-relay-service.ts
3. content-moderation-service.ts
4. analytics-service.ts
5. cache-service.ts
6. rate-limiter-service.ts
7. session-service.ts

**Actual files with broken import** (from Grep search):

1. lightning-payment-service.ts -- MATCH
2. transaction-history-service.ts -- **MISSING from todo**
3. recommendation-service.ts -- **MISSING from todo**
4. subscription-management-service-extensions.ts -- **MISSING from todo**
5. content-discovery-service.ts -- **MISSING from todo**
6. payout-management-service.ts -- **MISSING from todo**
7. subscription-management-service.ts -- **MISSING from todo**

Only 1 of 7 files in the todo's list actually has the broken import. The other 6 files listed in the todo **do not appear in the grep results** -- they either don't exist, don't have this import, or were listed incorrectly. Meanwhile, 6 additional files that DO have the broken import are **not mentioned in the todo at all**.

This is a significant requirements defect. The implementation team needs the correct file list.

### Acceptance Criteria Validation

| #   | Criterion                                            | Verdict     | Notes                                                                                                                         |
| --- | ---------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 1   | All imports reference correct module: `../lib/redis` | **PASS**    | Clear, testable via grep.                                                                                                     |
| 2   | All Redis operations use `getRedisClient()` function | **PASS**    | Code-level verification.                                                                                                      |
| 3   | Invoice caching works in LightningPaymentService     | **PASS**    | Integration test.                                                                                                             |
| 4   | Payment verification caching works                   | **PASS**    | Integration test.                                                                                                             |
| 5   | Rate limiting functions correctly                    | **PARTIAL** | rate-limiter-service.ts is NOT in the actual broken import list. May already be working or may not exist. Needs verification. |
| 6   | Session management persists to Redis                 | **PARTIAL** | session-service.ts is NOT in the actual broken import list. Same concern as above.                                            |
| 7   | No runtime import errors in any service              | **PASS**    | Global criterion, testable.                                                                                                   |
| 8   | Integration test verifies Redis connectivity         | **PASS**    | Clear deliverable.                                                                                                            |

### Additional Edge Cases Identified

1. **`getRedisClient()` uses lazy connect**: The Redis client in `lib/redis.ts` is configured with `lazyConnect: true` (line 43/54). This means the connection is not established until the first command. If Redis is down, the first Redis operation in each service will fail. Services must handle this gracefully.
2. **Error handling after fix**: Currently these Redis calls are probably caught by try/catch and silently failing (as the todo notes). After fixing the import, the calls will actually execute. If Redis is not available in dev/test, services may start throwing errors that were previously silent. Need to verify all Redis usage has proper error handling.
3. **Named export mismatch**: The broken import uses `{ RedisClient }` (a named object), but `lib/redis.ts` exports `getRedisClient()` (a factory function). Every usage site needs refactoring from `RedisClient.setex(...)` to `const redis = getRedisClient(); redis.setex(...)`. This is more than just changing the import path.

### Missing Requirements

- **MR-091-1**: **CRITICAL** -- Update the affected file list to match reality (see verification above). The correct list of 7 files with the broken import is:
  1. `packages/backend/src/services/lightning-payment-service.ts`
  2. `packages/backend/src/services/transaction-history-service.ts`
  3. `packages/backend/src/services/recommendation-service.ts`
  4. `packages/backend/src/services/subscription-management-service-extensions.ts`
  5. `packages/backend/src/services/content-discovery-service.ts`
  6. `packages/backend/src/services/payout-management-service.ts`
  7. `packages/backend/src/services/subscription-management-service.ts`
- **MR-091-2**: Each service needs refactoring from `RedisClient.method()` to `getRedisClient().method()` pattern -- not just import path change
- **MR-091-3**: Verify error handling exists around Redis calls in each service (fixing the import may surface new runtime errors if Redis is unavailable)

---

## Cross-Cutting Dependencies

```
088 (privilege escalation)
 |
 |-- Couples to 089: rotating JWT secret would invalidate existing admin tokens (AC #3)
 |
089 (JWT secret)
 |
 |-- Should be deployed alongside 088 to invalidate malicious admin tokens
 |
091 (Redis imports)
 |
 |-- Unblocks Redis for payment caching, which 090 may use for its cache layer
 |
090 (payment persistence)
 |
 |-- Benefits from 091 being fixed first (Redis available for cache optimization)
 |-- Benefits from 089 being stable (consistent auth for payment APIs)
```

### Recommended Fix Dependency Order

1. **088 + 089 together** (or 088 first, 089 immediately after) -- deploying 089's new JWT_SECRET will invalidate all tokens including any malicious admin tokens, satisfying AC #3 of 088
2. **091** -- quick fix, unblocks Redis across 7 services
3. **090** -- largest change, benefits from Redis (091) being available

---

## Summary Scorecard

| Finding   | ACs Total | PASS   | PARTIAL | FAIL  | Missing Reqs |
| --------- | --------- | ------ | ------- | ----- | ------------ |
| 088       | 5         | 4      | 1       | 0     | 3            |
| 089       | 6         | 6      | 0       | 0     | 2            |
| 090       | 8         | 7      | 1       | 0     | 4            |
| 091       | 8         | 6      | 2       | 0     | 3            |
| **Total** | **27**    | **23** | **4**   | **0** | **12**       |

**Overall Assessment**: The findings are all legitimate and well-documented. 23 of 27 acceptance criteria are clear and testable. The 4 PARTIAL criteria need minor rewording or clarification. 12 missing requirements identified -- most are edge case definitions that the implementation team needs before coding. The most critical defect is **MR-091-1** (wrong file list), which would cause the fix to miss 6 of 7 affected files.
