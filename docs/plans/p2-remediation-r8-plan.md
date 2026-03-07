# P2 Remediation Round 8 — Architecture Plan

**Date**: 2026-02-15
**Branch**: feature/US-007-error-boundaries-rebased (PR #73)
**Scope**: 12 pending P2 findings from code review round 6
**Author**: Architect Agent
**Status**: APPROVED by Product Owner (2026-02-15) with implementation notes below
**DoD**: `/docs/plans/p2-remediation-r8-dod.md`

---

## Executive Summary

12 P2 findings remain from PR #73 review. They span six categories: API gaps (119, 120), error handling consistency (121, 122, 128, 129), data integrity (123), memory safety (124), security (125), architecture cleanup (126, 127), and test infrastructure (111). This plan organizes them into 4 batches ordered by dependency, risk, and blast radius.

---

## Batch Ordering (Aligned with Product Owner DoD)

### Wave 1: Foundation (No Dependencies, All Parallel)

These fixes are self-contained, touch isolated files, and have no inter-dependencies. They can all be implemented in parallel. Fixes 111 and 125 unblock dev workflow and security respectively.

| Todo | Title                                             | Files Affected                               | Risk     |
| ---- | ------------------------------------------------- | -------------------------------------------- | -------- |
| 111  | Frontend test suite 158 failures (pre-commit fix) | `.husky/pre-commit`, `package.json`          | Medium   |
| 125  | Hardcoded receipt signing secret                  | `services/lightning/receipt-service.ts`      | Low      |
| 126  | Duplicate shutdown handlers                       | `bootstrap.ts`, `server.ts`                  | Low      |
| 128  | Dead code in error-handler-middleware             | `middleware/error-handler-middleware.ts`     | Very Low |
| 129  | ServiceError invalid options                      | `services/content/ContentCreationService.ts` | Very Low |

### Wave 2: API Consistency (Sequential: 121 then 122)

Todo 121 (auth middleware) and 122 (response envelope) are coupled: fixing auth middleware to use `next(error)` depends on understanding the error handler's response shape, and the response envelope helper (122) provides the standardized shape. Fix 121 first, then 122. **122 must be done before Wave 3** so new endpoints use `createApiResponse()` from day one.

| Todo | Title                                  | Files Affected                                                                                                                                              | Risk       |
| ---- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| 121  | Auth middleware bypasses error handler | `middleware/auth.ts`, `utils/errors.ts`                                                                                                                     | Low        |
| 122  | Response envelope inconsistency        | `utils/api-response.ts` (NEW), `controllers/payment/PaymentController.ts`, `controllers/user/UserController.ts`, `controllers/content/ContentController.ts` | Low-Medium |

### Wave 3: API Expansion (Depends on Wave 2 -- uses createApiResponse)

New endpoints from 119 and 120 should use the `createApiResponse()` helper established in Wave 2. This prevents introducing new envelope inconsistency.

| Todo | Title                             | Files Affected                                                                                           | Risk   |
| ---- | --------------------------------- | -------------------------------------------------------------------------------------------------------- | ------ |
| 119  | User relationship API 87% missing | `routes/v1/user.routes.ts`, `controllers/user/UserController.ts`, `validators/user/index.ts`             | Medium |
| 120  | Payment API gaps                  | `routes/v1/payment.routes.ts`, `controllers/payment/PaymentController.ts`, `validators/payment/index.ts` | Medium |

### Wave 4: Performance / Architecture (Independent, Do Last)

These can be done in parallel. 127 (DI cleanup) touches controller files also modified in Wave 2/3, so do it last to avoid merge conflicts.

| Todo | Title                                     | Files Affected                                                                           | Risk       |
| ---- | ----------------------------------------- | ---------------------------------------------------------------------------------------- | ---------- |
| 123  | Payment file corruption silent loss       | `services/payment-persistence.ts`                                                        | Low-Medium |
| 124  | Unbounded subscription/transaction caches | `services/subscription-management-service.ts`, `services/transaction-history-service.ts` | Low        |
| 127  | Dual DI system (inversify + custom)       | `controllers/**/*.ts`, `services/content/ContentCreationService.ts`                      | Medium     |

---

## Architectural Approach Per Fix

### 128: Dead Code in Error Handler

**Problem**: `handleUnhandledRejections()` function and 4 error classes (`AuthenticationError`, `AuthorizationError`, `DatabaseError`, `ExternalServiceError`) in `error-handler-middleware.ts` are defined but never imported elsewhere.

**Approach**: Delete `handleUnhandledRejections()` (lines 306-324) entirely. `server.ts` already registers its own `uncaughtException` and `unhandledRejection` handlers (lines 296-308) that use the structured logger, so this function is redundant. For the 4 error classes: `AuthenticationError` and `AuthorizationError` duplicate equivalent classes in `utils/errors.ts` (`UnauthorizedError`). `DatabaseError` and `ExternalServiceError` are not used anywhere. However, `RateLimitError` at line 33 IS used by the rate-limit middleware, so keep it. Run `grep` to verify no imports of the dead classes before deleting.

**Before**: 5 error classes + `handleUnhandledRejections` in error-handler-middleware.ts
**After**: Only `RateLimitError` remains (if used), dead function and unused classes removed. Re-exports from `utils/errors.ts` continue to work.

**Files**: `packages/backend/src/middleware/error-handler-middleware.ts`

---

### 129: ServiceError Called With Invalid Options

**Problem**: `ContentCreationService.ts` line 82-84 calls `throw new ServiceError('Content validation failed', { errors: validation.errors })`. The `ServiceErrorOptions` interface in `utils/errors.ts` has `cause`, `context`, and `details` — but NOT `errors`. The extra property is silently ignored at runtime.

**Approach**: Change `{ errors: validation.errors }` to `{ details: { errors: validation.errors } }`. This uses the valid `details` field and preserves the error information. Do NOT extend `ServiceErrorOptions` to add an `errors` field — keeping the interface tight prevents future misuse.

**Before**: `throw new ServiceError('Content validation failed', { errors: validation.errors })`
**After**: `throw new ServiceError('Content validation failed', { details: { errors: validation.errors } })`

**Files**: `packages/backend/src/services/content/ContentCreationService.ts` (line 82-84)

---

### 125: Hardcoded Receipt Signing Secret

**Problem**: `receipt-service.ts` line 679 uses `process.env.RECEIPT_SIGNATURE_SECRET || 'sovren-receipt-secret'`. The fallback allows receipt forgery in dev/misconfigured environments.

**Approach**: Follow the same pattern as `AppConfig.jwtSecret` in `app.ts` (lines 283-291): throw in production if not set, log a warning in development with a clearly-marked dev-only value. Specifically:

1. Replace the inline fallback with a function that throws in production
2. In dev/test, use a constant like `'DEV-ONLY-receipt-secret-DO-NOT-USE-IN-PRODUCTION'`
3. Log a warning when using the dev fallback

**Before**: `const secret = process.env.RECEIPT_SIGNATURE_SECRET || 'sovren-receipt-secret';`
**After**: Production throws if env var missing; dev uses clearly-marked dev secret with warning.

**Files**: `packages/backend/src/services/lightning/receipt-service.ts` (line 679)

---

### 126: Duplicate Shutdown Handlers

**Problem**: Both `server.ts` (lines 314-315) and `bootstrap.ts` `setupGracefulShutdown()` (lines 396-397) register SIGTERM/SIGINT handlers. Two handlers fire on the same signal, potentially causing race conditions (double-close server, double-dispose container).

**Approach**: Remove `setupGracefulShutdown()` from `bootstrap.ts` and set `gracefulShutdown: false` in the bootstrap config when called from `server.ts`. The `server.ts` handler is the authoritative one — it owns the HTTP server lifecycle, Redis disconnect, and process exit. The bootstrap container's `dispose()` should be called FROM `server.ts`'s shutdown handler rather than from a separate signal handler. Add `container.dispose()` call to the `gracefulShutdown()` function in `server.ts`.

**Before**: Two SIGTERM/SIGINT handlers (server.ts + bootstrap.ts)
**After**: Single handler in server.ts that calls container.dispose() before exiting

**Files**: `packages/backend/src/bootstrap.ts` (remove setupGracefulShutdown or set gracefulShutdown: false), `packages/backend/src/server.ts` (add container.dispose() to gracefulShutdown)

---

### 121: Auth Middleware Bypasses Error Handler

**Problem**: `authorize()`, `requireNostrSignature()`, and `requireOwnership()` in `auth.ts` write responses directly via `res.status().json()` instead of calling `next(error)`. This means auth errors lack `metadata.requestId`, `metadata.timestamp`, and have inconsistent error shapes.

**Approach**: Replace all `res.status(N).json({...})` calls with `next(new AppError(...))` or the appropriate error class from `utils/errors.ts`:

- `res.status(401)` calls -> `next(new UnauthorizedError('message'))`
- `res.status(403)` calls -> `next(new AppError(403, 'AUTHORIZATION_ERROR', 'message'))`
- `res.status(400)` calls -> `next(new ValidationError('message'))`
- `res.status(500)` calls -> `next(new ServiceError('message'))`

The error handler middleware already formats these consistently with requestId and timestamp. Import `UnauthorizedError`, `ValidationError`, `ServiceError` from `utils/errors.ts`. For 403 errors, there's no `AuthorizationError` in `utils/errors.ts` (the one in error-handler-middleware is dead code per 128), so either: (a) add one to utils/errors.ts, or (b) use `new AppError(403, 'AUTHORIZATION_ERROR', msg)` directly.

**Decision**: Add an `AuthorizationError` class to `utils/errors.ts` for clean semantics. It's 4 lines of code and prevents raw AppError construction everywhere.

**Before**: `res.status(401).json({ error: '...' })` (8 occurrences across authorize, requireNostrSignature, requireOwnership)
**After**: `next(new UnauthorizedError('...'))` / `next(new AuthorizationError('...'))` — all go through centralized error handler

**Files**: `packages/backend/src/middleware/auth.ts`, `packages/backend/src/utils/errors.ts` (add AuthorizationError)

---

### 122: Response Envelope Inconsistency

**Problem**: `ContentController` returns `{ success, data, metadata: { requestId, timestamp, processingTime } }`. `PaymentController` and `UserController` return only `{ success: true, data: {...} }`. Machine clients can't rely on consistent shape.

**Approach**: Create a shared `createApiResponse(req, data, startTime?)` helper that builds the consistent envelope:

```typescript
function createApiResponse<T>(req: Request, data: T, startTime?: number) {
  return {
    success: true,
    data,
    metadata: {
      requestId: getCorrelationId(),
      timestamp: new Date().toISOString(),
      ...(startTime && { processingTime: Date.now() - startTime }),
    },
  };
}
```

Place this in a new `utils/api-response.ts` file or in the existing `error-handler-middleware.ts` (since it already deals with response formatting). Then update `PaymentController` and `UserController` to use it. `ContentController` already has the metadata; refactor it to use the shared helper for consistency.

**Decision**: Create `packages/backend/src/utils/api-response.ts` as a small focused utility. This keeps it separate from error handling concerns.

**Before**: PaymentController: `res.json({ success: true, data: invoice })`
**After**: PaymentController: `res.json(createApiResponse(req, invoice))`

**Files**: New `packages/backend/src/utils/api-response.ts`, `controllers/payment/PaymentController.ts`, `controllers/user/UserController.ts`, `controllers/content/ContentController.ts`

---

### 123: Payment File Corruption — Silent Loss

**Problem**: `payment-persistence.ts` `loadFromDisk` already has corruption recovery (backs up corrupted files to `.corrupted.{timestamp}` and recovers from `.tmp`). However, the `console.error` logging doesn't integrate with the structured logger, and there's no health check failure or operator alerting.

**Approach**: Looking at the actual code (lines 89-120), the corruption recovery is already partially implemented from a previous P1 fix. What's missing:

1. Replace `console.error` with `logger.error` (structured logging)
2. Add a `corrupted` flag on the service that health checks can query
3. Emit an event when corruption is detected (for operator alerting)

**Before**: `console.error('[PaymentPersistence] Recovered ...')` — no structured log, no health check impact
**After**: `logger.error('Payment data corruption detected', { type, action: 'recovered_from_tmp' })`, `this.corruptionDetected = true`, emit `corruption:detected` event

**Files**: `packages/backend/src/services/payment-persistence.ts`

---

### 124: Unbounded Subscription/Transaction Caches

**Problem**: `subscriptionCache` (subscription-management-service.ts:130) and `transactionCache` (transaction-history-service.ts:134) are plain `Map<string, T>` with no eviction. Memory grows linearly.

**Approach**: Replace both Maps with `TTLCache` from `utils/ttl-cache.ts` (already exists in the codebase). Use reasonable defaults:

- `subscriptionCache`: `maxSize: 10_000, ttlMs: 5 * 60 * 1000` (5 min TTL, 10K cap)
- `transactionCache`: `maxSize: 50_000, ttlMs: 10 * 60 * 1000` (10 min TTL, 50K cap — transactions are read-heavy)

The `TTLCache` API matches `Map` for `get`/`set`/`has`/`delete`, so the change is minimal. The `TTLCache` constructor also accepts an `onEvict` callback for logging/metrics.

**Before**: `private subscriptionCache: Map<string, Subscription> = new Map();`
**After**: `private subscriptionCache = new TTLCache<string, Subscription>({ maxSize: 10_000, ttlMs: 300_000 });`

**Files**: `packages/backend/src/services/subscription-management-service.ts`, `packages/backend/src/services/transaction-history-service.ts`

---

### 127: Dual DI System (inversify + custom ServiceContainer)

**Problem**: Controllers use `@injectable()` and `@inject(TYPES.X)` from inversify, but the actual container is a custom `ServiceContainer` (see `container/ServiceContainer.ts`). The inversify decorators are metadata-only — the custom container ignores them. Constructor injection works by coincidence via lazy `getController()` in route files.

**Approach**: Option A — Remove inversify decorators. The custom container works correctly and is simpler. Inversify adds ~100KB to the bundle for zero functional benefit. Steps:

1. Remove `@injectable()` decorator from all 3 controllers + ContentCreationService
2. Remove all `@inject(TYPES.X)` decorators from constructor parameters
3. Remove `inversify` imports from controller files
4. Keep the constructor parameters (the custom container passes them via factory functions in binding modules)
5. Verify `inversify` is only used in controllers (if used elsewhere, adjust scope)
6. Grep for `reflect-metadata` usage — may be needed by other decorators; preserve if so
7. Remove `inversify` package from dependencies if no other usage found (per PO DoD criterion 6)
8. Create ADR in `docs/decisions/` documenting the DI architecture choice (per PO DoD criterion 7)

**Before**: `@injectable() export class PaymentController { constructor(@inject(TYPES.PaymentProcessingService) private paymentService: ...) }`
**After**: `export class PaymentController { constructor(private paymentService: PaymentProcessingService, ...) }`

**Files**: `controllers/payment/PaymentController.ts`, `controllers/user/UserController.ts`, `controllers/content/ContentController.ts`, `services/content/ContentCreationService.ts`

---

### 119: User Relationship API — 87% Missing

**Problem**: `UserRelationshipService` has 15+ methods but only `followUser` and `unfollowUser` are exposed. Missing: block, unblock, mute, unmute, getFollowers, getFollowing, getBlockedUsers, getRelationshipStats, and more.

**Approach**: Expose all 13 missing operations per PO DoD. Route naming follows RESTful conventions with `:id` for the target user. All new endpoints require `authenticate` middleware. Use `createApiResponse()` from todo 122 for all responses.

Routes to add to `user.routes.ts`:

1. `POST /users/:id/block` — block user (safety-critical)
2. `DELETE /users/:id/block` — unblock user
3. `POST /users/:id/mute` — mute user (safety-critical)
4. `DELETE /users/:id/mute` — unmute user
5. `GET /users/:id/followers` — paginated followers list
6. `GET /users/:id/following` — paginated following list
7. `GET /users/:id/blocked` — blocked users (owner-only)
8. `GET /users/:id/relationships/stats` — relationship statistics
9. `POST /users/:id/friend-request` — send friend request
10. `PUT /users/:id/friend-request` — accept/reject friend request
11. `GET /users/:id/recommendations` — user recommendations
12. `GET /users/:id/relationships/export` — export relationships
13. `POST /users/:id/follows/import` — import follows
14. `PUT /users/:id/privacy-settings` — update privacy settings

Wire the existing `GetRelationshipsSchema` validator to followers/following routes. Add corresponding methods to `UserController` that delegate to `UserRelationshipService`. May need new validators for block, mute, friend-request, import, and privacy-settings bodies.

**Edge cases from PO DoD**:

- User tries to block themselves -> 400
- User follows someone who blocked them -> 403
- Pagination with zero results -> empty array, not error
- Import with invalid user IDs -> 400
- Privacy settings update by non-owner -> 403

**Files**: `routes/v1/user.routes.ts`, `controllers/user/UserController.ts`, `validators/user/index.ts` (may need new validators)

---

### 120: Payment API Gaps

**Problem**: Multiple payment validators exist without routes: transaction history, balance, webhook CRUD, retry, invoice list.

**Approach**: Wire the existing validators to new routes in `payment.routes.ts`. All new endpoints require `authenticate` middleware. Use `createApiResponse()` from todo 122 for all responses.

Routes to add:

1. `GET /payments/transactions` — transaction history with `GetTransactionHistorySchema`
2. `GET /payments/balance` — user balance with `GetBalanceSchema`
3. `PUT /payments/webhooks/:id` — update webhook with `UpdateWebhookSchema` + `requireNostrSignature`
4. `DELETE /payments/webhooks/:id` — delete webhook with `DeleteWebhookSchema` + `requireNostrSignature`
5. `GET /payments/invoices` — list invoices with pagination
6. `POST /payments/invoices/:id/retry` — manual payment retry via `PaymentRetryService.manualRetry()`
7. `GET /payments/invoices/:id/retry-history` — retry history via `PaymentRetryService.getRetryHistory()`
8. `GET /payments/metrics/retries` — retry metrics via `PaymentRetryService.getRetryMetrics()` (admin only via `requireAdmin`)

Add corresponding controller methods to `PaymentController`. The service methods already exist in `PaymentRetryService` and other services.

**Edge cases from PO DoD**:

- Transaction history for user with zero transactions -> empty array
- Balance query for non-existent user -> 404
- Webhook update with invalid URL format -> 400
- Retry on already-succeeded invoice -> 409 Conflict
- Invoice list pagination with out-of-range page -> empty array, not error
- Metrics endpoint returns zeroed metrics for new system, not error

**Files**: `routes/v1/payment.routes.ts`, `controllers/payment/PaymentController.ts`, `validators/payment/index.ts` (may need new validators for invoice list)

---

### 111: Frontend Test Suite — 158 Failures

**Problem**: 158 frontend test suites fail due to pre-existing config issues (vitest/jest mismatch, import.meta, missing modules, etc.), forcing `--no-verify` on every commit.

**Approach**: Option C (quick fix) as recommended by the todo: exclude frontend tests from pre-commit hook, keep them in CI only. This is the right call for a P2 remediation sprint — fixing 158 test suites is a separate project.

Steps:

1. Modify `.husky/pre-commit` to run backend tests only: change `npm test:ci` to `npm run test:unit -- --selectProjects backend shared`
2. Or create a `test:pre-commit` script in package.json that runs only backend + shared tests
3. Keep `npm test:ci` in CI pipeline for full coverage

The proper fix (Option A: fix Jest config or Option B: adopt Vitest for frontend) should be a dedicated follow-up ticket.

**Files**: `.husky/pre-commit`, `package.json` (add test:pre-commit script)

---

## Dependency Graph

```
Wave 1 (parallel, no deps):
  111 ─┐
  125 ─┤ All independent — do first
  126 ─┤
  128 ─┤
  129 ─┘

Wave 2 (sequential):
  121 → 122
  (121 adds AuthorizationError to utils/errors.ts; 122 creates api-response helper)

Wave 3 (depends on Wave 2):
  122 → 119 (new user endpoints use createApiResponse)
  122 → 120 (new payment endpoints use createApiResponse)

Wave 4 (independent, do last):
  123 (persistence corruption handling)
  124 (bounded caches)
  127 (DI cleanup — touches same controller files as Wave 2/3)
```

**Cross-wave dependencies**:

- 119 and 120 depend on 122 so new endpoints use `createApiResponse()` from the start (per PO DoD dependency matrix)
- 121 must precede 122 so auth errors flow through centralized handler before envelope standardization
- 127 (removing inversify decorators) touches the same controller files as 122 and 119/120. Do 127 last to avoid merge conflicts.

---

## Risk Assessment

| Risk                                            | Impact | Mitigation                                                                                                                              |
| ----------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 121: Auth errors break existing clients         | Medium | Auth error shape changes from `{ error, code }` to `{ success: false, error, code, metadata }`. Clients may depend on old shape.        | Test with existing integration tests. Announce breaking change in CHANGELOG. |
| 122: Response envelope change breaks clients    | Medium | Adding `metadata` field is additive, not breaking. Clients ignoring extra fields are unaffected.                                        |
| 127: Removing decorators breaks DI              | Low    | Custom container doesn't use decorators. Verified by reading ServiceContainer.ts — it uses factory functions, not inversify reflection. |
| 119/120: New routes don't match service methods | Medium | Verify each controller method delegates to existing service. Use grep to confirm service method signatures.                             |
| 111: Pre-commit change misses regressions       | Low    | CI still runs full suite. Pre-commit runs backend + shared tests.                                                                       |

---

## Files Affected Summary

| File                                          | Todos                        |
| --------------------------------------------- | ---------------------------- |
| `middleware/error-handler-middleware.ts`      | 128                          |
| `middleware/auth.ts`                          | 121                          |
| `utils/errors.ts`                             | 121 (add AuthorizationError) |
| `utils/api-response.ts` (NEW)                 | 122                          |
| `controllers/payment/PaymentController.ts`    | 122, 127                     |
| `controllers/user/UserController.ts`          | 122, 127                     |
| `controllers/content/ContentController.ts`    | 122, 127                     |
| `services/content/ContentCreationService.ts`  | 129, 127                     |
| `services/lightning/receipt-service.ts`       | 125                          |
| `services/payment-persistence.ts`             | 123                          |
| `services/subscription-management-service.ts` | 124                          |
| `services/transaction-history-service.ts`     | 124                          |
| `bootstrap.ts`                                | 126                          |
| `server.ts`                                   | 126                          |
| `routes/v1/user.routes.ts`                    | 119                          |
| `routes/v1/payment.routes.ts`                 | 120                          |
| `validators/user/index.ts`                    | 119                          |
| `validators/payment/index.ts`                 | 120                          |
| `.husky/pre-commit`                           | 111                          |
| `package.json`                                | 111                          |

---

## Implementation Order (for backend agent)

**Aligned with Product Owner DoD wave ordering and dependency matrix.**

1. **Wave 1 -- Foundation** (all parallel, no deps):
   - 111: Fix pre-commit to exclude frontend tests (unblocks dev workflow)
   - 125: Fix hardcoded receipt signing secret (security quick win)
   - 126: Consolidate shutdown handlers (reliability quick win)
   - 128: Delete dead code from error-handler-middleware.ts (cleanup)
   - 129: Fix ServiceError options in ContentCreationService.ts (type fix)

2. **Wave 2 -- API Consistency** (sequential: 121 then 122):
   - 121: Fix auth middleware to use next(error) + add AuthorizationError to utils/errors.ts
   - 122: Create api-response helper + update all controllers

3. **Wave 3 -- API Expansion** (depends on Wave 2, can be parallel with each other):
   - 119: Add user relationship API routes (use createApiResponse from 122)
   - 120: Add payment API routes (use createApiResponse from 122)

4. **Wave 4 -- Performance/Architecture** (independent, do last):
   - 123: Improve payment-persistence corruption handling
   - 124: Replace unbounded caches with TTLCache
   - 127: Remove inversify decorators (last because it touches controller files from Waves 2/3)

---

## Acceptance Criteria (Summary)

- [ ] All 12 P2 todo files updated to complete status
- [ ] No dead code in error-handler-middleware.ts (128)
- [ ] ServiceError called with valid options (129)
- [ ] No hardcoded receipt signing secret fallback (125)
- [ ] Single shutdown handler registered (126)
- [ ] All auth middleware errors go through centralized error handler (121)
- [ ] Consistent response envelope across all controllers (122)
- [ ] Corruption detection with structured logging and health flag (123)
- [ ] Bounded caches with TTL for subscriptions and transactions (124)
- [ ] Single DI system (no misleading inversify decorators) (127)
- [ ] All 13 user relationship endpoints exposed (119)
- [ ] Payment validators wired to routes (120)
- [ ] Pre-commit hook passes without --no-verify (111)
- [ ] All backend tests pass
- [ ] No new TypeScript errors introduced

---

## Product Owner Approval Notes (2026-02-15)

The following notes from the PO review must be addressed by the backend agent during implementation:

### Per-Todo Notes

1. **129 (ServiceError)**: Grep for ALL `new ServiceError(` calls across the codebase. Fix any that use invalid options (not just ContentCreationService). DoD criterion 3 requires consistent pattern.

2. **125 (Hardcoded secret)**: Write two tests: (a) startup failure when NODE_ENV=production and RECEIPT_SIGNATURE_SECRET unset, (b) dev environment starts successfully without the env var. DoD criteria 5-6.

3. **126 (Shutdown handlers)**: Verify `process.listenerCount('SIGTERM') === 1` after server startup. Ensure shutdown completes within 10s timeout. DoD criteria 5-6.

4. **121 (Auth middleware)**: Verify `authenticate()` behavior is unchanged (it already uses next(error)). Write tests verifying auth error responses contain requestId and timestamp. DoD criteria 6-7.

5. **123 (Payment corruption)**: PO notes corruption recovery is "already partially implemented from P1 fix". Backend agent MUST verify what exists vs what's missing before making changes. Do not duplicate existing backup logic.

6. **127 (DI cleanup)**: Create a brief ADR in `docs/decisions/` documenting the decision to use custom ServiceContainer over inversify. DoD criterion 7.

7. **119 (User Relationship API)**: **Decision: implement all 13 endpoints** (not reduced scope). Verified that `UserRelationshipService` has methods for all operations: follow, unfollow, block, unblock, mute, unmute, getFollowers, getFollowing, getBlockedUsers, getMutedUsers, getRelationshipStats, sendFriendRequest, respondToFriendRequest, getRecommendations, exportRelationships, importFollows, getPrivacySettings, updatePrivacySettings. The controller needs 13 new methods but they are all thin wrappers.

### Cross-Cutting Notes

- **121 breaking change**: Document the auth error shape change (`{ error, code }` -> `{ success: false, error, code, metadata }`) in the PR description for client consumers. Add CHANGELOG entry.
- **All new endpoints (119, 120)**: Must use `createApiResponse()` from todo 122. Must have `authenticate` middleware. Must have integration tests.
