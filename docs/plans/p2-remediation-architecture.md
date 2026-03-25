# P2 Remediation Architecture Plan

**Created**: 2026-02-13
**Author**: Architect Agent
**Scope**: All 32 pending P2 findings from PR #73 full code review
**Context**: Follows P1 remediation (088-091 applied)

---

## 1. Triage Matrix

| #   | ID      | Title                                        | Status              | Rationale                                                                                                                                                                                                                                      |
| --- | ------- | -------------------------------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 010     | SecretsService DI Integration                | DEFER               | Large scope (AWS Secrets Manager integration), medium risk, no immediate security/reliability benefit. Requires Config service refactor + init ordering. Better as its own epic.                                                               |
| 2   | 012     | Missing v1 API Endpoints                     | DEFER               | Feature work (12 new endpoints), not a fix. Large effort, low security/reliability urgency. Track as backlog epic.                                                                                                                             |
| 3   | 050     | Rate Limiters In-Memory Only                 | ACTIVE              | Security: rate limit bypass in multi-instance. Wire existing dead Redis code into presets.                                                                                                                                                     |
| 4   | 055     | CSRF Not Session-Bound + Plaintext Backup    | ACTIVE              | Security: CSRF token replay + plaintext credential window. Two sub-issues.                                                                                                                                                                     |
| 5   | 061     | Fix Pre-commit TypeScript Errors             | DUPLICATE of 069-ts | Same issue (tsc --noEmit blocks pre-commit). 069-ts is newer with more detail.                                                                                                                                                                 |
| 6   | 069-ts  | Fix Pre-commit TypeScript Errors             | ACTIVE              | Quality gate: pre-commit hook unusable. Scope to pre-commit fix (Option C from todo: disable tsc in pre-commit, move to CI).                                                                                                                   |
| 7   | 069-jwt | JWT Hardcoded Fallback                       | ALREADY-FIXED       | P1-089 applied: NostrAuthService constructor now throws on missing JWT_SECRET (non-test). Verified in nostr-auth.ts:56.                                                                                                                        |
| 8   | 070     | Client-Controlled Role                       | PARTIALLY-FIXED     | P1-088 removed 'admin' from auth route Zod enum (auth.ts:31). BUT nostr-auth.ts:25 JWTPayloadSchema still includes 'admin' in role enum. Needs cleanup of JWT payload schema + server-side role determination. Mark ACTIVE for remaining work. |
| 9   | 071     | Metrics Endpoint Unauthenticated             | ACTIVE              | Security: internal metrics exposed publicly. Quick fix: add auth/IP restriction.                                                                                                                                                               |
| 10  | 072     | Circular Import error-handler / utils/errors | DUPLICATE of 093    | Same circular dependency. 093 has more detailed analysis and proposed solution.                                                                                                                                                                |
| 11  | 073     | content-management-service Raw Errors        | DUPLICATE of 100    | Same issue (28x throw new Error). 100 has full error categorization and migration plan.                                                                                                                                                        |
| 12  | 074     | 97x ServiceToken\<any\> in DI                | DEFER               | Large refactor (97 tokens), low urgency. Type safety improvement but no runtime bug. Track as tech debt epic.                                                                                                                                  |
| 13  | 075     | 3,280 Lines Dead Middleware                  | ACTIVE              | Code hygiene: 3 dead files. Low risk deletion after grep verification.                                                                                                                                                                         |
| 14  | 076     | Three Validation Middleware Files            | ACTIVE              | Consolidation. Depends on 075 (input-validation.ts deletion).                                                                                                                                                                                  |
| 15  | 077     | Ghost Import lightningReceiptService         | ACTIVE              | Potential runtime ReferenceError. Quick investigation + fix.                                                                                                                                                                                   |
| 16  | 078     | DI Container Init Ordering                   | ACTIVE              | Reliability: services may resolve before container initialized. Quick fix.                                                                                                                                                                     |
| 17  | 079     | Redis Client Singleton Issues                | ACTIVE              | Reliability: no shutdown, no retry cap, race condition. Overlaps with 095.                                                                                                                                                                     |
| 18  | 080     | Duplicate CSRF Implementations               | ACTIVE              | Consolidation. Related to 055.                                                                                                                                                                                                                 |
| 19  | 081     | Dual Auth Middleware                         | ACTIVE              | Dead exports, auth errors bypass AppError. Related to 103.                                                                                                                                                                                     |
| 20  | 082     | Dual Logger Instances                        | ACTIVE              | Observability: inconsistent logging, missing correlation IDs in DI logs.                                                                                                                                                                       |
| 21  | 092     | Invoice Cache TTL Mismatch                   | ACTIVE              | Data integrity: cache eviction during active monitoring. One-line fix.                                                                                                                                                                         |
| 22  | 093     | Circular Dependency error-handler            | ACTIVE              | Architecture: circular import. Extract AppError to lib/. Primary finding (072 is duplicate).                                                                                                                                                   |
| 23  | 094     | Middleware Ordering error-handler            | ACTIVE              | Bug: error handler unreachable after 404 catch-all. Fix registration order.                                                                                                                                                                    |
| 24  | 095     | Redis Graceful Shutdown                      | ACTIVE              | Reliability: connection leaks + lazy connect. Overlaps with 079. Merge into single Redis lifecycle fix.                                                                                                                                        |
| 25  | 096     | Webhook HMAC Timing Attack                   | ACTIVE              | Security: timing side-channel on HMAC verification. Use crypto.timingSafeEqual().                                                                                                                                                              |
| 26  | 097     | Dead Code 3000+ Lines                        | ACTIVE              | Code hygiene: overlaps with 075 (dead middleware files are subset). Covers additional dead code beyond middleware.                                                                                                                             |
| 27  | 098     | Triple Rotation Scripts                      | ACTIVE              | Code hygiene: 2,693 lines across 3 languages. Delete Python/Bash duplicates.                                                                                                                                                                   |
| 28  | 099     | console.log Bypasses Structured Logger       | ACTIVE              | Observability: 30+ unstructured log calls. Replace with logger.\*.                                                                                                                                                                             |
| 29  | 100     | Content Mgmt Raw Error Throws                | ACTIVE              | Error handling: 28x throw new Error() -> AppError subclasses. Primary finding (073 is duplicate).                                                                                                                                              |
| 30  | 101     | CORS Blocks Agents                           | ACTIVE              | Agent-native: CORS allowlist blocks non-browser clients. Overlaps with 071 (metrics auth).                                                                                                                                                     |
| 31  | 102     | Hardcoded Salt in Rotation Encryption        | ACTIVE              | Security: static 'salt' string in scryptSync. Generate random salt per backup.                                                                                                                                                                 |
| 32  | 103     | Dual Auth Middleware Patterns                | ACTIVE              | Architecture: req.user vs req.nostr inconsistency + auth errors bypass error handler. Consolidate with 081.                                                                                                                                    |

### Summary

| Status          | Count | IDs                                                                                                                            |
| --------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------ |
| ACTIVE          | 24    | 050, 055, 069-ts, 070, 071, 075, 076, 077, 078, 079, 080, 081, 082, 092, 093, 094, 095, 096, 097, 098, 099, 100, 101, 102, 103 |
| DUPLICATE       | 3     | 061 (dup of 069-ts), 072 (dup of 093), 073 (dup of 100)                                                                        |
| ALREADY-FIXED   | 1     | 069-jwt (by P1-089)                                                                                                            |
| DEFER           | 3     | 010, 012, 074                                                                                                                  |
| PARTIALLY-FIXED | 1     | 070 (P1-088 partial; remaining work is ACTIVE)                                                                                 |

**Net active findings: 25** (24 ACTIVE + 070 partial)

---

## 2. Logical Groupings / Batches

### Batch 1: Security Hardening (HIGHEST PRIORITY)

**Risk: High | Effort: Medium | Files: ~8**

| Finding                                     | Fix                                                                                                                                                                              | Files                                                                                                     |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 096 - Webhook HMAC Timing Attack            | Create `lib/webhook-security.ts` with `verifyWebhookHmac()` using `crypto.timingSafeEqual()`. Update all webhook handlers.                                                       | `lib/webhook-security.ts` (new), `services/lightning-payment-service.ts`, `services/lightning-service.ts` |
| 102 - Hardcoded Salt                        | Replace `'salt'` literal with `crypto.randomBytes(16)` per backup. Store salt in encrypted output. Update decrypt to read salt.                                                  | `scripts/automated-github-token-rotation.ts`, `scripts/automated-supabase-rotation.ts`                    |
| 055 - CSRF Plaintext Backup                 | Encrypt-before-write in rotation scripts (addressed by 102 salt fix). CSRF session binding is larger scope -- apply sameSite tightening + document session binding as follow-up. | `middleware/csrf.ts`, rotation scripts                                                                    |
| 071 + 101 (metrics) - Metrics Endpoint Auth | Add auth middleware or IP allowlist to `/metrics` endpoint.                                                                                                                      | `app.ts` or metrics route file                                                                            |
| 070 (remaining) - Client-Controlled Role    | Remove 'admin' from `JWTPayloadSchema` in `nostr-auth.ts:25`. Ensure role is always server-determined.                                                                           | `services/nostr-auth.ts`                                                                                  |

**Why first**: These findings have direct security implications. Timing attacks, static salts, and unauthenticated metrics represent exploitable vulnerabilities.

---

### Batch 2: Error Handling & Architecture (HIGH PRIORITY)

**Risk: Medium | Effort: Medium | Files: ~6**

| Finding                            | Fix                                                                                                                                 | Files                                                                                                         |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| 093 - Circular Dependency AppError | Extract `AppError` base class to `lib/app-error.ts`. Update imports in both `error-handler-middleware.ts` and `utils/errors.ts`.    | `lib/app-error.ts` (new), `middleware/error-handler-middleware.ts`, `utils/errors.ts`, all AppError importers |
| 094 - Middleware Ordering          | Swap error handler and 404 catch-all registration order in `app.ts`. Use exported `notFoundHandler` instead of inline.              | `app.ts`                                                                                                      |
| 100 - Content Mgmt Raw Errors      | Replace 28x `throw new Error()` with appropriate AppError subclasses (ValidationError, NotFoundError, ConflictError, ServiceError). | `services/content-management-service.ts`                                                                      |

**Dependencies**: 093 must complete before 100 (100 imports AppError subclasses; circular dep should be resolved first). 094 can be parallel.

**Why second**: Error handling fixes ensure correct HTTP status codes and proper error routing. The circular dependency is a fragility that could break under bundler changes.

---

### Batch 3: Auth & Middleware Consolidation (MEDIUM PRIORITY)

**Risk: Medium | Effort: Medium | Files: ~5**

| Finding                           | Fix                                                                                                                                                                                                                                    | Files                                                                                               |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| 081 + 103 - Dual Auth Middleware  | Remove dead exports from `auth.ts` (authRateLimit, handleAuthError, isAdmin, isCreator, isAuthenticated). Replace direct JSON responses with AppError throws. Unify `req.user`/`req.nostr` to single `req.user` with NOSTR properties. | `middleware/auth.ts`, `services/nostr-auth.ts`, `types/express.d.ts`, route files using `req.nostr` |
| 080 - Duplicate CSRF              | Consolidate to single CSRF middleware file. Delete the weaker/older implementation.                                                                                                                                                    | `middleware/csrf.ts`, second CSRF file                                                              |
| 076 - Three Validation Middleware | Consolidate to `validation-middleware.ts`. Merge unique logic from `validation.ts`, delete `validation.ts`. (`input-validation.ts` deletion in Batch 4)                                                                                | `middleware/validation-middleware.ts`, `middleware/validation.ts`                                   |

**Dependencies**: Should follow Batch 2 (relies on corrected error handling for auth middleware AppError throws).

---

### Batch 4: Dead Code Removal (MEDIUM PRIORITY)

**Risk: Low | Effort: Low-Medium | Files: ~10**

| Finding                                    | Fix                                                                                                                                                                                                                                                                                                                                                                                                          | Files                                          |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------- |
| 075 + 097 - Dead Middleware + Dead Code    | Delete `content-sanitization.ts`, `input-validation.ts`. Extract `RequestRateLimiter` from `advanced-rate-limiting.ts` to `lib/rate-limiter.ts`, delete remaining ~1100 LOC. Remove dead Prometheus metrics, `checkAndTriggerRollback()`, `getDeploymentHealth()` from `deployment-monitoring.ts`. Remove unused error classes from `error-handler-middleware.ts`. Remove `RequestValidation` from `app.ts`. | Multiple files (see details in todos 075, 097) |
| 098 - Triple Rotation Scripts              | Delete `supabase-credential-rotation.py`, `complete-immed-004-supabase-rotation.sh`, `github-token-rotation.sh`. Keep TypeScript versions only.                                                                                                                                                                                                                                                              | `scripts/` directory                           |
| 077 - Ghost Import lightningReceiptService | Investigate reference in `server.ts`. Remove if dead, add import if needed.                                                                                                                                                                                                                                                                                                                                  | `server.ts`                                    |

**Dependencies**: 076 (Batch 3) should complete before deleting `input-validation.ts` to avoid confusion.

**Combined removal: ~6,400+ LOC**

---

### Batch 5: Infrastructure & Reliability (MEDIUM PRIORITY)

**Risk: Medium | Effort: Medium | Files: ~4**

| Finding                          | Fix                                                                                                                                                                                                                  | Files                                                   |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| 079 + 095 - Redis Lifecycle      | Combined fix: (1) Remove `lazyConnect: true`, add `connectRedis()` to bootstrap. (2) Add `disconnectRedis()` to `gracefulShutdown()`. (3) Add retry cap with backoff. (4) Use promise-based init lock for singleton. | `lib/redis.ts`, `server.ts`, `bootstrap.ts` or `app.ts` |
| 050 - Rate Limiters Redis-Backed | Wire existing `createRedisRateLimiter` into all presets. Set `enableOfflineQueue: false`. Add fallback logic for dev/test (MemoryStore).                                                                             | `middleware/rate-limit-middleware.ts`                   |
| 078 - DI Container Init Ordering | Call `initializeContainer()` in server startup before routes.                                                                                                                                                        | `server.ts` or `app.ts`, `container/index.ts`           |
| 092 - Invoice Cache TTL          | Change cache TTL from 1800 to 3600 to match monitor timeout.                                                                                                                                                         | `services/lightning-payment-service.ts`                 |

**Dependencies**: 079+095 should complete before 050 (rate limiters need healthy Redis).

---

### Batch 6: Observability & Quality (LOWER PRIORITY)

**Risk: Low | Effort: Medium | Files: ~12**

| Finding                          | Fix                                                                                                                        | Files                                                                                                                                              |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 082 - Dual Logger                | Replace bootstrap logger with import from `lib/logger`.                                                                    | `bootstrap.ts`                                                                                                                                     |
| 099 - console.log Bypass         | Replace 30+ `console.*` calls with `logger.*`. Add context objects. Enable ESLint `no-console` rule.                       | `bootstrap.ts`, `deployment-monitoring.ts`, `auth.ts`, `nostr-auth.ts`, `validation-middleware.ts`, `redis.ts`, `sentry.ts`, `app.ts`, `server.ts` |
| 069-ts - Pre-commit TypeScript   | Disable `tsc --noEmit` in pre-commit hook. Move type checking to CI. Keep lint-staged (ESLint + Prettier) in pre-commit.   | `.husky/pre-commit`                                                                                                                                |
| 101 (CORS portion) - CORS Config | Add `exposedHeaders: ['X-Correlation-ID']`, `maxAge: 86400`. Allow requests without Origin header for non-browser clients. | `app.ts` (CORS config)                                                                                                                             |

**Dependencies**: 082 should complete before 099 (logger available everywhere first, then replace console calls).

---

## 3. Implementation Order & Dependencies

```
Batch 1: Security Hardening ──────────────────────────── Week 1 Day 1-2
  ├─ 096 (HMAC timing)          [no deps]
  ├─ 102 (hardcoded salt)       [no deps]
  ├─ 055 (CSRF plaintext)       [after 102]
  ├─ 071+101 (metrics auth)     [no deps]
  └─ 070 (role cleanup)         [no deps]

Batch 2: Error Handling ──────────────────────────────── Week 1 Day 2-3
  ├─ 093 (circular dep)         [no deps]
  ├─ 094 (middleware order)     [no deps, parallel with 093]
  └─ 100 (raw errors → AppError) [after 093]

Batch 3: Auth & Middleware Consolidation ──────────────── Week 1 Day 3-4
  ├─ 081+103 (dual auth)        [after Batch 2]
  ├─ 080 (CSRF dedup)           [no deps]
  └─ 076 (validation dedup)     [no deps]

Batch 4: Dead Code Removal ───────────────────────────── Week 1 Day 4-5
  ├─ 075+097 (dead code purge)  [after 076 for input-validation.ts]
  ├─ 098 (rotation scripts)     [no deps]
  └─ 077 (ghost import)         [no deps]

Batch 5: Infrastructure & Reliability ────────────────── Week 2 Day 1-2
  ├─ 079+095 (Redis lifecycle)  [no deps]
  ├─ 050 (Redis rate limiters)  [after 079+095]
  ├─ 078 (DI init ordering)     [no deps]
  └─ 092 (cache TTL)            [no deps]

Batch 6: Observability & Quality ─────────────────────── Week 2 Day 2-3
  ├─ 082 (dual logger)          [no deps]
  ├─ 099 (console.log cleanup)  [after 082]
  ├─ 069-ts (pre-commit fix)    [no deps]
  └─ 101 (CORS headers)         [no deps]
```

---

## 4. Risk Assessment

| Batch                  | Risk   | Rationale                                                                                                                       |
| ---------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------- |
| 1 - Security           | Medium | Crypto changes require careful testing. Salt change breaks old backup compat (needs fallback). HMAC utility is straightforward. |
| 2 - Error Handling     | Medium | Circular dep extraction touches import paths across codebase. Middleware reorder could affect error routing if done wrong.      |
| 3 - Auth Consolidation | Medium | Auth middleware changes affect every authenticated route. Must test all auth flows.                                             |
| 4 - Dead Code          | Low    | Deletion after grep verification. Git history preserves everything.                                                             |
| 5 - Infrastructure     | Medium | Redis lifecycle changes affect all Redis consumers. Rate limiter switch needs Redis availability.                               |
| 6 - Observability      | Low    | Logger swap and console replacement are low-risk. Pre-commit change is trivial.                                                 |

---

## 5. Architectural Decisions

### AD-1: AppError Canonical Location

**Decision**: Extract `AppError` to `src/lib/app-error.ts`
**Rationale**: Both `error-handler-middleware.ts` and `utils/errors.ts` need it. `lib/` is the established location for foundational abstractions (logger, redis, etc.).

### AD-2: Auth Context Unification

**Decision**: Unify on `req.user` with optional NOSTR properties
**Rationale**: `req.user` is already used by most routes. Adding `pubkey?`, `npub?`, `sessionId?` is backward-compatible. `req.nostr` becomes a deprecated alias during migration.

### AD-3: Redis Lifecycle

**Decision**: Eager connect at startup + graceful disconnect on shutdown
**Rationale**: Fail-fast on missing Redis at startup (12-factor principle). `disconnectRedis()` already exists but is uncalled. Combined fix for 079+095.

### AD-4: Dead Code Strategy

**Decision**: Delete entirely (no archive directory)
**Rationale**: Git history preserves everything. Archive directories become permanent clutter. Grep verification before deletion is sufficient.

### AD-5: Pre-commit Strategy

**Decision**: Remove `tsc --noEmit` from pre-commit, move to CI
**Rationale**: Hundreds of pre-existing TS errors make full type-check impractical at commit time. ESLint + Prettier still run. Type checking in CI catches regressions without blocking developers.

### AD-6: CSRF Session Binding

**Decision**: Tighten sameSite + document full session binding as follow-up
**Rationale**: Full session binding requires Redis infrastructure (covered in Batch 5). Apply immediate tightening now; full fix requires coordinated Redis + session work.

---

## 6. Duplicate/Already-Fixed Disposition

| Finding                          | Disposition   | Covered By                                                            |
| -------------------------------- | ------------- | --------------------------------------------------------------------- |
| 061 (TS errors pre-commit)       | DUPLICATE     | 069-ts (identical issue, 069-ts is newer with prior todo reference)   |
| 072 (Circular import)            | DUPLICATE     | 093 (identical issue, 093 has detailed extraction plan)               |
| 073 (content-mgmt raw errors)    | DUPLICATE     | 100 (identical issue, 100 has full error categorization)              |
| 069-jwt (JWT hardcoded fallback) | ALREADY-FIXED | P1-089: NostrAuthService constructor fails-fast on missing JWT_SECRET |

**Recommended**: Mark duplicate todo files with `status: duplicate` and reference the primary finding. Mark 069-jwt as `status: resolved`.

---

## 7. Files Modified Per Batch (Merge Conflict Analysis)

| Batch | Key Files                                                                                                                                                          | Conflict Risk                                     |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------- |
| 1     | `nostr-auth.ts`, `lightning-*.ts`, `scripts/automated-*.ts`, `middleware/csrf.ts`, `app.ts`                                                                        | Low (distinct files)                              |
| 2     | `lib/app-error.ts` (new), `error-handler-middleware.ts`, `utils/errors.ts`, `app.ts`, `content-management-service.ts`                                              | Medium (`app.ts` also touched by Batch 1 metrics) |
| 3     | `middleware/auth.ts`, `nostr-auth.ts`, `types/express.d.ts`, `middleware/csrf.ts`, `validation-middleware.ts`                                                      | Medium (`nostr-auth.ts` touched by Batch 1)       |
| 4     | `content-sanitization.ts` (delete), `input-validation.ts` (delete), `advanced-rate-limiting.ts` (delete/extract), `deployment-monitoring.ts`, `server.ts`, scripts | Low (mostly deletions)                            |
| 5     | `lib/redis.ts`, `server.ts`, `rate-limit-middleware.ts`, `container/index.ts`, `lightning-payment-service.ts`                                                      | Medium (`server.ts` touched by Batch 4)           |
| 6     | `bootstrap.ts`, 10+ files for console replacement, `.husky/pre-commit`, `app.ts`                                                                                   | Low (additive changes)                            |

**Mitigation**: Sequential batch execution. Complete each batch + commit before starting next.

---

## 8. Acceptance Criteria Summary

Each batch is considered complete when:

1. All listed findings have their individual acceptance criteria met
2. `npm run lint` passes (ESLint + Prettier)
3. Existing tests pass (`npm test`)
4. No new TypeScript errors introduced in modified files
5. Manual smoke test of affected endpoints (auth, payments, content) for Batches 1-3
6. Code search confirms no broken imports after dead code removal (Batch 4)
