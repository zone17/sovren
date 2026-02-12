# Infrastructure Sprint -- Phase 0 Architecture Review

**Date**: 2026-02-12
**Reviewer**: Architect Agent
**Sprint**: Infrastructure Sprint (Phase 0)
**Status**: APPROVED with findings noted

---

## Executive Summary

Phase 0 delivered three factory workstreams (US-E0-009 CI/CD, US-E0-010 Observability, US-E0-011 Security Gates) that replaced simulation code with production-grade infrastructure. The changes are architecturally sound, well-structured, and ready for production integration. Three findings require attention in Phase 2.

---

## 1. CSRF Protection (US-E0-011)

**File**: `packages/backend/src/middleware/csrf.ts`
**Pattern**: Double-Submit Cookie
**ADR**: [ADR-016](../decisions/ADR-016-csrf-double-submit-cookie.md)

### Review Findings

**PASS** -- Implementation is correct and follows OWASP best practices.

| Check                          | Result | Notes                                                        |
| ------------------------------ | ------ | ------------------------------------------------------------ |
| Cryptographic token generation | PASS   | `crypto.randomBytes(32)` -- 256 bits of entropy              |
| Timing-safe comparison         | PASS   | `crypto.timingSafeEqual` with length pre-check               |
| Token rotation after use       | PASS   | New token generated on every successful validation           |
| SameSite cookie                | PASS   | `sameSite: 'lax'` provides defense-in-depth                  |
| Secure flag in production      | PASS   | `secure: process.env.NODE_ENV === 'production'`              |
| Excluded paths appropriate     | PASS   | Webhooks (HMAC-verified), health probes, metrics, CSP report |
| Error responses informative    | PASS   | Distinct codes for missing vs invalid tokens                 |
| Safe methods bypass            | PASS   | GET/HEAD/OPTIONS correctly excluded                          |

**No issues found.** The implementation is clean, stateless, well-documented, and correctly handles edge cases (malformed cookies, missing headers, body field fallback).

---

## 2. Backend Sentry Integration (US-E0-010)

**File**: `packages/backend/src/lib/sentry.ts`
**ADR**: [ADR-017](../decisions/ADR-017-observability-stack.md)

### Review Findings

**PASS** -- Clean SDK integration with proper data sanitization.

| Check                            | Result | Notes                                           |
| -------------------------------- | ------ | ----------------------------------------------- |
| Real SDK import                  | PASS   | `@sentry/node` not a simulation                 |
| Graceful degradation without DSN | PASS   | Logs message and returns, no crash              |
| Data sanitization (beforeSend)   | PASS   | Strips authorization, cookie, x-api-key headers |
| Sensitive field redaction        | PASS   | password, token, secret, private_key, nsec      |
| Breadcrumb URL sanitization      | PASS   | Query params with tokens redacted               |
| Performance sampling             | PASS   | 10% default, configurable via env var           |
| Express integration              | PASS   | httpIntegration + expressIntegration            |
| Error handler export             | PASS   | setupExpressErrorHandler with fallback          |

**Minor observation**: The `sentryErrorHandler` export at line 80-82 uses a conditional check on `Sentry.setupExpressErrorHandler` existence. This is defensive coding for SDK version compatibility, which is appropriate.

---

## 3. Frontend Sentry Integration (US-E0-010)

**File**: `packages/frontend/src/monitoring/sentry.ts`
**ADR**: [ADR-017](../decisions/ADR-017-observability-stack.md)

### Review Findings

**PASS** -- Comprehensive frontend error tracking with free-tier budget awareness.

| Check                       | Result | Notes                                                      |
| --------------------------- | ------ | ---------------------------------------------------------- |
| Real SDK import             | PASS   | `@sentry/react` not a simulation                           |
| Browser tracing integration | PASS   | `browserTracingIntegration()`                              |
| Session replay with privacy | PASS   | `maskAllText: true`, `blockAllMedia: true`                 |
| Free tier budget settings   | PASS   | 0% session replay, 100% on-error replay, 10% traces        |
| Data sanitization           | PASS   | Authorization/cookie headers stripped                      |
| Breadcrumb sanitization     | PASS   | Token/key/nsec in URLs redacted                            |
| User context management     | PASS   | setUser/clearUser for session tracking                     |
| Performance measurement API | PASS   | `measurePerformance` / `measureAsyncPerformance` via spans |
| Flush before unload         | PASS   | `flush()` exported                                         |
| Initialization check        | PASS   | `isReady()` via `Sentry.getClient()`                       |

**No issues found.** The API surface (captureError, captureMessage, addBreadcrumb, measurePerformance) provides a clean abstraction over the Sentry SDK for application code.

---

## 4. Web Vitals (US-E0-010)

**File**: `packages/frontend/src/monitoring/web-vitals.ts`
**ADR**: [ADR-017](../decisions/ADR-017-observability-stack.md)

### Review Findings

**PASS** -- Correct implementation following Google's Web Vitals best practices.

| Check                            | Result | Notes                                                 |
| -------------------------------- | ------ | ----------------------------------------------------- |
| All Core Web Vitals collected    | PASS   | LCP, FID, CLS, TTFB, INP                              |
| Thresholds match Google's        | PASS   | LCP 2500/4000, FID 100/300, CLS 0.1/0.25, INP 200/500 |
| Dynamic import                   | PASS   | `import('web-vitals')` avoids blocking critical path  |
| Free tier budget awareness       | PASS   | Only poor vitals sent as Sentry messages              |
| All vitals as breadcrumbs        | PASS   | Provides debugging context without event cost         |
| Error handling on import failure | PASS   | `.catch()` logs warning, does not crash               |

**Note**: FID (First Input Delay) is deprecated in favor of INP (Interaction to Next Paint) as of March 2024. Both are collected here, which is correct for backwards compatibility with existing dashboards. FID collection can be removed in a future cleanup.

---

## 5. Health Checks (US-E0-010)

**File**: `packages/backend/src/routes/health.ts`
**ADR**: [ADR-017](../decisions/ADR-017-observability-stack.md)

### Review Findings

**PASS with one finding** -- Real health checks replace Math.random() simulation.

| Check                       | Result | Notes                                     |
| --------------------------- | ------ | ----------------------------------------- |
| No Math.random() simulation | PASS   | All checks are real service pings         |
| Database health check       | PASS   | Supabase client `select('*').limit(1)`    |
| Redis health check          | PASS   | `redis.ping()` with latency measurement   |
| Lightning health check      | PASS   | LNbits API wallet endpoint                |
| NOSTR relay health check    | PASS   | WebSocket connection test with 5s timeout |
| Response time thresholds    | PASS   | DB <1s, Redis <500ms, LN <2s, NOSTR <3s   |
| System metrics              | PASS   | Memory, CPU load, PID, uptime             |
| K8s probe endpoints         | PASS   | `/ready`, `/live`, `/health/detailed`     |
| Overall status aggregation  | PASS   | unhealthy > degraded > healthy            |

**FINDING-01 (Low Priority)**: The `checkRedis()` function at line 241 creates a **new Redis connection** on every readiness probe call:

```typescript
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
await redis.ping();
await redis.disconnect();
```

This works correctly but creates/destroys a TCP connection per check. In production under frequent readiness probes (every 10 seconds), this could create connection churn. **Recommendation**: Share a singleton Redis client instance for health checks, or reuse the application's existing Redis connection pool.

**FINDING-02 (Low Priority)**: The `checkDatabase()` function at line 200 creates a new Supabase client per call. Same connection churn concern as FINDING-01. **Recommendation**: Use a module-level singleton Supabase client for health checks.

---

## 6. Prometheus Metrics (US-E0-010)

**File**: `packages/backend/src/middleware/deployment-monitoring.ts`
**ADR**: [ADR-017](../decisions/ADR-017-observability-stack.md)

### Review Findings

**PASS** -- Proper prom-client integration replacing hand-rolled metrics.

| Check                      | Result | Notes                                                   |
| -------------------------- | ------ | ------------------------------------------------------- |
| Uses prom-client           | PASS   | Official Prometheus Node.js client                      |
| Default metrics collected  | PASS   | `collectDefaultMetrics()` with `sovren_` prefix         |
| HTTP request counter       | PASS   | Method/route/status_code labels                         |
| Request duration histogram | PASS   | Correct bucket boundaries for latency percentiles       |
| Active connections gauge   | PASS   | Inc on request start, dec on finish                     |
| Error counter              | PASS   | Separate counter for 4xx/5xx                            |
| Route normalization        | PASS   | UUIDs, pubkeys, numeric IDs replaced with placeholders  |
| Metrics endpoint           | PASS   | `/metrics` serves standard Prometheus exposition format |
| Self-scrape avoidance      | PASS   | `/metrics` path skipped in middleware                   |
| Business metrics exported  | PASS   | DB query duration, cache ops, queue metrics             |
| Rollback integration       | PASS   | Slack + GitHub Actions dispatch on health failure       |

**Architecture quality**: The `normalizeRoute()` function correctly addresses high-cardinality label explosion -- a common Prometheus pitfall. The regex patterns cover UUIDs, 64-char hex strings (NOSTR pubkeys), and numeric IDs.

---

## 7. Structured Logging with Correlation IDs (US-E0-010)

**Files**: `packages/backend/src/lib/logger.ts`, `packages/backend/src/middleware/correlation-id.ts`
**ADR**: [ADR-017](../decisions/ADR-017-observability-stack.md)

### Review Findings

**PASS** -- Clean AsyncLocalStorage-based correlation with proper Winston configuration.

| Check                            | Result | Notes                                                  |
| -------------------------------- | ------ | ------------------------------------------------------ |
| AsyncLocalStorage usage          | PASS   | Wraps every request in `asyncLocalStorage.run()`       |
| UUID generation                  | PASS   | `randomUUID()` from crypto                             |
| Upstream header reuse            | PASS   | X-Correlation-ID and X-Request-ID checked first        |
| Correlation ID in response       | PASS   | `X-Correlation-ID` response header set                 |
| Winston JSON format (production) | PASS   | JSON with timestamp, service, environment              |
| Winston colorized (development)  | PASS   | Human-readable with correlation ID prefix              |
| Sensitive data sanitization      | PASS   | Recursive redaction of password/token/secret/nsec/etc. |
| Log level configurability        | PASS   | `LOG_LEVEL` env var, defaults to 'info'                |

**No issues found.** The AsyncLocalStorage pattern is the Node.js-idiomatic way to propagate request context without explicit parameter passing. The correlation ID middleware is clean and focused.

---

## 8. Content Security Policy (US-E0-011)

**File**: `packages/backend/src/middleware/security-headers.ts`
**ADR**: [ADR-016](../decisions/ADR-016-csrf-double-submit-cookie.md) (CSP changes documented as part of security hardening)

### Review Findings

**PASS with one finding** -- CSP configuration is comprehensive.

| Check                                       | Result | Notes                                                      |
| ------------------------------------------- | ------ | ---------------------------------------------------------- |
| No `unsafe-inline` in production script-src | PASS   | Production config: `script-src: ["'self'"]`                |
| No `unsafe-inline` in production style-src  | PASS   | Production config: `style-src: ["'self'"]`                 |
| Nonce support                               | PASS   | `generateNonce()` with 16 random bytes, base64 encoded     |
| CSP report-uri                              | PASS   | `/api/security/csp-report`                                 |
| Development relaxed CSP                     | PASS   | `unsafe-inline` + `unsafe-eval` in dev, `reportOnly: true` |
| HSTS configuration                          | PASS   | 2 years max-age, includeSubDomains, preload (production)   |
| Frame options                               | PASS   | `DENY`                                                     |
| Permissions Policy                          | PASS   | Restrictive: camera, microphone, geolocation denied        |
| Cross-Origin policies                       | PASS   | require-corp, same-origin                                  |
| Fallback on error                           | PASS   | Minimal headers applied if middleware throws               |

**FINDING-03 (Medium Priority)**: The security headers middleware at line 262 logs the full CSP header to `console.log` on every request:

```typescript
private logCSPUsage(req: Request, cspHeader: string): void {
  console.log('CSP Header Applied:', { ... });
}
```

This creates excessive log volume in production. The CSP header is identical for every request (except the nonce), so per-request logging provides no diagnostic value. **Recommendation**: Remove the `logCSPUsage()` call from the `buildCSPHeader()` method. CSP violations are already captured via the reporting endpoint.

Additionally, `SecurityHeaderMonitor.logHeaderApplication()` is called for every header on every request (lines 902-966), generating 10+ log entries per request. **Recommendation**: Either remove per-request header logging entirely, or gate it behind a debug flag.

---

## 9. CI/CD Workflows (US-E0-009)

**Directory**: `.github/workflows/`
**ADR**: [ADR-018](../decisions/ADR-018-cicd-consolidation.md)

### Review Findings

**PASS** -- Workflows are well-structured with proper security hardening.

| Check                             | Result | Notes                                                       |
| --------------------------------- | ------ | ----------------------------------------------------------- |
| Top-level `permissions: read-all` | PASS   | ci.yml, backend-deployment.yml, security-scan.yml           |
| Job-level elevated permissions    | PASS   | Only where needed (packages: write, security-events: write) |
| Concurrency controls              | PASS   | `cancel-in-progress: true` for PRs                          |
| No soft_fail on security scans    | PASS   | Trivy `exit-code: '1'` for CRITICAL                         |
| SARIF upload to Security tab      | PASS   | Both backend and frontend results uploaded                  |
| Image signing (Cosign)            | PASS   | Keyless signing via sigstore                                |
| Staging before production         | PASS   | Pipeline enforces staging deployment first                  |
| Production manual approval        | PASS   | `environment: production` with GitHub approval gates        |
| Health checks post-deploy         | PASS   | Retry loops with HTTP status verification                   |
| Automated rollback                | PASS   | Separate rollback job triggered on deploy failure           |
| Deployment window checks          | PASS   | Business hours enforcement (Mon-Fri 9-5 EST)                |
| Slack notifications               | PASS   | Success and failure notifications via webhook               |
| Build caching                     | PASS   | Docker layer caching via `type=gha`                         |

**No issues found.** The consolidated `ci.yml` provides a clear, linear pipeline. Security is enforced at every stage. The backend deployment workflow implements blue-green deployment with progressive traffic shifting and automatic rollback.

---

## Summary of Findings

| ID         | Severity | Component        | Description                                                   | Phase   |
| ---------- | -------- | ---------------- | ------------------------------------------------------------- | ------- |
| FINDING-01 | Low      | Health checks    | Redis connection created per readiness probe -- use singleton | Phase 2 |
| FINDING-02 | Low      | Health checks    | Supabase client created per readiness probe -- use singleton  | Phase 2 |
| FINDING-03 | Medium   | Security headers | Excessive per-request CSP/header logging in production        | Phase 2 |

### Overall Assessment

All three Phase 0 workstreams delivered production-quality code:

- **CSRF**: Textbook double-submit cookie with timing-safe comparison and token rotation. No issues.
- **Observability**: Complete replacement of simulation code with real Sentry, prom-client, Winston, and Web Vitals. Free-tier budget awareness is well thought through.
- **CI/CD**: Consolidated pipeline with proper permissions, security scanning, and deployment gating. Blue-green deployment with rollback is well-architected.

The three findings above are minor optimizations, not blockers. Phase 0 deliverables are approved for Phase 2 integration.

---

## Architecture Decision Records Created

1. [ADR-016: CSRF Double-Submit Cookie Pattern](../decisions/ADR-016-csrf-double-submit-cookie.md)
2. [ADR-017: Observability Stack](../decisions/ADR-017-observability-stack.md)
3. [ADR-018: CI/CD Workflow Consolidation Strategy](../decisions/ADR-018-cicd-consolidation.md)
