# R7 Remediation Sprint: Definition of Done

**Sprint Scope**: 15 findings from Round 7 code review (todos 135-149)
**Priority Breakdown**: 3 P1, 7 P2, 5 P3
**Created**: 2026-02-15
**Product Owner**: product-owner agent

---

## Sprint-Level Definition of Done

The sprint is **DONE** when:

1. All P1 findings (135, 136, 137) are PASS on every criterion
2. All P2 findings (138-144) are PASS on every criterion
3. P3 findings are either PASS or explicitly DEFERRED with rationale
4. All existing tests continue to pass after changes
5. No new P1/P2 findings introduced by the fixes (verified by review)
6. Backend server starts and responds to health check after all changes

---

## P1 Findings (MUST FIX — Sprint Blockers)

### Todo 135: Auth Bypass on Creator Payout — No Role Check

| #   | Criterion                                                                                                          | Status  | Evidence |
| --- | ------------------------------------------------------------------------------------------------------------------ | ------- | -------- |
| 1   | Payout endpoints (`/lightning/creator/payout`, `/lightning/creator/payouts`) require `creator` role via middleware | PENDING |          |
| 2   | Non-creator authenticated user receives HTTP 403 with `{ error: "Forbidden" }` body                                | PENDING |          |
| 3   | Service layer (`PayoutManagementService.requestPayout`) independently validates caller has `creator` role          | PENDING |          |
| 4   | Service-level role check throws even if middleware is bypassed (defense in depth)                                  | PENDING |          |
| 5   | Test: regular user calling POST `/lightning/creator/payout` gets 403                                               | PENDING |          |
| 6   | Test: regular user calling GET `/lightning/creator/payouts` gets 403                                               | PENDING |          |

**Gaps filled**: Added criterion 2 (error response format), criterion 4 (defense in depth verification), criterion 6 (test for GET endpoint).

---

### Todo 136: Duplicate Payout Risk — No Idempotency Check

| #   | Criterion                                                                 | Status  | Evidence |
| --- | ------------------------------------------------------------------------- | ------- | -------- |
| 1   | Payout requests require `Idempotency-Key` header                          | PENDING |          |
| 2   | Request without `Idempotency-Key` returns HTTP 400 with descriptive error | PENDING |          |
| 3   | Duplicate key returns cached result (HTTP 200, not re-processed)          | PENDING |          |
| 4   | Idempotency keys expire after 24 hours (configurable TTL)                 | PENDING |          |
| 5   | Key-result mapping persisted to `payment-persistence` (survives restart)  | PENDING |          |
| 6   | Test: same key sent twice returns same result without double-processing   | PENDING |          |
| 7   | Test: different key with same params processes normally                   | PENDING |          |

**Gaps filled**: Added criterion 2 (missing key behavior), criterion 5 (persistence of key mapping), criterion 7 (different key test).

---

### Todo 137: Role Escalation via JWT Refresh — Stale Permissions

| #   | Criterion                                                                                    | Status  | Evidence |
| --- | -------------------------------------------------------------------------------------------- | ------- | -------- |
| 1   | Token refresh queries current role from database/Supabase                                    | PENDING |          |
| 2   | Demoted user gets new (lower) role in refreshed token                                        | PENDING |          |
| 3   | Deleted/suspended user gets 401 on refresh attempt (not a new token)                         | PENDING |          |
| 4   | Test: change user role from `creator` to `user`, refresh token, verify `user` role in claims | PENDING |          |
| 5   | Test: revoked admin gets `user` role token on refresh                                        | PENDING |          |
| 6   | Test: deleted user attempting refresh gets 401                                               | PENDING |          |

**Gaps filled**: Added criterion 3 (deleted account handling), criterion 6 (deleted user test).

---

## P2 Findings (SHOULD FIX)

### Todo 138: No fsync() in Atomic Writes — Data Loss on Power Failure

| #   | Criterion                                                                    | Status  | Evidence |
| --- | ---------------------------------------------------------------------------- | ------- | -------- |
| 1   | `fsyncSync(fd)` (or async `fsync`) called on file descriptor before `rename` | PENDING |          |
| 2   | Both `payment-persistence.ts` and `receipt-service.ts` updated               | PENDING |          |
| 3   | Write path uses `open` + `write` + `fsync` + `close` + `rename` sequence     | PENDING |          |
| 4   | Unit test: verify fsync is called before rename (mock fs operations)         | PENDING |          |

**Gaps filled**: Replaced "simulated crash" test (impractical in CI) with mock-based verification (criterion 4). Added criterion 3 (correct operation sequence).

---

### Todo 139: Cache Stampede on Persistence Fallback

| #   | Criterion                                                                  | Status  | Evidence |
| --- | -------------------------------------------------------------------------- | ------- | -------- |
| 1   | Concurrent cache misses for same key result in single persistence read     | PENDING |          |
| 2   | Subsequent requests share the result of the first lookup                   | PENDING |          |
| 3   | Pending lookup map is cleaned up after resolution (both success and error) | PENDING |          |
| 4   | If the coalesced promise rejects, all waiting callers receive the error    | PENDING |          |
| 5   | Test: 10 concurrent lookups for evicted invoice produce 1 persistence read | PENDING |          |

**Gaps filled**: Added criterion 3 (cleanup on error), criterion 4 (error propagation to all waiters).

---

### Todo 140: Blocking Sync I/O in Persistence — Event Loop Blocked

| #   | Criterion                                                                  | Status  | Evidence |
| --- | -------------------------------------------------------------------------- | ------- | -------- |
| 1   | All file writes in `payment-persistence.ts` use async `fs/promises` API    | PENDING |          |
| 2   | All file writes in `receipt-service.ts` use async `fs/promises` API        | PENDING |          |
| 3   | Write mutex continues to serialize writes correctly with async operations  | PENDING |          |
| 4   | Startup reads may remain sync (called once at init, before server listens) | PENDING |          |
| 5   | `doWrite()` method signature is `async` and returns `Promise<void>`        | PENDING |          |
| 6   | Test: write mutex prevents concurrent writes (async version)               | PENDING |          |

**Gaps filled**: Split criterion 1 into per-file checks (1, 2). Added criterion 5 (method signature) and 6 (mutex test). Clarified criterion 4 (startup reads are exempt).

**Note**: This todo MUST coordinate with todo 138 (fsync). The async write path should use async fsync (`fs.promises.open` + `fileHandle.sync()` + `fileHandle.close()`) to satisfy both requirements.

---

### Todo 141: Middleware Ordering — Rate Limit After Body Parse

| #   | Criterion                                                                  | Status  | Evidence |
| --- | -------------------------------------------------------------------------- | ------- | -------- |
| 1   | Rate limiter runs before body parser in `app.ts` middleware chain          | PENDING |          |
| 2   | Body parser has explicit size limit (`express.json({ limit: '100kb' })`)   | PENDING |          |
| 3   | Rate-limited requests (429) never trigger body parsing                     | PENDING |          |
| 4   | All existing routes continue to function after middleware reorder          | PENDING |          |
| 5   | Test: large body request (>100kb) gets 413 without body being fully parsed | PENDING |          |

**Gaps filled**: Added criterion 4 (regression check), criterion 5 (body size limit test).

---

### Todo 142: Memory Leak via Unremoved EventEmitter Listeners

| #   | Criterion                                                                                                  | Status  | Evidence |
| --- | ---------------------------------------------------------------------------------------------------------- | ------- | -------- |
| 1   | All EventEmitter `.on()` / `.addListener()` calls have corresponding cleanup in `dispose()` / `shutdown()` | PENDING |          |
| 2   | Services with EventEmitter usage implement a `dispose()` method                                            | PENDING |          |
| 3   | Shutdown handler calls `dispose()` on all registered services                                              | PENDING |          |
| 4   | No `MaxListenersExceededWarning` emitted during normal operation                                           | PENDING |          |
| 5   | Test: verify listener count on process EventEmitter stays bounded after service init + dispose cycle       | PENDING |          |

**Gaps filled**: Added criterion 2 (dispose method exists), criterion 3 (shutdown integration), replaced "100x start/stop" with practical listener count test (criterion 5).

---

### Todo 143: NOSTR Signature 5-Minute Replay Window

| #   | Criterion                                                                        | Status  | Evidence |
| --- | -------------------------------------------------------------------------------- | ------- | -------- |
| 1   | Used signatures tracked in TTL cache (TTL = timestamp window)                    | PENDING |          |
| 2   | Replayed signature returns HTTP 401 Unauthorized                                 | PENDING |          |
| 3   | Signatures expire from tracking after replay window closes (no unbounded growth) | PENDING |          |
| 4   | Test: same signature used twice within 5 minutes returns 401 on second use       | PENDING |          |

**Assessment**: All criteria are testable and complete. No gaps.

---

### Todo 144: Compensating Transaction Rollback Gaps

| #   | Criterion                                                                           | Status  | Evidence |
| --- | ----------------------------------------------------------------------------------- | ------- | -------- |
| 1   | Rollback steps retry up to 3 times on transient failure                             | PENDING |          |
| 2   | Failed rollback after 3 retries emits structured alert/log with orphaned record IDs | PENDING |          |
| 3   | Orphaned record IDs logged at `error` level for manual reconciliation               | PENDING |          |
| 4   | All `var` declarations in `createSubscription()` replaced with `let` or `const`     | PENDING |          |
| 5   | Test: simulate rollback failure at step 2, verify retry + alert                     | PENDING |          |
| 6   | Test: verify all 4 rollback steps have retry logic                                  | PENDING |          |

**Gaps filled**: Added criterion 6 (verify all steps covered, not just one).

---

## P3 Findings (ATTEMPT OR DEFER)

### P3 Priority Ranking (Value vs Effort)

| Rank | Todo    | Description                      | Value                    | Effort | Recommendation                                                                                                    |
| ---- | ------- | -------------------------------- | ------------------------ | ------ | ----------------------------------------------------------------------------------------------------------------- |
| 1    | **149** | Replace `z.any()` in validators  | HIGH (security)          | Small  | **ATTEMPT** — small fix, high impact on input validation                                                          |
| 2    | **148** | Dead code removal (~1,900 lines) | MEDIUM (maintainability) | Medium | **ATTEMPT** — incremental, low risk, large codebase improvement                                                   |
| 3    | **147** | Circular dependency chains       | MEDIUM (stability)       | Medium | **ATTEMPT** — but scope to verified-unsafe cycles only, skip the error-handler cycle (verified safe in MEMORY.md) |
| 4    | **145** | God class decomposition          | MEDIUM (architecture)    | Large  | **DEFER** — high risk of regression, not appropriate for remediation sprint                                       |
| 5    | **146** | v1 API route fragmentation       | LOW (DX)                 | Large  | **DEFER** — multi-week effort, not remediation-scoped. Depends on todos 119, 120                                  |

**Rationale for deferrals**:

- **145 (God classes)**: Decomposing 5 services at 500-1100 lines each is a refactoring epic, not a remediation item. Risk of breaking existing tests is high. Better done as a dedicated sprint.
- **146 (v1 API routes)**: 24 missing endpoints is 2-3 weeks of work. Has external dependencies (todos 119, 120). Should be its own sprint.

---

### Todo 145: God Classes Decomposition (DEFER)

| #   | Criterion                                                | Status   | Evidence                                 |
| --- | -------------------------------------------------------- | -------- | ---------------------------------------- |
| 1   | No service file exceeds 400 lines                        | DEFERRED | Not attempted — remediation sprint scope |
| 2   | Each extracted service has focused single responsibility | DEFERRED |                                          |
| 3   | All existing tests pass after decomposition              | DEFERRED |                                          |

**Deferral Rationale**: Large refactor (5 files, 4,500+ lines) with high regression risk. Requires dedicated sprint with full test coverage verification.

---

### Todo 146: v1 API Route Fragmentation (DEFER)

| #   | Criterion                                     | Status   | Evidence                          |
| --- | --------------------------------------------- | -------- | --------------------------------- |
| 1   | All 65 capabilities available through v1 API  | DEFERRED | Not attempted — multi-week effort |
| 2   | Legacy routes deprecated with warning headers | DEFERRED |                                   |
| 3   | Pagination metadata on all v1 list endpoints  | DEFERRED |                                   |

**Deferral Rationale**: 24 endpoints across 3 domains. Depends on todos 119 and 120. Estimated 2-3 weeks. Not remediation-scoped.

---

### Todo 147: Circular Dependency Chains (ATTEMPT — Scoped)

| #   | Criterion                                                                          | Status  | Evidence |
| --- | ---------------------------------------------------------------------------------- | ------- | -------- |
| 1   | `madge --circular` reports reduced cycle count (target: zero NEW cycles)           | PENDING |          |
| 2   | Error-handler-middleware cycle explicitly documented as safe (function-level refs) | PENDING |          |
| 3   | DI container circular imports broken via interface extraction                      | PENDING |          |
| 4   | Test: all services importable independently without runtime errors                 | PENDING |          |

**Scope**: Focus on verified-unsafe cycles (DI container, barrel export cycles). Skip error-handler cycle (verified safe per MEMORY.md).

---

### Todo 148: Dead Code Removal (~1,900 Lines) (ATTEMPT — Incremental)

| #   | Criterion                                                                      | Status  | Evidence |
| --- | ------------------------------------------------------------------------------ | ------- | -------- |
| 1   | Unused error classes removed from error-handler-middleware                     | PENDING |          |
| 2   | Duplicate NOSTR auth services consolidated to single implementation            | PENDING |          |
| 3   | Stub analytics service removed (or marked with TODO if intentionally deferred) | PENDING |          |
| 4   | Dead utility functions removed                                                 | PENDING |          |
| 5   | Net code reduction of 500+ lines (conservative target for sprint scope)        | PENDING |          |
| 6   | All existing tests pass after removal                                          | PENDING |          |

**Scope**: Focus on safe, obviously-dead code. Skip BrowserPool simplification (needs usage analysis) and PaymentPersistence interface (actively used pattern from P1 sprint).

---

### Todo 149: z.any() in Content Validators (ATTEMPT)

| #   | Criterion                                                                                                         | Status  | Evidence |
| --- | ----------------------------------------------------------------------------------------------------------------- | ------- | -------- |
| 1   | Zero `z.any()` in `packages/backend/src/validators/content/index.ts`                                              | PENDING |          |
| 2   | Metadata fields have typed schemas (e.g., `z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]))`) | PENDING |          |
| 3   | Metadata schema has max keys limit (e.g., `.refine(obj => Object.keys(obj).length <= 50)`)                        | PENDING |          |
| 4   | Test: oversized metadata payload rejected with 400                                                                | PENDING |          |
| 5   | Test: deeply nested metadata rejected                                                                             | PENDING |          |

**Gaps filled**: Added criterion 3 (max keys limit) and criterion 5 (nested metadata test).

---

## Cross-Cutting Concerns

### Dependency Matrix

| Todo | Depends On                  | Blocks                                          |
| ---- | --------------------------- | ----------------------------------------------- |
| 135  | None                        | 136 (auth must work before idempotency matters) |
| 136  | 135 (auth fix)              | None                                            |
| 137  | None                        | None                                            |
| 138  | None                        | 140 (fsync approach affects async migration)    |
| 139  | None                        | None                                            |
| 140  | 138 (coordinate write path) | None                                            |
| 141  | None                        | None                                            |
| 142  | None                        | None                                            |
| 143  | None                        | None                                            |
| 144  | None                        | None                                            |
| 145  | DEFERRED                    | None                                            |
| 146  | 119, 120 (DEFERRED)         | None                                            |
| 147  | None                        | None                                            |
| 148  | None                        | None                                            |
| 149  | None                        | None                                            |

### Conflicts Between Fixes

1. **138 + 140**: Both modify the same write path in `payment-persistence.ts` and `receipt-service.ts`. Must coordinate: the final write path should be async with fsync. Implement 138 first (add fsync to sync path), then 140 migrates to async.

2. **135 + 136**: Both modify `lightning.ts` routes and `payout-management-service.ts`. Implement 135 first (auth), then 136 (idempotency) builds on top.

3. **148 (dead code) + 147 (circular deps)**: Dead code removal may incidentally break some circular dependency chains. Run `madge --circular` after dead code removal to see updated cycle count.

### Implementation Order (Recommended)

**Wave 1 — P1 Security (must be first)**:

1. Todo 135 (auth bypass)
2. Todo 136 (idempotency) — depends on 135
3. Todo 137 (JWT refresh) — independent

**Wave 2 — P2 Data/Performance**: 4. Todo 138 (fsync) — must be before 140 5. Todo 140 (async I/O) — coordinates with 138 6. Todo 139 (cache stampede) — independent 7. Todo 141 (middleware ordering) — independent

**Wave 3 — P2 Infrastructure**: 8. Todo 142 (EventEmitter cleanup) — independent 9. Todo 143 (NOSTR replay) — independent 10. Todo 144 (compensating transactions) — independent

**Wave 4 — P3 Cleanup (if time permits)**: 11. Todo 149 (z.any validators) — small, high value 12. Todo 148 (dead code) — incremental 13. Todo 147 (circular deps) — scoped

**Deferred**:

- Todo 145 (God classes) — future sprint
- Todo 146 (v1 API routes) — future sprint

---

## Verification Checklist (Sprint Completion Gate)

- [ ] All P1 findings (135, 136, 137): every criterion PASS
- [ ] All P2 findings (138-144): every criterion PASS
- [ ] P3 attempted (147, 148, 149): every criterion PASS or documented reason
- [ ] P3 deferred (145, 146): rationale documented above
- [ ] `npm test` passes (all existing tests)
- [ ] `npm run lint` passes
- [ ] Backend server starts successfully (`npm run dev` in backend package)
- [ ] Health check endpoint responds 200
- [ ] No new P1/P2 findings from post-sprint review
- [ ] All todo files updated with final status (PASS/FAIL/DEFERRED)
