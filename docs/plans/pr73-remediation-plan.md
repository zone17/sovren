# PR #73 Remediation Plan

## Overview

18 findings from the Infrastructure Sprint code review (CI/CD, Observability, Security Gates).
4 already fixed by lead; 14 remaining, assigned to **backend** or **frontend** agents.

---

## Already Fixed (4 findings)

### Finding 023: Correlation ID Header Injection
- **Todo file:** todos/023-pending-p1-correlation-id-header-injection.md
- **Priority:** P1
- **Agent:** N/A
- **Affected files:** `packages/backend/src/middleware/correlation-id.ts`
- **Fix:** Added UUID regex validation (`/^[a-zA-Z0-9-]{1,128}$/`) for header input
- **Status:** ALREADY FIXED

### Finding 024: CSRF Path Prefix Matching
- **Todo file:** todos/024-pending-p1-csrf-path-prefix-matching.md
- **Priority:** P1
- **Agent:** N/A
- **Affected files:** `packages/backend/src/middleware/csrf.ts`
- **Fix:** Changed `startsWith(p)` to exact-or-prefix+slash matching
- **Status:** ALREADY FIXED

### Finding 020: CSP unsafe-inline in Production
- **Todo file:** todos/020-pending-p1-csp-unsafe-inline-production.md
- **Priority:** P1
- **Agent:** N/A
- **Affected files:** `vercel.json`, `packages/frontend/nginx.conf`
- **Fix:** Removed `unsafe-eval` from CSP `script-src`
- **Status:** ALREADY FIXED

### Finding 022: SSL Verification Disabled (receipt-service.ts)
- **Todo file:** todos/022-pending-p1-ssl-verification-disabled.md
- **Priority:** P1
- **Agent:** N/A
- **Affected files:** `packages/backend/src/services/lightning/receipt-service.ts`
- **Fix:** Changed `rejectUnauthorized` to env-dependent
- **Status:** ALREADY FIXED

---

## File-Grouped Summary (Remaining 14 Findings)

This groups findings by affected file to enable batch fixes.

| File / Area | Finding IDs | Agent |
|---|---|---|
| `scripts/automated-github-token-rotation-vault.ts` | 019 | backend |
| `scripts/automated-supabase-rotation-vault.ts` | 019, 021, 022 | backend |
| `scripts/setup-vault.sh` | 019 | backend |
| `.github/workflows/credential-rotation-vault.yml` | 019, 030 | backend |
| `.github/workflows/` (8 dead workflows) | 030 | backend |
| `packages/backend/src/middleware/security-headers.ts` | 025, 032, 036 | backend |
| `packages/backend/src/middleware/deployment-monitoring.ts` | 027, 036 | backend |
| `packages/backend/src/middleware/error-handler-middleware.ts` | 028, 032, 034 | backend |
| `packages/backend/src/middleware/rate-limit-middleware.ts` | 032, 033, 036 | backend |
| `packages/backend/src/middleware/advanced-rate-limiting.ts` | 033 | backend |
| `packages/backend/src/middleware/rateLimit.ts` | 033 | backend |
| `packages/backend/src/app.ts` | 028, 029, 032, 033 | backend |
| `packages/backend/src/routes/health.ts` | 031, 032, 036 | backend |
| `packages/backend/src/middleware/csrf.ts` | 029, 036 | backend |
| `packages/backend/src/lib/logger.ts` | 034 | backend |
| `packages/backend/src/utils/logger.ts` | 034 | backend |
| `packages/backend/src/lib/sentry.ts` | 034, 036 | backend |
| `docker/security/docker-compose.secure.yml` | 035 | backend |
| `scripts/setup-vault.sh` | 035 | backend |
| `packages/frontend/src/components/GlobalErrorBoundary.tsx` | 026, 036 | frontend |
| `packages/frontend/src/components/FeatureErrorBoundary.tsx` | 026, 036 | frontend |
| `packages/frontend/src/components/nostr/errors/ErrorBoundary.tsx` | 026 | frontend |
| `packages/frontend/src/components/ui/error-boundary.tsx` | 026 | frontend |
| `packages/frontend/src/monitoring/ErrorBoundary.tsx` | 026 | frontend |
| `packages/frontend/src/monitoring/sentry.ts` | 036 | frontend |

---

## Fix Ordering (Dependency Graph)

Fixes are ordered by priority and dependency. Within each phase, fixes can be done in parallel.

### Phase A: Security-Critical (P1) - Do First
1. **Finding 019** - Broken encryption + hardcoded keys in rotation scripts
2. **Finding 021** - Command injection in Supabase rotation

### Phase B: Architecture (P2) - Can Start Immediately (no dependency on Phase A)
3. **Finding 025** - Delete security-headers.ts (resolves many P2/P3 items that reference it)
4. **Finding 028** - Correlation ID middleware ordering + remove dual request ID
5. **Finding 033** - Remove dual rate limiting from app.ts + delete redundant files

**NOTE:** Finding 025 should be done before Finding 032 and Finding 036, because deleting `security-headers.ts` removes ~10 `any` types and ~30 `console.*` violations automatically.

### Phase C: Backend Improvements (P2) - After Phase B
6. **Finding 027** - Prometheus high-cardinality fix
7. **Finding 031** - Deduplicate health endpoints + WebSocket import
8. **Finding 032** - `any` type violations (remaining after 025 deletion)
9. **Finding 029** - Agent-native accessibility (CORS headers, CSRF bypass for API keys)
10. **Finding 030** - Delete dead workflows + fix permissions
11. **Finding 034** - Consolidate sanitization + logger duplication

### Phase D: Hardening (P3) - After Phases B+C
12. **Finding 035** - Docker/Vault security hardening
13. **Finding 036** - Minor code quality (remaining after 025 deletion)

### Phase E: Frontend (Independent - Can Run in Parallel with Phases B-D)
14. **Finding 026** - Consolidate error boundaries
15. **Finding 029** (frontend portion) - Agent-native accessibility (if any frontend CORS config)
16. **Finding 036** (frontend portion) - `substr` deprecation fixes

---

## Detailed Findings (Remaining 14)

### Finding 019: Broken Encryption & Hardcoded Keys in Credential Rotation
- **Todo file:** todos/019-pending-p1-broken-encryption-credential-rotation.md
- **Priority:** P1
- **Agent:** backend
- **Affected files:**
  - `scripts/automated-github-token-rotation-vault.ts`
  - `scripts/automated-supabase-rotation-vault.ts`
  - `scripts/setup-vault.sh`
  - `.github/workflows/credential-rotation-vault.yml`
- **Fix:** Use **Option B (Recommended)**: Delete all Vault-variant scripts since no Vault is in use. This removes ~4,500 lines and eliminates the attack surface. Specifically:
  1. Delete `scripts/automated-github-token-rotation-vault.ts`
  2. Delete `scripts/automated-supabase-rotation-vault.ts`
  3. Delete `scripts/setup-vault.sh`
  4. Delete `.github/workflows/credential-rotation-vault.yml`
  5. Verify non-vault scripts (`automated-github-token-rotation.ts`, `automated-supabase-rotation.ts`) do NOT have hardcoded fallback keys
  6. Ensure remaining rotation scripts fail hard when env vars are missing (no silent fallbacks)
- **Risk:** Low (deleting unused code)
- **Dependencies:** None
- **Acceptance criteria:**
  - `grep -r 'default-backup-key\|root-token-sovren' scripts/` returns no results
  - No hardcoded encryption keys or tokens in any script
  - Missing env vars cause explicit failures

### Finding 021: Command Injection in Supabase Password Rotation
- **Todo file:** todos/021-pending-p1-command-injection-rotation.md
- **Priority:** P1
- **Agent:** backend
- **Affected files:**
  - `scripts/automated-supabase-rotation-vault.ts` (deleted by 019)
  - `scripts/automated-supabase-rotation.ts` (check this too)
- **Fix:** If 019 deletes the vault variant, verify the non-vault `automated-supabase-rotation.ts` does NOT use `execSync` with string interpolation. If it does, replace with `execFileSync`:
  ```typescript
  import { execFileSync } from 'child_process';
  execFileSync('supabase', ['db', 'password', 'update', '--password', newPassword], { stdio: 'pipe' });
  ```
- **Risk:** Low
- **Dependencies:** Finding 019 (if vault script is deleted, this is partially resolved)
- **Acceptance criteria:**
  - No `execSync` calls with string interpolation of secrets
  - Password containing `$(whoami)` does NOT execute the command

### Finding 025: security-headers.ts Overengineered (1,112 lines, Unused)
- **Todo file:** todos/025-pending-p2-security-headers-overengineered.md
- **Priority:** P2
- **Agent:** backend
- **Affected files:**
  - `packages/backend/src/middleware/security-headers.ts` (DELETE)
- **Fix:** **Option A: Delete entirely.** The file is NOT imported or used anywhere -- `app.ts` uses Helmet. Deleting it:
  - Removes 1,112 lines of dead code
  - Eliminates the nonce Map memory leak
  - Removes 10+ `any` types (helps Finding 032)
  - Removes 30+ `console.*` calls (helps Finding 036)
  - Removes testing utilities from production code
  - Removes inline `require('crypto')` (helps Finding 036)
- **Risk:** None (file is unused; verified `app.ts` imports Helmet, not security-headers)
- **Dependencies:** None
- **Acceptance criteria:**
  - `security-headers.ts` deleted
  - No import references to it remain in the codebase
  - CSP headers still served correctly via Helmet in `app.ts`

### Finding 027: Prometheus High-Cardinality Labels
- **Todo file:** todos/027-pending-p2-prometheus-high-cardinality-labels.md
- **Priority:** P2
- **Agent:** backend
- **Affected files:**
  - `packages/backend/src/middleware/deployment-monitoring.ts:136`
- **Fix:** Change line 136 from:
  ```typescript
  const route = normalizeRoute(req.route?.path || req.path);
  ```
  to:
  ```typescript
  const route = req.route?.path ? normalizeRoute(req.route.path) : '/unmatched';
  ```
  This collapses all 404/unmatched paths into a single `/unmatched` label.
- **Risk:** None
- **Dependencies:** None
- **Acceptance criteria:**
  - Unmatched routes collapse to `/unmatched` label
  - Bot scanning cannot cause cardinality explosion

### Finding 028: Correlation ID Ordering + Dual Request ID
- **Todo file:** todos/028-pending-p2-correlation-id-ordering-dual-request-id.md
- **Priority:** P2
- **Agent:** backend
- **Affected files:**
  - `packages/backend/src/app.ts` (middleware ordering)
  - `packages/backend/src/middleware/error-handler-middleware.ts` (remove `requestIdMiddleware`, use `getCorrelationId()`)
- **Fix:**
  1. In `app.ts`: Move `app.use(correlationIdMiddleware)` to immediately after `const app = express()` (before Helmet, CORS, rate limiting). Currently at line 106, move it to ~line 44.
  2. In `error-handler-middleware.ts`:
     - Remove `generateRequestId()` function (lines 324-326)
     - Remove `requestIdMiddleware` export (lines 331-335)
     - Change `errorHandler` to use `getCorrelationId()` from correlation-id module instead of `(req as any).id || generateRequestId()`
     - Import `getCorrelationId` from `./correlation-id`
- **Risk:** Low -- correlation IDs will now be available for rate limiter 429 responses
- **Dependencies:** None
- **Acceptance criteria:**
  - Correlation ID middleware is first middleware in the stack
  - Rate limiter 429 responses carry correlation IDs
  - Single request identity system (no duplicate `generateRequestId`)

### Finding 029: Agent-Native Accessibility Blockers
- **Todo file:** todos/029-pending-p2-agent-native-accessibility.md
- **Priority:** P2
- **Agent:** backend (primary), frontend (minor)
- **Affected files:**
  - `packages/backend/src/app.ts` (CORS `exposedHeaders`)
  - `packages/backend/src/middleware/csrf.ts` (API key bypass)
- **Fix:**
  1. In `app.ts` CORS config, expand `exposedHeaders`:
     ```typescript
     exposedHeaders: ['X-CSRF-Token', 'X-Correlation-ID', 'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset', 'Retry-After'],
     ```
  2. In `csrf.ts`, add Bearer token bypass: if the request has a valid `Authorization: Bearer <token>` header (JWT or API key), skip CSRF validation. Machine clients authenticated via token don't need CSRF. Add to the skip logic:
     ```typescript
     // Machine clients with token-based auth skip CSRF
     if (req.headers.authorization?.startsWith('Bearer ')) {
       next();
       return;
     }
     ```
- **Risk:** Low -- expanding CORS headers is safe; Bearer bypass is standard practice (CSRF only protects cookie-based auth)
- **Dependencies:** None
- **Acceptance criteria:**
  - CORS exposes `X-Correlation-ID`, rate-limit headers
  - Agents with valid Bearer tokens can make POST requests without CSRF tokens
  - Browser-based cookie auth still requires CSRF

### Finding 030: Excessive Workflow Permissions + Dead Workflows
- **Todo file:** todos/030-pending-p2-excessive-workflow-permissions-dead-workflows.md
- **Priority:** P2
- **Agent:** backend
- **Affected files:**
  - `.github/workflows/credential-rotation-vault.yml` (delete -- covered by Finding 019)
  - `.github/workflows/ai-enhanced-ci.yml` (delete)
  - `.github/workflows/autonomous-cicd.yml` (delete)
  - `.github/workflows/ai-dependency-management.yml` (delete)
  - `.github/workflows/ai-performance-optimization.yml` (delete)
  - `.github/workflows/credential-rotation.yml` (delete)
  - `.github/workflows/deploy-blue-green.yml` (delete)
  - `.github/workflows/validate-secrets.yml` (delete -- NOTE: this file is listed in todo but not found; may already be deleted or named differently)
- **Fix:**
  1. Delete the 7-8 dead workflow files listed above
  2. Verify remaining workflows do not have `actions: write` permission
  3. Keep: `ci.yml`, `docker-build-push.yml`, `backend-deployment.yml`, `security-scan.yml`, `release.yml`, `automated-rollback.yml`, and any other active ones
- **Risk:** None (workflows are non-functional)
- **Dependencies:** Finding 019 (which also deletes `credential-rotation-vault.yml`)
- **Acceptance criteria:**
  - Dead workflow files removed (~3,500 lines)
  - No workflow has `actions: write` permission
  - Remaining workflows reference real, configured services

### Finding 031: Duplicate Health Endpoints + WebSocket Issues
- **Todo file:** todos/031-pending-p2-duplicate-health-endpoints-websocket-probes.md
- **Priority:** P2
- **Agent:** backend
- **Affected files:**
  - `packages/backend/src/routes/health.ts`
- **Fix:**
  1. **Deduplicate routes**: Remove `/ready` (lines 89-116) and `/live` (lines 119-126) handlers. They are exact copies of `/health/ready` and `/health/live`. Instead, redirect or alias:
     ```typescript
     router.get('/ready', (req, res) => res.redirect(307, '/health/ready'));
     router.get('/live', (req, res) => res.redirect(307, '/health/live'));
     ```
     OR simply define the handler once and mount at both paths.
  2. **Move NOSTR check to /health/detailed only**: The `checkNostr()` call already only runs inside `/health/detailed`. This is already correct -- no change needed.
  3. **Import WebSocket from `ws`**: Replace global `WebSocket` (line 346) with:
     ```typescript
     import WebSocket from 'ws';
     ```
     Add `ws` to package dependencies if not present.
  4. **Replace `SELECT *` with `SELECT 1`**: In `checkDatabase()` (line 221), change:
     ```typescript
     const { error } = await supabase.from('health_check').select('*').limit(1);
     ```
     to use a lightweight query. With Supabase client, use `.select('id').limit(1)` or consider using `rpc` for a `SELECT 1`.
  5. **Replace `require('os')`** (line 397) with top-level import:
     ```typescript
     import os from 'os';
     ```
     Then use `os.loadavg()` instead of `require('os').loadavg()`.
- **Risk:** Low -- deduplicating routes may affect Kubernetes probe configs if they use `/ready` vs `/health/ready`; check deployment YAML
- **Dependencies:** None
- **Acceptance criteria:**
  - No duplicate route handler implementations
  - WebSocket imported from `ws` package
  - No inline `require()` calls
  - Health check uses lightweight DB query

### Finding 032: `any` Type Violations
- **Todo file:** todos/032-pending-p2-any-type-violations.md
- **Priority:** P2
- **Agent:** backend
- **Affected files:**
  - `packages/backend/src/app.ts:114` - `(req as any).rawBody`
  - `packages/backend/src/app.ts:214` - `error: any` in global error handler
  - `packages/backend/src/middleware/rate-limit-middleware.ts:195` - `(req as any).user`
  - `packages/backend/src/middleware/error-handler-middleware.ts:112` - `(req as any).id`
  - `packages/backend/src/middleware/error-handler-middleware.ts:284` - `(req as any).user`
  - `packages/backend/src/routes/health.ts:65` - `details?: any` in ServiceHealth
  - `packages/backend/src/middleware/security-headers.ts` - 10+ `any` types (RESOLVED BY 025 DELETION)
- **Fix:**
  1. Create an Express type augmentation file `packages/backend/src/types/express.d.ts`:
     ```typescript
     declare global {
       namespace Express {
         interface Request {
           rawBody?: Buffer;
           user?: { nostr_pubkey: string; [key: string]: unknown };
         }
       }
     }
     export {};
     ```
  2. In `app.ts:214`: Change `error: any` to `error: Error` (Express error handler signature)
  3. In `health.ts:65`: Change `details?: any` to `details?: Record<string, unknown>`
  4. Remove `(req as any)` casts that are now covered by the type augmentation
  5. After Finding 025 deletes `security-headers.ts`, ~10 `any` types are removed automatically
  6. After Finding 028 removes `generateRequestId()`, `(req as any).id` is removed automatically
- **Risk:** Low
- **Dependencies:** Finding 025 (reduces scope), Finding 028 (reduces scope)
- **Acceptance criteria:**
  - Express Request type augmented for `rawBody` and `user`
  - No `any` in new/modified code within middleware/ and routes/
  - No unsafe `as` casts after Zod parse

### Finding 033: Dual Rate Limiting + Inline Error Handler
- **Todo file:** todos/033-pending-p2-dual-rate-limiting-inline-error-handler.md
- **Priority:** P2
- **Agent:** backend
- **Affected files:**
  - `packages/backend/src/app.ts` (remove inline rate limiter + inline error handler)
  - `packages/backend/src/middleware/advanced-rate-limiting.ts` (DELETE)
  - `packages/backend/src/middleware/rateLimit.ts` (DELETE)
- **Fix:**
  1. In `app.ts`: Remove the inline `rateLimit()` configuration (lines 91-103) and `app.use(limiter)`. Replace with the Redis-backed limiter from `rate-limit-middleware.ts`:
     ```typescript
     import { createRedisRateLimiter } from './middleware/rate-limit-middleware';
     // ... after const app = express():
     app.use(createRedisRateLimiter({ windowMs: 15 * 60 * 1000, max: 1000 }));
     ```
     In development/test environments where Redis isn't available, fall back to the in-memory `createRateLimiter`.
  2. In `app.ts`: Remove the inline global error handler (lines 214-271). Replace with:
     ```typescript
     import { errorHandler } from './middleware/error-handler-middleware';
     // ... at the end, after 404 handler:
     app.use(errorHandler);
     ```
  3. Delete `packages/backend/src/middleware/advanced-rate-limiting.ts` (unused, 35K lines)
  4. Delete `packages/backend/src/middleware/rateLimit.ts` (unused, superseded by rate-limit-middleware.ts)
- **Risk:** Medium -- the inline error handler has Sentry integration that the dedicated `errorHandler` lacks. Need to verify Sentry capture is in the dedicated handler, or add it.
- **Dependencies:** Finding 028 (which changes error handler to use correlationId)
- **Acceptance criteria:**
  - Single rate limiting module used throughout
  - Single error handler registered in `app.ts`
  - `advanced-rate-limiting.ts` and `rateLimit.ts` deleted

### Finding 034: Consolidate Sanitization, Logger, Rotation Duplication
- **Todo file:** todos/034-pending-p3-consolidate-sanitization-logger-rotation.md
- **Priority:** P3
- **Agent:** backend
- **Affected files:**
  - `packages/backend/src/lib/sentry.ts` (sanitization field list)
  - `packages/backend/src/lib/logger.ts` (sanitization field list)
  - `packages/backend/src/middleware/error-handler-middleware.ts` (sanitization field list)
  - `packages/backend/src/utils/logger.ts` (deprecated logger)
- **Fix:**
  1. Create a shared constant `packages/backend/src/lib/sensitive-fields.ts`:
     ```typescript
     export const SENSITIVE_FIELDS = [
       'password', 'token', 'secret', 'apiKey', 'privateKey',
       'signature', 'authorization', 'credit_card', 'ssn', 'nsec',
       'private_key',
     ] as const;

     const SENSITIVE_REGEX = new RegExp(SENSITIVE_FIELDS.join('|'), 'i');

     export function sanitizeObject(data: Record<string, unknown>): Record<string, unknown> {
       const sanitized = { ...data };
       for (const key of Object.keys(sanitized)) {
         if (SENSITIVE_REGEX.test(key)) {
           sanitized[key] = '[REDACTED]';
         }
       }
       return sanitized;
     }
     ```
  2. Update `sentry.ts`, `logger.ts`, and `error-handler-middleware.ts` to import and use the shared constant/function
  3. Delete `packages/backend/src/utils/logger.ts` and update any imports to use `packages/backend/src/lib/logger.ts`
  4. Rotation script consolidation is handled by Finding 019 (delete vault variants)
- **Risk:** Low
- **Dependencies:** Finding 019 (rotation scripts)
- **Acceptance criteria:**
  - Single source of truth for sensitive field names
  - No imports from `utils/logger`

### Finding 035: Docker/Vault Security Hardening
- **Todo file:** todos/035-pending-p3-docker-vault-security-hardening.md
- **Priority:** P3
- **Agent:** backend
- **Affected files:**
  - `docker/security/docker-compose.secure.yml`
  - `scripts/setup-vault.sh` (if not deleted by Finding 019)
- **Fix:**
  1. Bind PostgreSQL and Redis ports to localhost only:
     ```yaml
     ports:
       - '127.0.0.1:5432:5432'  # was '5432:5432'
       - '127.0.0.1:6379:6379'  # was '6379:6379'
     ```
  2. Fix Redis health check: Use `PING` with auth:
     ```yaml
     test: ['CMD', 'redis-cli', '-a', '${REDIS_PASSWORD}', 'ping']
     ```
  3. If `setup-vault.sh` is NOT deleted by Finding 019:
     - Enable TLS or bind Vault to `127.0.0.1`
     - Use 3 key shares with threshold 2
  4. Fix Docker ICC setting if present (enable_icc should be true for service communication)
- **Risk:** Low -- only affects local/dev Docker configs
- **Dependencies:** Finding 019 (may delete setup-vault.sh)
- **Acceptance criteria:**
  - No database/cache ports exposed to all interfaces
  - Redis health check uses PING with auth
  - Vault not listening on 0.0.0.0 without TLS (or script deleted)

### Finding 036: Minor Code Quality
- **Todo file:** todos/036-pending-p3-minor-code-quality.md
- **Priority:** P3
- **Agent:** backend + frontend
- **Affected files:**
  - **BACKEND:**
    - `packages/backend/src/middleware/deployment-monitoring.ts:22-25` - `collectDefaultMetrics` side effect at import time
    - `packages/backend/src/middleware/deployment-monitoring.ts:207` - swallowed error
    - `packages/backend/src/middleware/rate-limit-middleware.ts:278-279` - bypass not timing-safe
    - `packages/backend/src/middleware/csrf.ts` - default export alongside named export
    - `packages/backend/src/middleware/rate-limit-middleware.ts` - default export alongside named export
    - `packages/backend/src/lib/sentry.ts` - `sentryErrorHandler` exported but unused
    - `packages/backend/src/middleware/security-headers.ts` - inline `require('crypto')`, 30+ `console.*` (RESOLVED BY 025 DELETION)
    - `packages/backend/src/routes/health.ts:397` - inline `require('os')` (RESOLVED BY 031 FIX)
  - **FRONTEND:**
    - `packages/frontend/src/components/GlobalErrorBoundary.tsx:63` - deprecated `substr`
    - `packages/frontend/src/components/FeatureErrorBoundary.tsx:73,90` - deprecated `substr`
    - `packages/frontend/src/monitoring/sentry.ts` - `sentryErrorHandler` dead export
- **Fix (backend):**
  1. `deployment-monitoring.ts`: Wrap `collectDefaultMetrics` in an init function, call it from `app.ts` startup:
     ```typescript
     let metricsInitialized = false;
     export function initMetrics(): void {
       if (metricsInitialized) return;
       collectDefaultMetrics({ register, prefix: 'sovren_' });
       metricsInitialized = true;
     }
     ```
  2. `deployment-monitoring.ts:207`: Log the caught error instead of swallowing it
  3. `rate-limit-middleware.ts:278-279`: Replace `===` with `crypto.timingSafeEqual` for bypass secret comparison
  4. Remove default exports from `csrf.ts` (line 179) and `rate-limit-middleware.ts` (lines 289-300)
  5. Remove dead `sentryErrorHandler` export from `sentry.ts`
- **Fix (frontend):**
  1. Replace `substr(2, 9)` with `substring(2, 11)` in `GlobalErrorBoundary.tsx` and `FeatureErrorBoundary.tsx`
  2. Remove dead `sentryErrorHandler` export from `monitoring/sentry.ts` if present
- **Risk:** None
- **Dependencies:** Finding 025 (reduces scope), Finding 031 (reduces scope)
- **Acceptance criteria:**
  - No deprecated `substr` usage
  - No inline `require()` in TypeScript files
  - No default exports in new code
  - `collectDefaultMetrics` gated by initialization function

### Finding 026: Consolidate Error Boundaries
- **Todo file:** todos/026-pending-p2-consolidate-error-boundaries.md
- **Priority:** P2
- **Agent:** frontend
- **Affected files:**
  - `packages/frontend/src/monitoring/ErrorBoundary.tsx` (KEEP as base)
  - `packages/frontend/src/components/GlobalErrorBoundary.tsx` (DELETE)
  - `packages/frontend/src/components/FeatureErrorBoundary.tsx` (DELETE)
  - `packages/frontend/src/components/nostr/errors/ErrorBoundary.tsx` (DELETE)
  - `packages/frontend/src/components/ui/error-boundary.tsx` (DELETE)
  - Also delete "copy" files with spaces: `ErrorBoundary 2.tsx`, `FeatureErrorBoundary 2.tsx`, `error-boundary 2.css`
- **Fix:**
  1. Use `monitoring/ErrorBoundary.tsx` as the single source of truth (it's the active one in `main.tsx`)
  2. Add a `level` prop for feature-level vs global-level behavior:
     ```typescript
     interface ErrorBoundaryProps {
       level?: 'global' | 'feature';
       featureName?: string;
       enableAutoRetry?: boolean; // default false
       children: React.ReactNode;
     }
     ```
  3. Remove `(window as any).Sentry` from nostr variant -- use proper module import
  4. Delete all other ErrorBoundary implementations
  5. Delete all "copy" files (files with ` 2` in their names)
  6. Update any imports referencing deleted files to use the consolidated boundary
  7. Set auto-retry default to `false` (render bugs don't benefit from retry)
- **Risk:** Low -- only `monitoring/ErrorBoundary.tsx` is actively used; others are unused or feature-specific
- **Dependencies:** None
- **Acceptance criteria:**
  - Single ErrorBoundary component with configurable levels
  - No `(window as any).Sentry` access
  - `main.tsx` uses the consolidated boundary
  - Auto-retry defaults to `false`
  - All "copy" files (` 2.tsx`) deleted

---

## Agent Assignment Summary

### BACKEND Agent (11 findings, ~13 files to modify, ~6 files to delete)

**Priority order:**
1. **019** (P1) - Delete vault rotation scripts + verify non-vault scripts
2. **021** (P1) - Verify/fix command injection in non-vault rotation script
3. **025** (P2) - Delete `security-headers.ts`
4. **028** (P2) - Move correlation ID middleware first + remove dual request ID
5. **033** (P2) - Remove dual rate limiting + inline error handler from app.ts; delete redundant files
6. **027** (P2) - Prometheus high-cardinality fix (5-line change)
7. **031** (P2) - Deduplicate health endpoints + WebSocket import + require('os')
8. **032** (P2) - Fix remaining `any` types + create Express type augmentation
9. **029** (P2) - Agent-native accessibility (CORS headers, CSRF Bearer bypass)
10. **030** (P2) - Delete dead workflow files
11. **034** (P3) - Consolidate sanitization + delete utils/logger
12. **035** (P3) - Docker port binding + Redis health check
13. **036** (P3, backend portion) - collectDefaultMetrics init, timing-safe bypass, remove default exports

### FRONTEND Agent (3 findings, ~7 files to modify/delete)

**Priority order:**
1. **026** (P2) - Consolidate 5+ error boundaries into 1
2. **036** (P3, frontend portion) - Fix deprecated `substr`, remove dead sentry export
3. **029** (P2, frontend portion) - Minimal, mostly backend work

---

## Risk Assessment Summary

| Finding | Risk | Reason |
|---------|------|--------|
| 019 | Low | Deleting unused vault scripts |
| 021 | Low | Simple `execFileSync` swap (if script not deleted) |
| 025 | None | Deleting unused dead code |
| 027 | None | 1-line conditional change |
| 028 | Low | Middleware reordering; well-understood |
| 029 | Low | Expanding CORS headers; standard Bearer bypass |
| 030 | None | Deleting non-functional workflows |
| 031 | Low | K8s probes may need path update |
| 032 | Low | Type-only changes |
| 033 | Medium | Replacing error handler must preserve Sentry integration |
| 034 | Low | Refactoring imports |
| 035 | Low | Docker config changes (dev/local only) |
| 036 | None | Small isolated fixes |
| 026 | Low | Only active boundary is preserved |

---

## Estimated Lines Changed

- **Lines deleted:** ~6,500+ (security-headers.ts: 1,112, advanced-rate-limiting.ts: ~35K, rateLimit.ts: ~6K, vault scripts: ~4,500, dead workflows: ~3,500, duplicate error boundaries: ~1,000, duplicate files with spaces: ~500)
- **Lines added:** ~150 (Express type augmentation, sensitive-fields.ts, minor fixes)
- **Net:** Approximately -7,000+ lines of dead/duplicate code removed
