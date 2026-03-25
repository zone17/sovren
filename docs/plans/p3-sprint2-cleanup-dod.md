# P3 Sprint 2: API Gaps, Caching, Docker, Frontend Cleanup — Definition of Done

**Branch**: feature/US-007-error-boundaries-rebased
**Sprint Scope**: 20 P3 findings from PR #73 code review (rounds 3-7)
**Created**: 2026-02-15
**Updated**: 2026-02-15 (aligned with architect plan after source verification)
**Author**: Product Owner (agent)
**Format**: PASS / PARTIAL / FAIL per criterion per todo
**Architecture Plan**: `docs/plans/p3-sprint2-cleanup-plan.md`

---

## Source Verification Summary

Per Sprint 1 lesson: "Always verify against source before implementing." Architect verified all 20 todos against actual code. Key findings:

| Todo | Verification Result                                                                                                                              | Impact on DoD                       |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------- |
| 109  | **RESOLVED** in Sprint 1 (todo 014). Zero " 2" dirs found.                                                                                       | Mark complete, no work.             |
| 059  | **MOSTLY STALE**. Console/emoji/\_next already fixed. Only Docker ICC + Redis health remain.                                                     | Merge into 035, mark 059 complete.  |
| 035  | **PARTIALLY STALE**. Vault script deleted. Ports already 127.0.0.1. Only Redis healthcheck + ICC remain.                                         | Scope reduced to 2 items.           |
| 106  | **VALID BUT DIFFERENT**. Import path is `../../monitoring/ErrorBoundary`, not `@/components/ErrorBoundary`. 6 files (includes analytics), not 5. | Updated criteria.                   |
| 085  | **VALID, LARGE SCOPE**. ~90+ `Math.random()` locations, ~15 are production ID generation. Rest are tests/mocks.                                  | Scope to ~15 production files only. |

---

## Categorization

| Category                     | Todos                   | Status                 |
| ---------------------------- | ----------------------- | ---------------------- |
| Pre-Work (already resolved)  | 109, 059                | Mark complete, no code |
| Quick Wins (backend)         | 083, 084, 085, 105, 132 | Implement (Batch 1)    |
| Architecture Fixes (backend) | 104, 131, 133, 134      | Implement (Batch 2)    |
| Frontend                     | 106                     | Implement (Batch 3)    |
| Docker                       | 035+059 merged          | Implement (Batch 4)    |
| Database Patterns            | 130                     | Implement (Batch 5)    |
| API Documentation            | 018                     | Implement (Batch 6)    |
| Deferred                     | 060, 086, 087, 145, 146 | No implementation      |

---

## DEFERRED Items

### TODO-145: God Classes Decomposition (5 classes, 4,600+ lines)

**Reason**: Decomposing 5 god classes requires extensive DI re-wiring, test rewrites, and import chain updates. Already deferred from Sprint 1 for the same reason.
**Recommendation**: Dedicated refactoring sprint with its own architecture plan.
**In-Sprint Scope**: None.

### TODO-146: v1 API Route Fragmentation — 24 Missing Endpoints

**Reason**: 24 missing endpoints across content/payments/users is a multi-week phased migration. Needs its own sprint with API design review.
**Recommendation**: Create a dedicated "v1 API Completeness" sprint.
**In-Sprint Scope**: None. (087 subsumed here.)

### TODO-087: Missing Content CRUD in v1 API

**Reason**: Overlaps with todo 146. Content CRUD endpoints should be part of the v1 API migration effort, not piecemeal.
**Recommendation**: Bundle into 146's future sprint.
**In-Sprint Scope**: None.

### TODO-086: Agent API Key Authentication

**Reason**: New feature requiring API key table design, CRUD endpoints, rate-limit integration. Not cleanup.
**Recommendation**: Track on agent-native platform roadmap.
**In-Sprint Scope**: None. (Decision is implicit in deferral.)

### TODO-060: Agent-Native Metrics & Error APIs

**Reason**: New feature requiring 3 new endpoints, agent authentication, rate-limit normalization. Depends on 086 (agent auth).
**Recommendation**: Bundle with 086 on agent-native platform roadmap.
**In-Sprint Scope**: None.

---

## PRE-WORK: Already Resolved Items

### TODO-109: macOS Artifact Directories (ALREADY RESOLVED)

**Verification**: Architect confirmed 0 " 2" directories exist in `packages/backend/src/`. Cleaned in Sprint 1 (todo 014).
**Action**: Mark as complete with no code changes.

| #   | Criterion                    | Verification                                              | Result                   |
| --- | ---------------------------- | --------------------------------------------------------- | ------------------------ |
| 1   | All " 2" directories removed | `find packages/backend/src -name "* 2" -type d` returns 0 | **PASS** (already clean) |

---

### TODO-059: Docker Hardening and Console Logging (MOSTLY RESOLVED)

**Verification**: Architect confirmed:

- Console logging in deployment-monitoring.ts: 0 hits (already cleaned)
- `_next` parameter: already fixed (line 56)
- No emojis remain in error-handler-middleware.ts
- **Only Docker ICC + Redis health check remain** -- merged into TODO-035

**Action**: Mark as complete. Remaining Docker items tracked under 035.

| #   | Criterion                                       | Verification                                | Result                  |
| --- | ----------------------------------------------- | ------------------------------------------- | ----------------------- |
| 1   | Console logging replaced with structured logger | 0 console calls in deployment-monitoring.ts | **PASS** (already done) |
| 2   | `_next` naming                                  | Already `_next` at line 56                  | **PASS** (already done) |
| 3   | No emojis                                       | 0 emoji matches                             | **PASS** (already done) |
| 4   | Docker ICC + Redis health check                 | Merged into TODO-035                        | N/A (tracked elsewhere) |

---

## Acceptance Criteria by Todo

---

### TODO-083: Zod Error Handler Drops Metadata

**Description**: Include `expected` and `received` type information from Zod error issues in validation error responses.

**Affected Files**: `packages/backend/src/middleware/error-handler-middleware.ts` (lines 119-123)

| #   | Criterion                                         | Verification                                                                         | PASS                   | PARTIAL             | FAIL                |
| --- | ------------------------------------------------- | ------------------------------------------------------------------------------------ | ---------------------- | ------------------- | ------------------- |
| 1   | Zod validation errors include field path          | Error response contains `path` array for each validation issue                       | Path included          | N/A                 | Path missing        |
| 2   | Zod validation errors include expected type       | Error response contains `expected` field from ZodIssue                               | Expected type included | N/A                 | Not included        |
| 3   | Zod validation errors include received value type | Error response contains `received` type (NOT the actual value -- avoid leaking data) | Received type included | Type of value shown | Actual value leaked |
| 4   | Error response structure is backward compatible   | Response still includes `message` and `code` fields                                  | Backward compatible    | N/A                 | Breaking change     |

**Edge Cases**:

- Ensure sensitive field values are NOT included in error responses (only types)
- Verify nested object validation paths are correctly formatted (e.g., `body.address.zipCode`)
- Handle union type errors where `expected` may have multiple types

---

### TODO-084: Health Endpoints Use 307 Redirects

**Description**: Make `/ready` and `/live` respond directly with health status instead of redirecting to `/health`.

**Affected Files**: `packages/backend/src/routes/health.ts` (lines 82-86)

| #   | Criterion                                 | Verification                                                               | PASS        | PARTIAL    | FAIL         |
| --- | ----------------------------------------- | -------------------------------------------------------------------------- | ----------- | ---------- | ------------ |
| 1   | `/ready` returns 200 directly             | `curl -s -o /dev/null -w "%{http_code}" localhost:3001/ready` returns 200  | 200 direct  | N/A        | 307 redirect |
| 2   | `/live` returns 200 directly              | `curl -s -o /dev/null -w "%{http_code}" localhost:3001/live` returns 200   | 200 direct  | N/A        | 307 redirect |
| 3   | `/health` still works                     | `curl -s -o /dev/null -w "%{http_code}" localhost:3001/health` returns 200 | 200 OK      | N/A        | Broken       |
| 4   | Response body includes status information | `/ready` and `/live` return JSON with at minimum `{ "status": "ok" }`      | Status JSON | Empty body | Error        |

**Edge Cases**:

- `/ready` should check dependency readiness (DB, Redis) and return 503 if not ready
- `/live` should always return 200 if the process is running (liveness != readiness)
- Verify Kubernetes/Docker health check configurations don't depend on redirect behavior

---

### TODO-085: Weak UUID Generation Using Math.random

**Description**: Replace `Math.random()`-based UUID/ID generation with `crypto.randomUUID()` in ~15 production files. Skip tests, mocks, and placeholder data.

**Affected Files** (architect-verified production files):

- `IEventBus.ts:142`, `EventBusService.ts:575`
- `supabase-realtime-service.ts:547,735`
- `email-integration-service.ts:254,500,608,745`
- `nip05-monitoring-service.ts:248`
- `PaymentProcessingService.ts:863`, `PaymentAnalyticsService.ts:1279,1301,1426,1515`
- `CurrencyService.ts:782`, `RefundService.ts:1533`
- `receipt-service.ts:659`
- `UserProfileService.ts:1251`, `UserRelationshipService.ts:1270`, `UserAnalyticsService.ts:2009`
- `creator-recommendation-service.ts:456`

**Skip** (acceptable): `lightningService.ts` mock randomness, `UserServiceFactory.ts` mock tokens, `session-service.ts` mock data, `nip05.ts` mock stats

| #   | Criterion                                       | Verification                                                                                                     | PASS                 | PARTIAL             | FAIL              |
| --- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | -------------------- | ------------------- | ----------------- |
| 1   | No `Math.random()` for production ID generation | `grep -rn "Math.random" packages/backend/src/ --include="*.ts"` -- production ID-generation hits = 0             | 0 production ID hits | 1-5 remain          | >5 remain         |
| 2   | UUID generation uses crypto-secure source       | `grep -rn "crypto.randomUUID\|randomBytes" packages/backend/src/ --include="*.ts"` shows usage in affected files | Crypto-secure source | N/A                 | Non-secure source |
| 3   | Utility function created (optional)             | `generateId(prefix)` utility using `crypto.randomUUID()` exists                                                  | Utility created      | Inline replacements | N/A               |
| 4   | Tests/mocks NOT modified                        | Mock/test files unchanged                                                                                        | Unchanged            | N/A                 | Tests broken      |
| 5   | All existing tests pass                         | `npm test` passes                                                                                                | Passes               | N/A                 | Failures          |

**Edge Cases**:

- `Math.random()` used for non-ID purposes (jitter, shuffling) is acceptable -- only ID generation matters
- Verify `crypto.randomUUID()` is available in the Node.js version used (Node 19+)
- If creating `generateId()` utility, ensure it handles prefix patterns like `evt_`, `sub_`, `usr_`

---

### TODO-105: Sensitive Fields Over-Matching

**Description**: Replace broad `'key'` and `'auth'` in sensitive fields list with specific patterns to prevent over-redaction.

**Affected Files**: `packages/backend/src/lib/sensitive-fields.ts`

**Architect note**: `'key'` is at line 22 and `'auth'` is at line 21. Specific patterns `apiKey`, `api_key`, `privateKey`, `private_key`, `authorization` already exist -- so removing the broad terms is safe.

| #   | Criterion                                      | Verification                                                                                                                                                                   | PASS            | PARTIAL      | FAIL          |
| --- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------- | ------------ | ------------- |
| 1   | `'key'` removed as standalone sensitive field  | `grep "'key'" packages/backend/src/lib/sensitive-fields.ts` returns no standalone `'key'` entry                                                                                | Removed         | N/A          | Still present |
| 2   | `'auth'` removed as standalone sensitive field | `grep "'auth'" packages/backend/src/lib/sensitive-fields.ts` returns no standalone `'auth'` entry                                                                              | Removed         | N/A          | Still present |
| 3   | New specific patterns added                    | `grep -c "authToken\|authSecret\|accessToken\|refreshToken\|sessionToken\|encryptionKey\|signingKey\|secretKey\|secret_key" packages/backend/src/lib/sensitive-fields.ts` >= 5 | 5+ new patterns | 2-4 patterns | <2 patterns   |
| 4   | `primaryKey` NOT redacted                      | Test: object `{ primaryKey: 123 }` passes through sanitization unchanged                                                                                                       | Not redacted    | N/A          | Redacted      |
| 5   | `authMethod` NOT redacted                      | Test: object `{ authMethod: 'oauth2' }` passes through unchanged                                                                                                               | Not redacted    | N/A          | Redacted      |
| 6   | `apiKey` IS redacted                           | Test: object `{ apiKey: 'sk_live_123' }` is redacted                                                                                                                           | Redacted        | N/A          | Not redacted  |
| 7   | Existing sensitive fields still work           | `password`, `token`, `secret`, `credential` still redacted                                                                                                                     | All redacted    | N/A          | Any missed    |

**Edge Cases**:

- Case-insensitive matching: `ApiKey`, `APIKEY`, `apikey` should all be redacted
- Nested objects: `{ user: { apiKey: 'secret' } }` should redact the nested field
- Array values: `{ tokens: ['a', 'b'] }` -- field name `tokens` should still match `token` pattern

---

### TODO-132: Mock Database Binding in DI Container

**Description**: Change mock database binding in `bootstrap.ts` from silently returning empty results to throwing `NotImplementedError`.

**Affected Files**: `packages/backend/src/bootstrap.ts` (lines 231-237)

| #   | Criterion                                 | Verification                                                                | PASS          | PARTIAL | FAIL                  |
| --- | ----------------------------------------- | --------------------------------------------------------------------------- | ------------- | ------- | --------------------- |
| 1   | Mock database throws on `query()`         | Code inspection: `query()` method throws `NotImplementedError` or similar   | Throws error  | N/A     | Returns empty results |
| 2   | Mock database throws on `transaction()`   | Code inspection: transaction methods throw                                  | Throws error  | N/A     | Silently succeeds     |
| 3   | Error message indicates mock usage        | Thrown error message includes "Database not configured" or similar guidance | Clear message | N/A     | Generic error         |
| 4   | Services that don't use DB are unaffected | Services that never resolve `TYPES.Database` still work                     | Unaffected    | N/A     | Broken                |

**Edge Cases**:

- Ensure the mock is only used in development/startup, not in production
- If tests rely on the mock returning empty results, update those tests
- Error message should guide developer to configure real database

---

### TODO-104: TTLCache Implementation Issues

**Description**: Fix 3 issues in TTLCache: stale size reporting, FIFO to LRU eviction, mutation during iteration.

**Affected Files**: `packages/backend/src/utils/ttl-cache.ts`

| #   | Criterion                                   | Verification                                                                               | PASS                     | PARTIAL   | FAIL                     |
| --- | ------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------ | --------- | ------------------------ |
| 1   | `size` getter excludes expired entries      | Test: set entry with 1ms TTL, wait 10ms, check `cache.size` is 0                           | Expired entries excluded | N/A       | Expired entries counted  |
| 2   | LRU eviction implemented                    | Test: insert A, B, C (max=3), access A, B, insert D -- C evicted (least recently accessed) | LRU eviction verified    | N/A       | Still FIFO               |
| 3   | `values()` does not mutate during iteration | Test: call `values()` twice in succession, same results; no Map deletion during iteration  | Non-mutating             | N/A       | Mutates during iteration |
| 4   | Existing tests pass                         | All ttl-cache tests pass                                                                   | All pass                 | N/A       | Failures                 |
| 5   | New LRU tests added (minimum 3)             | Test file contains at least 3 LRU-specific test cases                                      | 3+ tests                 | 1-2 tests | No new tests             |
| 6   | `cleanExpired()` public method exists       | `grep "cleanExpired" packages/backend/src/utils/ttl-cache.ts` returns match                | Method exists            | N/A       | Not implemented          |

**Edge Cases**:

- LRU eviction with all entries having same access time (should still evict one deterministically)
- `values()` called on empty cache returns empty array (not error)
- `size` after `clear()` returns 0
- Concurrent get/set operations don't corrupt LRU ordering

---

### TODO-131: Unbounded Polling Timers Per Invoice

**Description**: Clean up `setInterval` timers in `LightningPaymentService` when invoices reach terminal states (paid/expired/cancelled). Add `maxPollingDuration` timeout.

**Affected Files**: `packages/backend/src/services/lightning-payment-service.ts` (lines 649-689)

| #   | Criterion                            | Verification                                             | PASS             | PARTIAL | FAIL           |
| --- | ------------------------------------ | -------------------------------------------------------- | ---------------- | ------- | -------------- |
| 1   | Timers cleared on "paid" state       | Code: `clearInterval` called when invoice status = paid  | Timer cleared    | N/A     | Timer orphaned |
| 2   | Timers cleared on "expired" state    | Code: `clearInterval` called when invoice expires        | Timer cleared    | N/A     | Timer orphaned |
| 3   | Timers cleared on "cancelled" state  | Code: `clearInterval` called when invoice cancelled      | Timer cleared    | N/A     | Timer orphaned |
| 4   | Timer references tracked for cleanup | Map or similar structure tracks interval IDs per invoice | Tracked          | N/A     | Not tracked    |
| 5   | Graceful shutdown clears all timers  | Shutdown handler iterates and clears all active timers   | All cleared      | N/A     | Timers leak    |
| 6   | Max polling duration failsafe        | `maxPollingDuration` (e.g., 1 hour) auto-stops polling   | Failsafe present | N/A     | No failsafe    |

**Edge Cases**:

- Same invoice ID gets multiple polling timers (should be idempotent)
- Timer cleanup during graceful shutdown (process.on('SIGTERM'))
- Race condition: timer fires just as invoice transitions to terminal state

---

### TODO-133: Scheduled Content Publish Jobs In-Memory Only

**Description**: Add startup recovery for scheduled publish jobs so content doesn't stay permanently in 'scheduled' status after process restart.

**Affected Files**: `packages/backend/src/services/content/ContentPublishingService.ts` (lines 293-299)

| #   | Criterion                                     | Verification                                                | PASS               | PARTIAL | FAIL              |
| --- | --------------------------------------------- | ----------------------------------------------------------- | ------------------ | ------- | ----------------- |
| 1   | Startup queries for pending scheduled content | Code: startup/init method queries for status='scheduled'    | Query present      | N/A     | No recovery       |
| 2   | Pending jobs re-registered on startup         | Code: each pending record gets a new setTimeout             | Jobs re-registered | N/A     | Jobs lost         |
| 3   | Past-due content published immediately        | Content with scheduledTime < now() is published immediately | Immediate publish  | N/A     | Scheduled in past |
| 4   | Future content scheduled correctly            | Content with scheduledTime > now() gets correct delay       | Correct delay      | N/A     | Wrong timing      |

**Edge Cases**:

- Process restarts at exact scheduled publish time -- should still publish
- Multiple restarts before scheduled time -- no duplicate publications
- Scheduled content deleted before publish time -- cleanup timer reference
- Very large number of scheduled items (1000+) -- batch processing, not all at once

---

### TODO-134: Unhandled Async in LightningPaymentService Constructor

**Description**: Fix constructor calling async `initializeService()` which can't be awaited. Use explicit `async initialize()` method pattern.

**Affected Files**: `packages/backend/src/services/lightning-payment-service.ts` (lines 134, 141-151)

| #   | Criterion                              | Verification                                                          | PASS                    | PARTIAL | FAIL                    |
| --- | -------------------------------------- | --------------------------------------------------------------------- | ----------------------- | ------- | ----------------------- |
| 1   | No async call in constructor           | Constructor does not call async methods                               | No async in constructor | N/A     | Async call remains      |
| 2   | Initialization errors are caught       | Initialization failure produces logged error, not unhandled rejection | Errors caught           | N/A     | Unhandled rejection     |
| 3   | Service unusable before initialization | Calling methods before `initialize()` throws or queues                | Guard present           | N/A     | Silent failure          |
| 4   | Explicit `initialize()` method exists  | `async initialize()` method exists and is called from bootstrap/DI    | Pattern implemented     | N/A     | Still async constructor |

**Edge Cases**:

- Initialization failure should not crash the process -- other services still work
- DI container must call `await service.initialize()` after construction
- Multiple calls to `initialize()` should be idempotent

---

### TODO-106: Identical Error Boundaries Across Features

**Description**: Create `createFeatureErrorBoundary` factory function to eliminate identical boilerplate across 6 feature error boundaries.

**IMPORTANT (architect-verified)**: Files import from `../../monitoring/ErrorBoundary`, NOT `@/components/ErrorBoundary` as the todo states. There are **6** identical files (includes analytics), not 5.

**Affected Files**:

- Create: `packages/frontend/src/monitoring/createFeatureErrorBoundary.tsx`
- Modify: 6 feature ErrorBoundary files (ai, analytics, dashboard, nostr, content, subscriptions)
- Unchanged: `packages/frontend/src/features/auth/ErrorBoundary.tsx` (custom, keep as-is)

| #   | Criterion                                  | Verification                                                                                    | PASS             | PARTIAL        | FAIL               |
| --- | ------------------------------------------ | ----------------------------------------------------------------------------------------------- | ---------------- | -------------- | ------------------ |
| 1   | Factory function exists                    | `test -f packages/frontend/src/monitoring/createFeatureErrorBoundary.tsx`                       | File exists      | N/A            | Missing            |
| 2   | All 6 identical boundaries use factory     | Each of ai, analytics, dashboard, nostr, content, subscriptions ErrorBoundary.tsx is <= 5 lines | All 6 refactored | 4-5 refactored | <4 refactored      |
| 3   | `displayName` set for React DevTools       | `grep "displayName" packages/frontend/src/monitoring/createFeatureErrorBoundary.tsx`            | Present          | N/A            | Missing            |
| 4   | AuthErrorBoundary unchanged                | `git diff packages/frontend/src/features/auth/ErrorBoundary.tsx` shows no changes               | Unchanged        | N/A            | Modified           |
| 5   | No visual or functional regression         | Error boundaries render same fallback UI as before                                              | Same behavior    | N/A            | Different behavior |
| 6   | Factory supports custom fallback parameter | Function signature accepts optional `customFallback` parameter                                  | Supported        | N/A            | Not supported      |

**Edge Cases**:

- Factory-created boundaries must still catch errors from deeply nested children
- `displayName` must be unique per feature for React DevTools differentiation
- Import path must be `../../monitoring/ErrorBoundary` (NOT `@/components/ErrorBoundary`)

---

### TODO-035+059 (Merged): Docker Security Hardening

**Description**: Fix remaining Docker issues: Redis health check password exposure, ICC setting. All other items from original 035 and 059 are already resolved or deleted.

**Affected Files**: `docker/security/docker-compose.secure.yml`

**Already resolved (skip)**: Vault setup script (deleted), PostgreSQL ports (already 127.0.0.1), CSP report logging (addressed), console logging (cleaned), `_next` naming (fixed), emojis (removed).

| #   | Criterion                                       | Verification                                                                            | PASS                     | PARTIAL       | FAIL                       |
| --- | ----------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------ | ------------- | -------------------------- |
| 1   | Redis health check password not in process list | Health check uses `REDISCLI_AUTH` env var, not `-a` CLI argument                        | `REDISCLI_AUTH` used     | Shell wrapper | Password in CLI args       |
| 2   | ICC configuration intentional and documented    | ICC disabled with proper Docker networking OR ICC enabled with documented justification | Intentional + documented | N/A           | Contradictory/undocumented |
| 3   | Docker compose config validates                 | `docker compose -f docker/security/docker-compose.secure.yml config` succeeds           | Config valid             | N/A           | Config errors              |
| 4   | Backend can reach Redis and Postgres            | After ICC change, service connectivity verified                                         | Connectivity works       | N/A           | Services unreachable       |

**Edge Cases**:

- If ICC=false, verify backend->redis and backend->postgres still work via Docker network aliases
- Redis health check with `REDISCLI_AUTH` must have the env var available in the container

---

### TODO-130: N+1 Query Patterns in Recommendation Service

**Description**: Fix N+1 query patterns in placeholder implementations. Add WHERE clause filtering at query level.

**Affected Files**: `packages/backend/src/services/recommendation-service.ts`, payment analytics

| #   | Criterion                                            | Verification                                                   | PASS                 | PARTIAL | FAIL             |
| --- | ---------------------------------------------------- | -------------------------------------------------------------- | -------------------- | ------- | ---------------- |
| 1   | Recommendation queries filter at query level         | `getCreatorRecommendations()` uses WHERE, not in-memory filter | WHERE clause         | N/A     | In-memory filter |
| 2   | Payment analytics queries filter at query level      | `getCreatorPayments()` uses WHERE, not in-memory filter        | WHERE clause         | N/A     | In-memory filter |
| 3   | No `.filter()` on full result sets for these methods | Code inspection confirms no load-all-then-filter pattern       | No post-query filter | N/A     | Full-set filter  |
| 4   | TODO comment for future DB integration               | Comment marks the pattern for when real DB is wired            | TODO present         | N/A     | No comment       |

**Edge Cases**:

- These use placeholder data -- ensure pattern works with both mock and real DB
- Batch loading with IN clauses for related records (avoid N queries for N records)

---

### TODO-018: OpenAPI Docs for Payment and User Routes

**Description**: Add OpenAPI JSDoc annotations to payment and user v1 route files matching the pattern in `content.routes.ts` (which has 11 `@openapi` blocks).

**Affected Files**: `packages/backend/src/routes/v1/payment.routes.ts` (211 lines, 0 annotations), `packages/backend/src/routes/v1/user.routes.ts` (223 lines, 0 annotations)
**Reference**: `packages/backend/src/routes/v1/content.routes.ts` (11 `@openapi` blocks)

| #   | Criterion                                        | Verification                                                              | PASS                 | PARTIAL        | FAIL              |
| --- | ------------------------------------------------ | ------------------------------------------------------------------------- | -------------------- | -------------- | ----------------- |
| 1   | Payment routes have OpenAPI annotations          | `grep -c "@openapi" packages/backend/src/routes/v1/payment.routes.ts` > 0 | All routes annotated | Some annotated | No annotations    |
| 2   | User routes have OpenAPI annotations             | `grep -c "@openapi" packages/backend/src/routes/v1/user.routes.ts` > 0    | All routes annotated | Some annotated | No annotations    |
| 3   | Annotations follow content.routes.ts pattern     | Same JSDoc structure: path, method, tags, parameters, responses           | Pattern matches      | Partial match  | Different pattern |
| 4   | Auth-protected routes show security requirements | `@openapi` blocks include `security` field for protected endpoints        | Security documented  | N/A            | Missing           |

**Edge Cases**:

- Request/response schemas should reference Zod types or TypeScript interfaces (not loose `any`)
- Pagination parameters documented on list endpoints
- Error response schemas documented (400, 401, 404, 500)

---

## Sprint-Level Definition of Done

| #   | Gate                                                             | Verification                                                   | PASS         | FAIL         |
| --- | ---------------------------------------------------------------- | -------------------------------------------------------------- | ------------ | ------------ |
| 1   | All non-deferred todos have at least PARTIAL across all criteria | Review this document against implementation                    | All PARTIAL+ | Any FAIL     |
| 2   | TypeScript compiles                                              | `npm run type-check` or `tsc --noEmit` on frontend and backend | Passes       | Fails        |
| 3   | All tests pass                                                   | `npm test` passes (frontend + backend)                         | Passes       | Failures     |
| 4   | No new ESLint errors                                             | `npm run lint` passes                                          | Passes       | New errors   |
| 5   | No regressions in existing functionality                         | Health endpoints, auth flow, payment flow operational          | Verified     | Broken       |
| 6   | Branch builds cleanly                                            | `npm run build` succeeds for all packages                      | Passes       | Build errors |
| 7   | Stale todos marked complete with notes                           | 109 and 059 marked complete with verification notes            | Marked       | Unmarked     |

---

## Summary Table

| Todo    | Title                            | Status                                 | Batch | Effort  | Risk    |
| ------- | -------------------------------- | -------------------------------------- | ----- | ------- | ------- |
| 109     | macOS Artifact Directories       | **ALREADY RESOLVED**                   | 0     | None    | None    |
| 059     | Docker Hardening/Console Logging | **ALREADY RESOLVED** (merged into 035) | 0     | None    | None    |
| 083     | Zod Error Drops Metadata         | IMPLEMENT                              | 1     | Small   | Low     |
| 084     | Health Endpoints 307 Redirects   | IMPLEMENT                              | 1     | Small   | Low     |
| 085     | Weak UUID Generation             | IMPLEMENT                              | 1     | Small   | Low     |
| 105     | Sensitive Fields Over-Matching   | IMPLEMENT                              | 1     | Small   | Low     |
| 132     | Mock Database in DI              | IMPLEMENT                              | 1     | Trivial | Low     |
| 104     | TTLCache Issues                  | IMPLEMENT                              | 2     | Medium  | Low     |
| 131     | Unbounded Polling Timers         | IMPLEMENT                              | 2     | Small   | Low     |
| 133     | Scheduled Publish In-Memory      | IMPLEMENT                              | 2     | Small   | Low     |
| 134     | Unhandled Async Constructor      | IMPLEMENT                              | 2     | Small   | Low     |
| 106     | Identical Error Boundaries       | IMPLEMENT                              | 3     | Small   | Low     |
| 035+059 | Docker Security (merged)         | IMPLEMENT                              | 4     | Small   | Low-Med |
| 130     | N+1 Recommendation Service       | IMPLEMENT                              | 5     | Small   | Low     |
| 018     | OpenAPI Docs Payment/User        | IMPLEMENT                              | 6     | Medium  | Low     |
| 060     | Agent-Native Metrics APIs        | **DEFERRED**                           | --    | Medium  | --      |
| 086     | Agent API Key Auth               | **DEFERRED**                           | --    | Large   | --      |
| 087     | Missing Content CRUD v1          | **DEFERRED** (into 146)                | --    | Medium  | --      |
| 145     | God Classes Decomposition        | **DEFERRED**                           | --    | Large   | Medium  |
| 146     | v1 API Route Fragmentation       | **DEFERRED**                           | --    | Large   | --      |

**Totals**: 14 implement (across 7 batches), 2 pre-resolved, 5 deferred (incl. 059 merged)
