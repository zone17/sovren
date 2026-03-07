# P2 Remediation Sprint Plan

**Created**: 2026-02-13
**Scope**: 29 P2 findings from code review
**Monorepo**: `/Users/fp/Desktop/Sovren`

---

## 1. Pre-Flight: Items Already Resolved or To Defer

### Already Resolved (verify only, no work needed)

| #   | Finding                                           | Status                                         |
| --- | ------------------------------------------------- | ---------------------------------------------- |
| 025 | security-headers.ts (1,112 lines)                 | File does not exist on disk -- already deleted |
| 030 | Dead GH Actions workflows (8 files, ~3,500 lines) | All 8 workflow files already deleted           |
| 051 | Dead database-pool.config.ts (349 lines)          | File does not exist on disk -- already deleted |

**Action**: Backend agent verifies via `grep -r` that no remaining imports reference these deleted files. If clean, mark todos as complete. ~5 minutes.

### Defer to Next Sprint

| #   | Finding                                        | Reason                                                                                                                                                                                                                                                   |
| --- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 012 | Missing v1 API endpoints (12 new routes)       | **Large effort** -- requires 5+ new route files, controllers, validators, tests. This is new feature work, not remediation. Estimated 2-3 days alone.                                                                                                    |
| 010 | SecretsService DI integration                  | **Medium risk** -- SecretsService.ts is dead code (todo #009 deletes it). If #009 executes first, #010 becomes moot. If we still want DI integration, it requires refactoring Config service init order. Defer until secrets architecture is redesigned. |
| 055 | CSRF session-bound tokens                      | **Medium risk** -- Requires Redis session store integration, changes CSRF architecture. The current double-submit pattern is standard for SPAs. Defer to a dedicated security hardening sprint.                                                          |
| 050 | Rate limiters in-memory only (Redis migration) | **Medium risk** -- Requires Redis infrastructure changes, Docker Compose updates, CI/CD pipeline changes. Better as dedicated infra task after rate limiter consolidation (#048/#033).                                                                   |

**4 items deferred. 25 items remain for execution (22 backend, 3 frontend).**

---

## 2. Dependency Analysis

### Critical Ordering Constraints

```
#044 (error hierarchy)  ──BEFORE──>  #033 (error handler dedup)
#044 (error hierarchy)  ──BEFORE──>  #013 (auth error leakage)

#009 (dead code delete)  ──BEFORE──>  #032 (any-type fixes)
   reason: deleting dead files reduces any-type surface

#048 (rate limiter consolidation)  ──BEFORE──>  #033 (dual rate limit removal from app.ts)
   reason: need canonical implementation before removing duplicates

#026 (consolidate error boundaries)  ──BEFORE──>  #052 (fix root boundary levels)
   reason: need single boundary before fixing hierarchy

#049 (logger consolidation)  ──BEFORE──>  #047 (sanitize fixes in logger)
   reason: consolidate first, then fix sanitization in one place

#028 (correlation ID ordering)  ──BEFORE──>  #027 (prometheus labels)
   reason: middleware reordering affects metric collection point
```

### File Conflict Zones (items touching same files)

| File                                     | Todos                                                                                         |
| ---------------------------------------- | --------------------------------------------------------------------------------------------- |
| `app.ts`                                 | #011 (mount routes), #028 (middleware order), #033 (remove inline rate limit + error handler) |
| `error-handler-middleware.ts`            | #028 (remove request ID), #033 (use as sole handler), #044 (unify error hierarchy)            |
| `middleware/csrf.ts`                     | #029 (agent CSRF bypass), #054 (CSRF test)                                                    |
| `rate-limit-middleware.ts`               | #033 (consolidate), #048 (delete duplicates)                                                  |
| `scripts/automated-supabase-rotation.ts` | #046 (execSync), #053 (password encoding)                                                     |
| `scripts/rotate-database-credentials.ts` | #013 (plaintext backup) -- but this file is deleted in #009                                   |

**Resolution**: Items touching same files go in same batch, assigned to same agent, worked sequentially within the batch.

---

## 3. Execution Batches

### Batch 1: Foundation -- Error Hierarchy + Dead Code Deletion

**Why first**: Unifies error classes (needed by Batches 2-3) and removes dead code (reduces noise for all later work).

| #   | Finding                           | Agent   | Solution                                                                                                                                                                                                                                                                                                     | Effort | Files                                                                 |
| --- | --------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ | --------------------------------------------------------------------- |
| 044 | Dual error class hierarchy        | Backend | Option 1: Unify under AppError -- add cause/context/timestamp to AppError, make utils/errors.ts classes extend AppError, update imports                                                                                                                                                                      | Medium | `error-handler-middleware.ts`, `utils/errors.ts`, all service imports |
| 009 | Dead code deletion (~8,500 lines) | Backend | Option A: Delete confirmed dead files. Files to delete: `database/pool.ts`, `services/SecretsService.ts`, `config/secrets.config.ts`. Files already gone: `database-pool.config.ts`, `security-headers.ts`, `vault-client.ts`. Also delete `scripts/rotate-database-credentials.ts` (512 lines, incomplete). | Small  | 4 files deleted                                                       |

**Batch 1 gate**: Build passes, no broken imports, error hierarchy unified.

---

### Batch 2: Middleware Stack Cleanup (app.ts focus)

**Why second**: Fixes middleware ordering, removes duplicates from app.ts. Depends on Batch 1 (error hierarchy).

| #   | Finding                                   | Agent   | Solution                                                                                                                                                                                                          | Effort | Files                                   |
| --- | ----------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | --------------------------------------- |
| 028 | Correlation ID ordering + dual request ID | Backend | Move `correlationIdMiddleware` to first position (already done per app.ts line 47 -- verify). Remove duplicate request ID generation from `error-handler-middleware.ts`. Error handler uses `getCorrelationId()`. | Small  | `app.ts`, `error-handler-middleware.ts` |
| 033 | Dual rate limiting + inline error handler | Backend | Remove inline `createRateLimiter()` from app.ts (line 102). Use Redis-backed limiter from `rate-limit-middleware.ts`. Replace inline error handler (if any remains after P1) with `errorHandler` import.          | Medium | `app.ts`, `rate-limit-middleware.ts`    |
| 011 | Dual routing -- mount missing routes      | Backend | Mount `content-discovery.ts` and `subscription-tiers.ts` in `app.ts`. Add deprecation comments to legacy routes. Write migration doc. Do NOT create v1 equivalents (that's #012, deferred).                       | Small  | `app.ts`, docs                          |
| 027 | Prometheus high cardinality labels        | Backend | Change fallback in `deployment-monitoring.ts` to `/unmatched` for routes without `req.route.path`. 5-line fix.                                                                                                    | Small  | `deployment-monitoring.ts`              |

**Batch 2 gate**: All routes accessible, single rate limiter in app.ts, single error handler, correlation IDs on all responses.

---

### Batch 3: Security Hardening (auth, CSRF, validation)

**Why third**: Security fixes that depend on stable middleware stack from Batch 2.

| #   | Finding                                                | Agent   | Solution                                                                                                                                                                                                                                                                                                                                | Effort | Files                                                                       |
| --- | ------------------------------------------------------ | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------- |
| 007 | Missing NOSTR signature on payment routes              | Backend | Option A: Add `requireNostrSignature` middleware to all POST/PUT/DELETE payment endpoints in `v1/payment.routes.ts`.                                                                                                                                                                                                                    | Small  | `routes/v1/payment.routes.ts`                                               |
| 008 | Missing input validation on discovery endpoints        | Backend | Option A: Add Zod schemas to `/trending`, `/category/:category`, `/feedback`. Bound limit to 1-100, category max 100 chars, content_id as UUID, rating bounded.                                                                                                                                                                         | Small  | `routes/content-discovery.ts`, `routes/subscription-tiers.ts`               |
| 013 | Auth error detail leakage                              | Backend | Option A: Replace specific JWT error messages with generic "Authentication failed". Log details server-side. Replace `z.any()` in payment validators with `z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]))`. Note: plaintext backup fix in `rotate-database-credentials.ts` is moot since file deleted in Batch 1. | Small  | `middleware/auth.ts`, `validators/payment/index.ts`                         |
| 029 | Agent-native accessibility (CSRF, CORS, bot detection) | Backend | Add Bearer token bypass for CSRF (machine clients with valid JWT skip CSRF). Add `X-Correlation-ID` to CORS `exposedHeaders` (partially done -- verify).                                                                                                                                                                                | Medium | `middleware/csrf.ts`, `app.ts` CORS config                                  |
| 054 | Agent rate limit penalty + no CSRF test                | Backend | Fix BypassDetector: remove Accept-Language requirement, remove standard UA flagging. Add CSRF Bearer token bypass test.                                                                                                                                                                                                                 | Medium | `middleware/advanced-rate-limiting.ts`, `__tests__/middleware/csrf.test.ts` |

**Batch 3 gate**: All payment routes require NOSTR sig, all discovery endpoints validated, no error leakage, agents can use API.

---

### Batch 4: Rate Limiter + Logger Consolidation

**Why fourth**: Consolidation work that benefits from stable middleware and security from Batches 2-3.

| #   | Finding                         | Agent   | Solution                                                                                                                                                                                                                                                                                                                                                                          | Effort | Files                                                                                                                                          |
| --- | ------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 048 | Three duplicate rate limiters   | Backend | Option 1: Keep `rate-limit-middleware.ts` as canonical. Migrate `ai-recommendations.ts` to use it. Migrate webhook rate limiter. Delete `rateLimit.ts` (214 lines) and `advanced-rate-limiting.ts` (1,237 lines). Extract bypass detection from advanced as optional plugin if needed by #054. **Coordinate with #054** -- if #054 needs BypassDetector, extract before deleting. | Medium | `rateLimit.ts` (delete), `advanced-rate-limiting.ts` (delete after extracting), `ai-recommendations.ts`, `webhooks-race-condition-hardened.ts` |
| 049 | Duplicate loggers (16 services) | Backend | Option 1: Migrate all 16 services from `utils/logger.ts` to `lib/logger.ts`. API is compatible (both have info/error/warn/debug). Delete `utils/logger.ts` after migration.                                                                                                                                                                                                       | Medium | 16+ service files, `utils/logger.ts` (delete)                                                                                                  |

**Batch 4 gate**: Single rate limiter, single logger, deleted files have no remaining imports.

---

### Batch 5: Sanitization, Shell Injection, Config Fixes

**Why fifth**: Depends on logger consolidation (#049) for sanitization fixes.

| #   | Finding                                       | Agent   | Solution                                                                                                                                                                               | Effort | Files                                                                                  |
| --- | --------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------- | --- | ---- | ------------------------------------------------------------------------------------------------ | ------ | ----------------------------------------------------------- |
| 047 | sanitizeObject non-recursive + regex mutation | Backend | All three fixes: (1) Make `sanitizeObject` recursive, (2) Fix regex to word boundaries `\b(password                                                                                    | token  | secret                                                                                 | key | auth | api[_-]?key)\b`, (3) Clone in Sentry `beforeSend`. Consolidate logger's separate recursive impl. | Medium | `lib/sensitive-fields.ts`, `lib/sentry.ts`, `lib/logger.ts` |
| 046 | Shell injection remaining execSync            | Backend | Option 1: Replace all `execSync` with `execFileSync` in rotation scripts. Pass args as arrays.                                                                                         | Small  | `scripts/automated-supabase-rotation.ts`, `scripts/automated-github-token-rotation.ts` |
| 053 | Password URI encoding + Docker SSL            | Backend | URI encode passwords with `encodeURIComponent()` in rotation scripts. Remove or fix Docker volume mounts for missing config files in `docker-compose.secure.yml`.                      | Small  | `scripts/automated-supabase-rotation.ts`, `docker/security/docker-compose.secure.yml`  |
| 045 | CSP unsafe-inline remaining                   | Backend | Remove `unsafe-inline` from `script-src` in `vercel.json` and `nginx.conf`. Replace `ws:` with `wss:` in `connect-src`. Use hash-based CSP if inline scripts exist.                    | Small  | `vercel.json`, `packages/frontend/vercel.json`, `packages/frontend/nginx.conf`         |
| 031 | Duplicate health endpoints + WebSocket probes | Backend | Define handlers once, mount at both `/ready` and `/health/ready`. Move NOSTR check to `/health/detailed` only. Import WebSocket from `ws` package. Replace `SELECT *` with `SELECT 1`. | Small  | `routes/health.ts`                                                                     |

**Batch 5 gate**: No shell injection vectors, sanitization recursive with word boundaries, health endpoints deduplicated.

---

### Batch 6: TypeScript Quality + any-Type Cleanup

**Why sixth**: Depends on all deletions and consolidations from Batches 1-5 (reduces any-type surface).

| #   | Finding                      | Agent              | Solution                                                                                                                                                                                                                                                               | Effort | Files                                                                         |
| --- | ---------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------- |
| 032 | any-type violations          | Backend + Frontend | Use `unknown` + narrowing for error handlers. Add Express module augmentation for `rawBody` and `user`. Replace remaining `any` with proper types. Note: `security-headers.ts` any-types gone (file deleted). `database-pool.config.ts` any-types gone (file deleted). | Medium | `app.ts`, `rate-limit-middleware.ts`, `routes/health.ts`, frontend components |
| 061 | Pre-commit TypeScript errors | Backend            | Option C (hybrid): Fix TS errors in `packages/backend/src/` (container bindings, RedisAdapter, unused params). Add `skipLibCheck` or `// @ts-nocheck` for testing package scaffolds. Scope pre-commit to staged-files-only type check.                                 | Medium | Container bindings, `RedisAdapter.ts`, `app.ts`, `.husky/pre-commit`          |

**Batch 6 gate**: `tsc --noEmit` passes for backend package, pre-commit hook works.

---

### Batch F1: Frontend (parallel with Batch 1-2)

**Independent of backend batches. Can start immediately.**

| #      | Finding                                        | Agent    | Solution                                                                                                                                                                                                                                                                       | Effort | Files                                                                                  |
| ------ | ---------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ | -------------------------------------------------------------------------------------- |
| 026    | Consolidate 5 error boundaries                 | Frontend | Option B: Keep `monitoring/ErrorBoundary.tsx` (active, used in main.tsx). Delete unused: `GlobalErrorBoundary.tsx`, `FeatureErrorBoundary.tsx`. Fix NOSTR boundary to use Sentry import instead of `(window as any).Sentry`. Keep `ui/error-boundary.tsx` as minimal fallback. | Small  | 4 ErrorBoundary files, `main.tsx`                                                      |
| 052    | ErrorBoundary root duplication + broken export | Frontend | Fix levels: `main.tsx` -> `level="global"`, `App.tsx` -> `level="page"`. Make QueryErrorBoundary delegate to consolidated ErrorBoundary. Fix or remove broken export in `components/nostr/errors/index.ts`.                                                                    | Small  | `main.tsx`, `App.tsx`, `queries/errorHandling.tsx`, `components/nostr/errors/index.ts` |
| 032-FE | any-type violations (frontend portion)         | Frontend | Replace `any` types in frontend components. Scope: only files flagged in review.                                                                                                                                                                                               | Small  | Various frontend components                                                            |

**Batch F1 gate**: Single ErrorBoundary, correct nesting, no broken exports, frontend any-types resolved.

---

## 4. Assignment Summary

### Backend Agent (~22 items across 6 batches)

**Execution order**: Batch 1 -> 2 -> 3 -> 4 -> 5 -> 6

| Batch | Items                   | Estimated Effort |
| ----- | ----------------------- | ---------------- |
| 1     | 044, 009                | Medium           |
| 2     | 028, 033, 011, 027      | Medium           |
| 3     | 007, 008, 013, 029, 054 | Medium           |
| 4     | 048, 049                | Medium           |
| 5     | 047, 046, 053, 045, 031 | Medium           |
| 6     | 032-BE, 061             | Medium           |

### Frontend Agent (~3 items, 1 batch)

**Can start in parallel with backend Batch 1.**

| Batch | Items            | Estimated Effort |
| ----- | ---------------- | ---------------- |
| F1    | 026, 052, 032-FE | Small-Medium     |

---

## 5. Risk Assessment

### High-Risk Items (extra review needed)

| #   | Risk                                               | Mitigation                                                                            |
| --- | -------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 044 | Error hierarchy change touches all service imports | Run full test suite after. Check every `catch` block.                                 |
| 048 | Rate limiter deletion removes advanced features    | Extract BypassDetector before deleting. Verify no route depends on advanced features. |
| 049 | Logger migration across 16 files                   | Verify API compatibility first. Run tests per-file.                                   |
| 061 | Pre-commit changes affect developer workflow       | Test hook locally before pushing. Keep `--no-verify` escape hatch documented.         |

### Low-Risk Items (safe mechanical changes)

009 (delete dead code), 025 (already deleted), 027 (5-line fix), 028 (middleware reorder), 030 (already deleted), 031 (deduplicate handlers), 045 (config file edits), 046 (execSync -> execFileSync), 053 (encodeURIComponent).

---

## 6. Recommended Solution Per Item (Quick Reference)

| #   | Title                                | Solution                                          |
| --- | ------------------------------------ | ------------------------------------------------- |
| 007 | NOSTR signature on payments          | A: Add middleware to endpoints                    |
| 008 | Input validation discovery           | A: Add Zod schemas                                |
| 009 | Dead code deletion                   | A: Delete files (verified no imports)             |
| 011 | Dual routing migration               | A: Mount missing routes + deprecation docs        |
| 013 | Auth error leakage                   | A: Generic messages + bounded validators          |
| 025 | security-headers.ts                  | ALREADY DELETED -- verify only                    |
| 026 | Consolidate error boundaries         | B: Keep active, delete unused, fix NOSTR          |
| 027 | Prometheus cardinality               | Single fix: fallback to `/unmatched`              |
| 028 | Correlation ID ordering              | Move to first + remove dual request ID            |
| 029 | Agent-native (CSRF/CORS)             | Bearer bypass + expose headers                    |
| 030 | Dead workflows                       | ALREADY DELETED -- verify only                    |
| 031 | Duplicate health + WebSocket         | Deduplicate handlers, cache relay check           |
| 032 | any-type violations                  | unknown + module augmentation                     |
| 033 | Dual rate limit + error handler      | Remove inline, use dedicated middleware           |
| 044 | Dual error hierarchy                 | Option 1: Unify under AppError                    |
| 045 | CSP unsafe-inline                    | Remove unsafe-inline, ws: -> wss:                 |
| 046 | Shell injection execSync             | Option 1: execFileSync with arg arrays            |
| 047 | sanitizeObject non-recursive         | All 3 fixes: recursive + regex + clone            |
| 048 | Three rate limiters                  | Option 1: Consolidate to rate-limit-middleware.ts |
| 049 | Duplicate loggers                    | Option 1: Migrate to lib/logger.ts                |
| 050 | Rate limiters in-memory              | DEFERRED -- requires Redis infra                  |
| 051 | Dead database-pool.config            | ALREADY DELETED -- verify only                    |
| 052 | ErrorBoundary root duplication       | Fix levels + consolidate QueryErrorBoundary       |
| 053 | Password URI encoding + Docker       | encodeURIComponent + fix/remove mounts            |
| 054 | Agent rate limit penalty + CSRF test | Fix BypassDetector + add test                     |
| 055 | CSRF not session-bound               | DEFERRED -- requires Redis session arch           |
| 061 | Pre-commit TypeScript errors         | C: Fix backend TS errors + scope hook             |

---

## 7. Definition of Done (Sprint)

- [ ] All 25 active items completed (22 backend, 3 frontend)
- [ ] 3 already-deleted items verified clean (025, 030, 051)
- [ ] 4 items documented as deferred (010, 012, 050, 055)
- [ ] Build passes (`npm run build`)
- [ ] All existing tests pass (`npm test`)
- [ ] No new `any` types introduced
- [ ] Pre-commit hook functional for backend package
- [ ] Each todo file status updated to `complete`
