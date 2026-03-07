# P2 Remediation Sprint R8: Definition of Done

**Sprint Scope**: 12 P2 findings from Round 8 code review (todos 111, 119-129)
**Priority**: All P2
**Created**: 2026-02-15
**Product Owner**: product-owner agent

---

## Sprint-Level Definition of Done

The sprint is **DONE** when:

1. All 12 P2 findings have every criterion at PASS
2. All existing backend tests continue to pass after changes
3. No new P1/P2 findings introduced by the fixes (verified by review)
4. Backend server starts and responds to health check after all changes
5. `npm run lint` passes with no new errors
6. All todo files updated with final status (PASS/FAIL/DEFERRED)

---

## P2 Findings

### Todo 111: Frontend Test Suite -- 158 Pre-Existing Failures Block Pre-Commit Hook

| #   | Criterion                                                                        | Status  | Evidence |
| --- | -------------------------------------------------------------------------------- | ------- | -------- |
| 1   | Pre-commit hook passes without `--no-verify` for backend-only changes            | PENDING |          |
| 2   | Frontend test suites either fixed or excluded from pre-commit run                | PENDING |          |
| 3   | CI pipeline still runs the full test suite (frontend + backend)                  | PENDING |          |
| 4   | No regression in backend test coverage (all 59 passing suites still pass)        | PENDING |          |
| 5   | `.husky/pre-commit` script updated to separate backend tests from frontend tests | PENDING |          |
| 6   | ESLint and Prettier checks still run in pre-commit (not bypassed)                | PENDING |          |

**Edge Cases:**

- Developer modifies both frontend and backend files in one commit -- pre-commit must still pass for backend portion
- Pre-commit hook called with no staged files (should not fail)
- Jest config changes do not accidentally exclude backend test suites

**Risk:** medium -- Modifying test runner config or pre-commit hook could inadvertently exclude valid backend tests or break CI

---

### Todo 119: User Relationship API 87% Missing -- 13 of 15 Operations Not Exposed

| #   | Criterion                                                                                                               | Status  | Evidence |
| --- | ----------------------------------------------------------------------------------------------------------------------- | ------- | -------- |
| 1   | Block/unblock endpoints exist at `POST /v1/users/:id/block` and `DELETE /v1/users/:id/block`                            | PENDING |          |
| 2   | Mute/unmute endpoints exist at `POST /v1/users/:id/mute` and `DELETE /v1/users/:id/mute`                                | PENDING |          |
| 3   | `GET /v1/users/:id/followers` and `GET /v1/users/:id/following` return paginated lists                                  | PENDING |          |
| 4   | `GET /v1/users/:id/blocked` returns list of blocked users (owner-only)                                                  | PENDING |          |
| 5   | `GET /v1/users/:id/relationships/stats` returns relationship statistics                                                 | PENDING |          |
| 6   | Friend request endpoints exist: `POST /v1/users/:id/friend-request`, `PUT /v1/users/:id/friend-request` (accept/reject) | PENDING |          |
| 7   | `GET /v1/users/:id/recommendations` returns user recommendations                                                        | PENDING |          |
| 8   | Export/import endpoints: `GET /v1/users/:id/relationships/export`, `POST /v1/users/:id/follows/import`                  | PENDING |          |
| 9   | Privacy settings: `PUT /v1/users/:id/privacy-settings`                                                                  | PENDING |          |
| 10  | `GetRelationshipsSchema` validator wired to the followers/following route                                               | PENDING |          |
| 11  | All new endpoints require authentication middleware                                                                     | PENDING |          |
| 12  | All new endpoints have integration tests                                                                                | PENDING |          |

**Edge Cases:**

- User tries to block themselves (should return 400)
- User tries to follow a user who has blocked them (should return 403)
- Pagination with zero results returns empty array, not error
- Import follows with invalid user IDs in payload -- should return partial success or 400
- Privacy settings update by non-owner (should return 403)

**Risk:** medium -- Large surface area (13 new endpoints) increases chance of missing auth checks or inconsistent response envelopes

---

### Todo 120: Payment API Gaps -- Transaction History, Balance, Webhook CRUD, Retry, Invoice List Missing

| #   | Criterion                                                                                                       | Status  | Evidence |
| --- | --------------------------------------------------------------------------------------------------------------- | ------- | -------- |
| 1   | `GET /v1/payments/transactions` returns paginated transaction history using `GetTransactionHistorySchema`       | PENDING |          |
| 2   | `GET /v1/payments/balance` returns user balance using `GetBalanceSchema`                                        | PENDING |          |
| 3   | `PUT /v1/payments/webhooks/:id` updates webhook config using `UpdateWebhookSchema`                              | PENDING |          |
| 4   | `DELETE /v1/payments/webhooks/:id` removes webhook using `DeleteWebhookSchema`                                  | PENDING |          |
| 5   | `GET /v1/payments/invoices` returns paginated invoice list                                                      | PENDING |          |
| 6   | `POST /v1/payments/invoices/:id/retry` triggers manual retry via `PaymentRetryService.manualRetry()`            | PENDING |          |
| 7   | `GET /v1/payments/invoices/:id/retry-history` returns retry history via `PaymentRetryService.getRetryHistory()` | PENDING |          |
| 8   | `GET /v1/payments/metrics/retries` returns retry metrics via `PaymentRetryService.getRetryMetrics()`            | PENDING |          |
| 9   | All new endpoints require authentication middleware                                                             | PENDING |          |
| 10  | All new endpoints have integration tests                                                                        | PENDING |          |

**Edge Cases:**

- Transaction history for user with zero transactions returns empty array
- Balance query for non-existent user returns 404
- Webhook update with invalid URL format returns 400
- Retry on already-succeeded invoice returns 409 Conflict
- Invoice list pagination with out-of-range page returns empty array, not error
- Metrics endpoint returns zeroed metrics for new system (not error)

**Risk:** medium -- Payment endpoints are security-sensitive; missing auth on any route is a P1

---

### Todo 121: Auth Middleware authorize() Bypasses Centralized Error Handler

| #   | Criterion                                                                                                                     | Status  | Evidence |
| --- | ----------------------------------------------------------------------------------------------------------------------------- | ------- | -------- |
| 1   | `authorize()` calls `next(error)` instead of `res.status().json()` for all error paths (lines 73, 80, 85)                     | PENDING |          |
| 2   | `requireNostrSignature()` calls `next(error)` instead of `res.status().json()` for all error paths (lines 147, 157, 178, 191) | PENDING |          |
| 3   | `requireOwnership()` calls `next(error)` instead of `res.status().json()`                                                     | PENDING |          |
| 4   | All auth error responses include `metadata.requestId` and `metadata.timestamp` fields                                         | PENDING |          |
| 5   | Error response shape from auth middleware matches centralized error handler shape exactly                                     | PENDING |          |
| 6   | Existing `authenticate()` behavior unchanged (already uses `next(error)`)                                                     | PENDING |          |
| 7   | Tests verify auth error responses contain requestId and timestamp                                                             | PENDING |          |

**Edge Cases:**

- Middleware that calls `next(error)` with a non-AppError object -- centralized handler must still produce valid envelope
- Multiple auth middleware chained (authenticate + authorize) -- first failure short-circuits correctly
- Error handler receives auth error during shutdown -- should still format correctly

**Risk:** low -- Straightforward refactor replacing direct response writes with `next(error)` calls; error handler already handles these error types

---

### Todo 122: Response Envelope Inconsistency -- ContentController Has metadata, Others Don't

| #   | Criterion                                                                                                          | Status  | Evidence |
| --- | ------------------------------------------------------------------------------------------------------------------ | ------- | -------- |
| 1   | Shared `createApiResponse()` helper function exists and is exported                                                | PENDING |          |
| 2   | `createApiResponse()` includes `success`, `data`, and `metadata` (with `requestId`, `timestamp`, `processingTime`) | PENDING |          |
| 3   | PaymentController uses `createApiResponse()` for all success responses                                             | PENDING |          |
| 4   | UserController uses `createApiResponse()` for all success responses                                                | PENDING |          |
| 5   | ContentController uses `createApiResponse()` (refactored from inline metadata)                                     | PENDING |          |
| 6   | All controller success responses have identical envelope shape                                                     | PENDING |          |
| 7   | Tests verify envelope shape consistency across at least one endpoint per controller                                | PENDING |          |

**Edge Cases:**

- Response with `null` data field (e.g., DELETE operations) -- envelope should still include metadata
- Response with array data vs object data -- both wrapped consistently
- processingTime accuracy when request handler is very fast (<1ms)
- Streaming or large responses -- metadata still present

**Risk:** low -- Additive change (adding metadata to responses), no removal of existing fields

---

### Todo 123: Payment File Corruption -- Silent Data Loss Without Backup or Alert

| #   | Criterion                                                                                                          | Status  | Evidence |
| --- | ------------------------------------------------------------------------------------------------------------------ | ------- | -------- |
| 1   | When `loadFromDisk` encounters corrupted JSON, the corrupted file is renamed to `{filename}.corrupted.{timestamp}` | PENDING |          |
| 2   | Corruption detection emits a structured log at `error` level with file path and error details                      | PENDING |          |
| 3   | Health check endpoint reports degraded status when corruption is detected                                          | PENDING |          |
| 4   | After backup, system starts with empty state (current behavior preserved)                                          | PENDING |          |
| 5   | Corrupted backup file is not overwritten by subsequent saves                                                       | PENDING |          |
| 6   | Test: simulate corrupted JSON file, verify backup created and error logged                                         | PENDING |          |

**Edge Cases:**

- Multiple corruptions in rapid succession -- each gets unique timestamp suffix
- Corrupted file is zero bytes (empty file) -- should be treated as corruption, not empty state
- Disk full when trying to rename corrupted file -- should log error but not crash
- Permission denied on rename -- should log error but still start with empty state

**Risk:** medium -- Modifying file I/O in payment persistence requires careful handling to avoid introducing new data loss paths

---

### Todo 124: Unbounded In-Memory Caches -- subscriptionCache and transactionCache Never Evict

| #   | Criterion                                                                                                        | Status  | Evidence |
| --- | ---------------------------------------------------------------------------------------------------------------- | ------- | -------- |
| 1   | `subscriptionCache` in `subscription-management-service.ts` replaced with TTLCache (or equivalent bounded cache) | PENDING |          |
| 2   | `transactionCache` in `transaction-history-service.ts` replaced with TTLCache (or equivalent bounded cache)      | PENDING |          |
| 3   | Both caches have explicit `maxSize` configuration (e.g., 10,000 entries)                                         | PENDING |          |
| 4   | Both caches have TTL configuration (e.g., 15-30 minutes)                                                         | PENDING |          |
| 5   | Cache eviction works correctly (oldest/least-used entries removed when full)                                     | PENDING |          |
| 6   | Test: insert maxSize+1 entries, verify oldest entry evicted                                                      | PENDING |          |
| 7   | Test: verify entry expires after TTL                                                                             | PENDING |          |

**Edge Cases:**

- Cache miss after eviction falls through to persistence layer correctly
- Concurrent reads during eviction do not throw
- Cache clear on shutdown does not leave dangling references
- TTL expiry during active read returns fresh data (not stale)

**Risk:** low -- TTLCache utility already exists in the codebase (`utils/ttl-cache.ts`); straightforward replacement

---

### Todo 125: Hardcoded Receipt Signing Secret Fallback -- Receipt Forgery Risk

| #   | Criterion                                                                                                                               | Status  | Evidence |
| --- | --------------------------------------------------------------------------------------------------------------------------------------- | ------- | -------- |
| 1   | No hardcoded fallback string for `RECEIPT_SIGNATURE_SECRET` in `receipt-service.ts`                                                     | PENDING |          |
| 2   | Production startup throws error if `RECEIPT_SIGNATURE_SECRET` env var is not set                                                        | PENDING |          |
| 3   | Non-production (NODE_ENV !== 'production') uses a clearly-marked dev-only secret (e.g., `'DEV-ONLY-receipt-secret-DO-NOT-USE-IN-PROD'`) | PENDING |          |
| 4   | Error message on missing secret is descriptive: includes env var name and instructions                                                  | PENDING |          |
| 5   | Test: verify startup fails when NODE_ENV=production and RECEIPT_SIGNATURE_SECRET is unset                                               | PENDING |          |
| 6   | Test: verify dev environment starts successfully without the env var                                                                    | PENDING |          |

**Edge Cases:**

- `RECEIPT_SIGNATURE_SECRET` set to empty string -- should be treated as unset
- `RECEIPT_SIGNATURE_SECRET` set to very short value (< 32 chars) -- should warn about weak secret
- Secret rotation: changing the secret invalidates all existing receipts -- document this in code comments
- Test environment should not require the production secret

**Risk:** low -- Small, targeted change with clear security benefit. Risk of breaking dev environments if fallback not handled for non-production

---

### Todo 126: Duplicate Shutdown Signal Handlers -- server.ts and bootstrap.ts Both Register SIGTERM/SIGINT

| #   | Criterion                                                                                                     | Status  | Evidence |
| --- | ------------------------------------------------------------------------------------------------------------- | ------- | -------- |
| 1   | Only ONE file registers SIGTERM/SIGINT handlers (consolidate to `server.ts`)                                  | PENDING |          |
| 2   | `bootstrap.ts` shutdown handler removed or delegates to server.ts                                             | PENDING |          |
| 3   | Shutdown sequence: stop accepting connections -> drain in-flight requests -> close DB -> close caches -> exit | PENDING |          |
| 4   | Resources cleaned up exactly once (no double-close of server, DB, or caches)                                  | PENDING |          |
| 5   | Shutdown completes within timeout (e.g., 30s) with forced exit on timeout                                     | PENDING |          |
| 6   | Test: verify `process.listenerCount('SIGTERM')` is 1 after server startup                                     | PENDING |          |

**Edge Cases:**

- SIGTERM received during startup (before server is fully initialized) -- should exit cleanly
- SIGTERM received twice rapidly -- second signal should force immediate exit
- Shutdown handler throws an error -- should still exit (not hang)
- Child processes spawned by server -- should be terminated during shutdown

**Risk:** low -- Consolidation change; removing duplicate handler reduces race condition risk

---

### Todo 127: Dual DI System -- inversify Decorators on Custom ServiceContainer

| #   | Criterion                                                                               | Status  | Evidence |
| --- | --------------------------------------------------------------------------------------- | ------- | -------- |
| 1   | All `@injectable()` decorators removed from controllers                                 | PENDING |          |
| 2   | All `@inject(TYPES.X)` decorators removed from constructor parameters                   | PENDING |          |
| 3   | `TYPES` constant object removed or repurposed as plain string keys for custom container | PENDING |          |
| 4   | Custom `ServiceContainer`/`ServiceRegistry` is the single DI mechanism                  | PENDING |          |
| 5   | All controller constructors still receive correct dependencies                          | PENDING |          |
| 6   | `inversify` package removed from dependencies (if no other usage)                       | PENDING |          |
| 7   | ADR documenting the DI architecture choice created in `docs/decisions/`                 | PENDING |          |
| 8   | Test: all controllers instantiable via ServiceContainer with correct dependencies       | PENDING |          |

**Edge Cases:**

- `reflect-metadata` import -- may be needed by other decorators; verify before removing
- Third-party libraries depending on inversify -- grep for all inversify imports before removal
- TYPES used as runtime string keys elsewhere (not just decorator metadata) -- preserve if so
- Removing decorators changes TypeScript compilation output -- verify no runtime behavior change

**Risk:** medium -- Removing DI decorators touches multiple controller files; must verify all dependency injection still works after removal

---

### Todo 128: Dead Code in Error Handler -- handleUnhandledRejections + 4 Dead Error Classes

| #   | Criterion                                                                                                | Status  | Evidence |
| --- | -------------------------------------------------------------------------------------------------------- | ------- | -------- |
| 1   | `handleUnhandledRejections()` either deleted or wired into server startup                                | PENDING |          |
| 2   | `AuthenticationError` class removed from `error-handler-middleware.ts` (duplicate of `utils/errors.ts`)  | PENDING |          |
| 3   | `AuthorizationError` class removed from `error-handler-middleware.ts` (duplicate of `utils/errors.ts`)   | PENDING |          |
| 4   | `DatabaseError` class removed from `error-handler-middleware.ts` (duplicate of `utils/errors.ts`)        | PENDING |          |
| 5   | `ExternalServiceError` class removed from `error-handler-middleware.ts` (duplicate of `utils/errors.ts`) | PENDING |          |
| 6   | `grep -r` confirms zero imports of deleted classes from `error-handler-middleware`                       | PENDING |          |
| 7   | Single source of truth for error classes is `utils/errors.ts`                                            | PENDING |          |
| 8   | All existing tests pass after deletion                                                                   | PENDING |          |

**Edge Cases:**

- Re-exports: `error-handler-middleware.ts` may re-export classes from `utils/errors.ts` -- verify consumers import from correct path
- Test files importing dead classes -- update test imports if needed
- `handleUnhandledRejections` may be referenced in documentation or comments -- clean up references

**Risk:** low -- Deleting confirmed dead code; grep verification ensures no hidden consumers

---

### Todo 129: ServiceError Called With Invalid Options -- Compile Error Masked by tsc Blockage

| #   | Criterion                                                                                   | Status  | Evidence |
| --- | ------------------------------------------------------------------------------------------- | ------- | -------- |
| 1   | `ContentCreationService.ts` lines 82-84 use valid `ServiceErrorOptions` properties          | PENDING |          |
| 2   | `errors` field either added to `ServiceErrorOptions` interface or mapped to `details`       | PENDING |          |
| 3   | All other `ServiceError` usages across the codebase follow consistent pattern               | PENDING |          |
| 4   | `tsc --noEmit` does not report an error for this specific call site (when unblocked)        | PENDING |          |
| 5   | Test: `ContentCreationService` throws ServiceError with correct shape on validation failure | PENDING |          |

**Edge Cases:**

- Other files using `ServiceError` with arbitrary options -- scan for similar invalid usage patterns
- `ServiceErrorOptions` change may affect error serialization in error handler -- verify error handler still extracts fields correctly
- If `errors` is added to the interface, ensure it is typed specifically (e.g., `Array<{field: string, message: string}>`) not `any`

**Risk:** low -- Small fix, either adjust the call site or extend the interface. Low blast radius.

---

## Cross-Cutting Concerns

### Dependency Matrix

| Todo | Depends On                                           | Blocks                                                                    |
| ---- | ---------------------------------------------------- | ------------------------------------------------------------------------- |
| 111  | None                                                 | None                                                                      |
| 119  | 122 (should use createApiResponse for new endpoints) | None                                                                      |
| 120  | 122 (should use createApiResponse for new endpoints) | None                                                                      |
| 121  | None                                                 | 122 (auth errors must go through handler before envelope standardization) |
| 122  | 121 (error handler consistency first)                | 119, 120 (new endpoints should use shared helper)                         |
| 123  | None                                                 | None                                                                      |
| 124  | None                                                 | None                                                                      |
| 125  | None                                                 | None                                                                      |
| 126  | None                                                 | None                                                                      |
| 127  | None                                                 | None                                                                      |
| 128  | None                                                 | None                                                                      |
| 129  | None                                                 | None                                                                      |

### Conflicts Between Fixes

1. **121 + 122**: Both affect API response shape. Fix 121 (auth errors through handler) first, then 122 (standardize success envelope). Otherwise new envelope may need re-adjustment.

2. **119 + 120 + 122**: New endpoints from 119 and 120 should use the `createApiResponse()` helper from 122. Implement 122 first, then 119/120 use it.

3. **128 + 121**: If 128 wires `handleUnhandledRejections` into startup AND 121 changes error flow, verify they don't conflict. Low risk since they operate at different layers (middleware vs global handler).

### Implementation Order (Recommended)

**Wave 1 -- Foundation (no dependencies)**:

1. Todo 111 (pre-commit fix) -- unblocks dev workflow
2. Todo 125 (hardcoded secret) -- security quick win
3. Todo 126 (duplicate shutdown) -- reliability quick win
4. Todo 128 (dead code removal) -- cleanup, reduces confusion
5. Todo 129 (ServiceError fix) -- small type fix

**Wave 2 -- API Consistency (ordered)**: 6. Todo 121 (auth error handler) -- must be before 122 7. Todo 122 (response envelope) -- must be before 119/120

**Wave 3 -- API Expansion (uses envelope from 122)**: 8. Todo 119 (user relationship API) 9. Todo 120 (payment API gaps)

**Wave 4 -- Performance/Architecture**: 10. Todo 123 (payment file corruption) 11. Todo 124 (unbounded caches) 12. Todo 127 (dual DI system)

---

## Verification Checklist (Sprint Completion Gate)

- [ ] All 12 P2 findings: every criterion PASS
- [ ] `npm test` passes (all existing tests)
- [ ] `npm run lint` passes
- [ ] Backend server starts successfully
- [ ] Health check endpoint responds 200
- [ ] No new P1/P2 findings from post-sprint review
- [ ] All todo files updated with final status
- [ ] Pre-commit hook works without `--no-verify` (todo 111 verification)
