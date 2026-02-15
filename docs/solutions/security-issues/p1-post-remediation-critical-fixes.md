---
title: 'P1 Post-Remediation: 7 Critical Findings Fixed (PR #73)'
date: 2026-02-12
category:
  - security_issue
  - architecture
  - infrastructure
tags:
  - metrics
  - health-checks
  - redis
  - credential-rotation
  - cors
  - encryption
  - type-safety
  - post-remediation
module:
  - backend-middleware
  - infrastructure-scripts
  - credential-rotation
severity: critical
symptoms:
  - Route metrics always reporting /unmatched due to undefined req.route at middleware time
  - Health check endpoint vulnerable to timeout DoS and WebSocket resource leaks
  - Redis client sprawl with 5 independent singletons causing inconsistent auth/retry behavior
  - Credential rotation race condition with no distributed locking between password change and secrets promotion
  - CORS rate-limit headers using incorrect header names (X-RateLimit-* vs RateLimit-*)
  - encryptSecret function using base64 encoding instead of actual encryption
  - Unsafe type casts bypassing TypeScript checks and index signatures eroding type safety
status: resolved
effort_breakdown:
  planning: 40%
  implementation: 20%
  review: 40%
team_composition:
  - role: architect
    model: claude-opus-4-6
  - role: backend
    model: claude-sonnet-4-5
  - role: qa
    model: claude-sonnet-4-5
---

# P1 Post-Remediation: 7 Critical Findings Fixed

## Context

After the Infrastructure Sprint (PR #73) was reviewed and 18 findings were remediated, a **post-remediation review** uncovered 7 additional P1 critical findings. These were fixed using a `team-builder minimal` team (architect + backend + qa).

**Result:** 9 files changed, +181/-480 lines (net -299), 1 file deleted, 1 new file created, 7 test files written.

## Findings and Fixes

### P1-037: Route Metrics Always /unmatched

**Symptom:** All Prometheus route labels showed `/unmatched`, making per-route performance analysis impossible.

**Root Cause:** `req.route` is undefined when middleware runs — Express only populates it after route matching.

**Fix:** Move route label capture into `res.on('finish')` callback where `req.route` is resolved.

```typescript
// BEFORE — req.route undefined here
const route = normalizeRoute(req.route?.path || '/unmatched');
const end = httpRequestDuration.startTimer({ method: req.method, route });

// AFTER — capture in finish callback
const end = httpRequestDuration.startTimer();
res.on('finish', () => {
  const route = req.route?.path ? normalizeRoute(req.route.path) : normalizeRoute(req.originalUrl);
  end({ method: req.method, route, status_code: res.statusCode.toString() });
});
```

**Key insight:** prom-client `startTimer()` supports deferred labels — pass them at `end(labels)` time.

**File:** `packages/backend/src/middleware/deployment-monitoring.ts`

---

### P1-038: Health Check No Timeout + WebSocket Leak

**Symptom:** Hung Supabase connection blocked readiness probe indefinitely; Nostr WebSocket connections leaked on error.

**Root Cause:** No timeout boundary on DB query; missing `ws.close()` in error/timeout paths.

**Fix:** `Promise.race` with 5s timeout for DB check; `try/finally` with `ws.close()` for WebSocket cleanup.

```typescript
// DB timeout
const TIMEOUT_MS = 5000;
const queryPromise = supabase.from('health_check').select('id').limit(1);
const timeoutPromise = new Promise<never>((_, reject) =>
  setTimeout(() => reject(new Error('Database health check timed out')), TIMEOUT_MS)
);
const { error } = await Promise.race([queryPromise, timeoutPromise]);

// WebSocket cleanup
const ws = new WebSocket(relay);
try {
  await new Promise((resolve, reject) => {
    /* ... */
  });
} finally {
  ws.close(); // Always cleanup
}
```

**File:** `packages/backend/src/routes/health.ts`

---

### P1-039: Redis Client Sprawl

**Symptom:** 5 independent Redis clients with inconsistent auth, retry strategies, and env var sources. Partial failures when Redis requires authentication.

**Root Cause:** Organic growth without centralized client management.

**Fix:** Created shared factory at `src/lib/redis.ts` with unified config precedence (`REDIS_URL > HOST+PORT+PASSWORD`), consistent retry strategy, and singleton connection reuse.

```typescript
// src/lib/redis.ts (NEW — 73 lines)
export function getRedisClient(): Redis {
  if (sharedClient) return sharedClient;
  const config = getConfig(); // unified env var reading
  sharedClient = new Redis(config.url || { host, port, password, db }, {
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => Math.min(times * 200, 3000),
    lazyConnect: true,
  });
  return sharedClient;
}
```

Updated 3 consumers: `health.ts`, `bootstrap.ts`, `rate-limit-middleware.ts`.

**File:** `packages/backend/src/lib/redis.ts` (new)

---

### P1-040: Credential Rotation Race Condition

**Symptom:** Crash between DB password change and AWS Secrets Manager update leaves system in inconsistent state — all services fail.

**Root Cause:** No atomic transaction boundary across two systems; incorrect operation ordering.

**Fix:** Write-ahead pattern (stage AWSPENDING, change DB, promote AWSCURRENT) + lockfile guard to prevent concurrent runs.

```typescript
// Lockfile guard (10-min stale threshold)
if (fs.existsSync(this.lockFilePath)) {
  const lockTime = new Date(fs.readFileSync(this.lockFilePath, 'utf8')).getTime();
  if (Date.now() - lockTime < 10 * 60 * 1000) throw new Error('Rotation already in progress');
}
fs.writeFileSync(this.lockFilePath, new Date().toISOString(), { mode: 0o600 });

// Write-ahead: stage → change → promote
await this.stageAWSSecret(newPassword); // AWSPENDING
await this.updateSupabasePassword(newPassword);
await this.promoteAWSSecret(); // AWSPENDING → AWSCURRENT
```

Also replaced `execSync` with `execFileSync` to prevent shell injection.

**File:** `scripts/automated-supabase-rotation.ts`

---

### P1-041: CORS Wrong Rate-Limit Headers

**Symptom:** Cross-origin agents couldn't read rate-limit status. CORS exposed `X-RateLimit-*` but middleware sends IETF standard `RateLimit-*`.

**Root Cause:** Configuration drift — rate limiter updated to IETF format but CORS config wasn't.

**Fix:** Updated `exposedHeaders` to match actual headers sent.

```typescript
exposedHeaders: [
  'X-CSRF-Token', 'X-Correlation-ID',
  'RateLimit-Limit', 'RateLimit-Remaining',
  'RateLimit-Reset', 'RateLimit-Policy', 'Retry-After',
],
```

**File:** `packages/backend/src/app.ts`

---

### P1-042: Broken encryptSecret

**Symptom:** `encryptSecret` returned base64 encoding (trivially reversible), not encryption. Production security vulnerability.

**Root Cause:** TODO comment merged to production: "simplified version — use proper sodium encryption in production."

**Fix:** Replaced with `gh secret set` which handles encryption internally via GitHub's public key. Deleted the broken method entirely.

```typescript
// BEFORE — base64 ≠ encryption
private encryptSecret(secret: string): string {
  return Buffer.from(secret).toString('base64');
}

// AFTER — gh CLI handles encryption
execFileSync('gh', ['secret', 'set', secretName, '--repo', repo, '--body', newToken]);
```

**File:** `scripts/automated-github-token-rotation.ts`

---

### P1-043: Unsafe Type Casts

**Symptom:** `as DatabasePoolConfig` bypasses type checking on 349 lines of dead code; `[key: string]: unknown` on `req.user` allows any property access without warnings.

**Root Cause:** Dead code never imported; Express user type used index signature for "flexibility."

**Fix:** Deleted dead `database-pool.config.ts` (349 lines). Replaced index signature with named `AuthenticatedUser` interface.

```typescript
// BEFORE
user?: { nostr_pubkey: string; [key: string]: unknown };

// AFTER
interface AuthenticatedUser {
  nostr_pubkey: string;
  role?: string;
  id?: string;
  signature_verified?: boolean;
  iat?: number;
  exp?: number;
}
interface Request { rawBody?: Buffer; user?: AuthenticatedUser; }
```

**Files:** `packages/backend/src/config/database-pool.config.ts` (deleted), `packages/backend/src/types/express.d.ts`

---

## Test Coverage

7 dedicated test files created:

| Finding | Test File                                                   |
| ------- | ----------------------------------------------------------- |
| P1-037  | `src/__tests__/middleware/p1-037-route-metrics.test.ts`     |
| P1-038  | `src/__tests__/routes/p1-038-health-timeout.test.ts`        |
| P1-039  | `src/__tests__/lib/redis.test.ts`                           |
| P1-041  | `src/__tests__/middleware/p1-041-cors-headers.test.ts`      |
| P1-043  | `src/__tests__/types/express-augmentation.test.ts`          |
| P1-040  | `scripts/__tests__/automated-supabase-rotation.test.ts`     |
| P1-042  | `scripts/__tests__/automated-github-token-rotation.test.ts` |

## Lessons Learned

1. **Middleware timing matters** — Capture dynamic request properties (`req.route`) in response lifecycle events, not at middleware entry
2. **Timeouts are mandatory** — All I/O operations need timeout boundaries, especially health checks used by orchestration systems
3. **Centralize client management** — Connection sprawl leads to configuration drift and partial auth failures
4. **Write-ahead for multi-system transactions** — When atomicity isn't possible, stage changes before commitment
5. **CORS config must match actual headers** — Cross-origin API contracts break silently when exposed headers don't match
6. **Base64 is not encryption** — Never merge TODO comments claiming "use proper encryption in production"
7. **Type safety requires complete types** — Index signatures and `as` casts defeat TypeScript's purpose

## Related Documents

- [PR #73 Code Review Remediation](pr73-code-review-remediation.md) — Prior 18 findings from Infrastructure Sprint
- [P1 Remediation Plan](../../plans/p1-remediation-plan.md) — Architect's implementation plan with dependency ordering
- [ADR-017: Observability Stack](../../decisions/ADR-017-observability-stack.md) — Context for metrics and health checks
- [ADR-018: CI/CD Consolidation](../../decisions/ADR-018-cicd-consolidation.md) — Context for credential rotation workflows
- [Prevention Strategies](P1-037-043-prevention-strategies.md) — Comprehensive prevention framework with ESLint rules, CI/CD automation, and code patterns
