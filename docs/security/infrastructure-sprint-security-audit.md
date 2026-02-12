# Infrastructure Sprint Security Audit Report

**Date**: 2026-02-12
**Auditor**: Security Engineer Agent
**Scope**: US-E0-009 (CI/CD), US-E0-010 (Observability), US-E0-011 (Security Gates)
**Status**: COMPLETE

---

## Executive Summary

The infrastructure sprint delivered production-grade security middleware including CSRF protection, security headers (CSP/HSTS), rate limiting, structured logging with sensitive data redaction, and correlation ID tracing. The overall security posture is **STRONG** with no critical vulnerabilities in the application code. The previously identified findings (FINDING-01 through FINDING-03) have been verified as fixed.

**Overall Risk Rating**: LOW (application code) / MODERATE (dependency chain)

| Category                    | Score      |
| --------------------------- | ---------- |
| CSRF Implementation         | 10/10      |
| Security Headers (CSP/HSTS) | 9/10       |
| Rate Limiting               | 9/10       |
| Error Tracking (Sentry)     | 9/10       |
| Logging & Correlation       | 10/10      |
| Health Checks               | 9/10       |
| Database Configuration      | 10/10      |
| CI/CD Pipeline Security     | 9/10       |
| Dependency Security         | 6/10       |
| **Overall**                 | **90/100** |

---

## 1. SAST Findings

### 1.1 eval() Usage -- LOW RISK

**File**: `packages/backend/src/middleware/content-sanitization.ts:1196`
**Pattern**: `eval(atob("YWxlcnQoMSk="))`
**Assessment**: This is a **test vector** within a content sanitization rules array, not actual code execution. It is used to detect and block eval-based XSS payloads. **No action required.**

### 1.2 dangerouslySetInnerHTML -- LOW RISK (Mitigated)

**File**: `packages/frontend/src/features/content/components/MarkdownEditor.tsx:541`

```typescript
dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(convertMarkdownToHTML(markdown)) }}
```

**Assessment**: Properly sanitized with DOMPurify before rendering. **Acceptable.**

**File**: `packages/frontend/src/components/onboarding/SovereignOnboarding.tsx:1310`

```typescript
<style dangerouslySetInnerHTML={{ __html: `...static CSS...` }} />
```

**Assessment**: Contains only a **hardcoded CSS string literal** (grid pattern). No user input flows into this. **No risk.**

**File**: `packages/frontend/src/features/content/components/RichTextEditor.tsx:89`

```typescript
editorRef.current.innerHTML = DOMPurify.sanitize(content);
```

**Assessment**: Properly sanitized with DOMPurify. **Acceptable.**

### 1.3 Hardcoded Credentials -- MODERATE (1 issue)

**File**: `packages/shared/src/services/NostrSecureKeyStorage.ts:476`

```typescript
const password = 'sovren-key-material'; // In production, this would be user-provided
```

**Finding ID**: FINDING-04
**Severity**: MODERATE
**CWE**: CWE-798 (Use of Hard-coded Credentials)
**Assessment**: The PBKDF2 key derivation uses a hardcoded password string. The inline comment acknowledges this is a placeholder, but this should be addressed before production deployment. All other credential references in the codebase are in test files (`__tests__/`), test utilities, configuration description strings, or `.env.example` patterns -- these are acceptable.

**Recommendation**: Replace with user-provided password or derive from the user's NOSTR key material.

### 1.4 SQL Query Construction -- LOW RISK (Parameterized)

All SQL query construction found uses parameterized queries:

- `packages/backend/src/services/user/UserAnalyticsService.ts` -- Uses `$${paramIndex++}` positional parameters
- `packages/backend/src/services/user/UserActivityService.ts` -- Uses `$${paramIndex++}` positional parameters
- `packages/backend/src/services/payment/InvoiceService.ts` -- Uses `$${paramIndex++}` positional parameters
- `packages/backend/src/factories/shared/SharedServiceFactory.ts` -- Uses `?` placeholders with params array

**One concern in UserAnalyticsService.ts:1304**:

```typescript
query += ` GROUP BY DATE_TRUNC('${filters.groupBy}', timestamp)`;
```

**Finding ID**: FINDING-05
**Severity**: MODERATE
**CWE**: CWE-89 (SQL Injection)
**Assessment**: The `filters.groupBy` value is interpolated directly into the SQL query string rather than parameterized. If `groupBy` comes from user input without validation, this is a SQL injection vector. Verify that `groupBy` is validated against a whitelist of allowed values (e.g., 'hour', 'day', 'week', 'month').

**Recommendation**: Add explicit whitelist validation for `filters.groupBy` before query construction:

```typescript
const ALLOWED_GROUP_BY = ['hour', 'day', 'week', 'month', 'year'];
if (!ALLOWED_GROUP_BY.includes(filters.groupBy)) {
  throw new Error('Invalid groupBy value');
}
```

### 1.5 Command Injection -- NO RISK

- `child_process` import found only in `packages/backend/src/__tests__/production-docker.test.ts` (test file, not production code)
- `pipeline.exec()` in `CacheService.ts` is a Redis pipeline execution, not shell command execution
- No user input reaches any exec/spawn calls

### 1.6 unsafe-inline CSP -- DEVELOPMENT ONLY (Acceptable)

**File**: `packages/backend/src/middleware/security-headers.ts:660-661`

```typescript
'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
'style-src': ["'self'", "'unsafe-inline'"],
```

**Assessment**: These directives exist only in the **development** configuration block (loaded when `NODE_ENV === 'development'`). The production configuration at line 676-679 correctly restricts to `'self'` only. **No action required.**

---

## 2. CSRF Implementation Review

**File**: `packages/backend/src/middleware/csrf.ts`

| Check                                   | Result | Notes                                                          |
| --------------------------------------- | ------ | -------------------------------------------------------------- |
| crypto.randomBytes for token generation | PASS   | 32 bytes (64 hex chars) via `crypto.randomBytes(TOKEN_LENGTH)` |
| crypto.timingSafeEqual for comparison   | PASS   | Used in `tokensMatch()` with length pre-check                  |
| Length check before timingSafeEqual     | PASS   | `a.length !== b.length` guard prevents timing leak             |
| Token rotation after use                | PASS   | New token generated after successful validation (line 162)     |
| SameSite cookie attribute               | PASS   | Set to `lax` by default                                        |
| Secure flag in production               | PASS   | `secure: process.env.NODE_ENV === 'production'`                |
| httpOnly: false (intentional)           | PASS   | Required for double-submit pattern (JS must read cookie)       |
| Excluded paths make sense               | PASS   | CSP report, payment webhooks (use HMAC), health endpoints      |
| Safe methods excluded                   | PASS   | GET, HEAD, OPTIONS                                             |
| Error responses don't leak info         | PASS   | Generic "CSRF token missing/invalid" messages                  |

**CSRF Verdict**: Excellent implementation. Double-submit cookie pattern is correctly implemented with all security best practices.

---

## 3. Security Headers Review

**File**: `packages/backend/src/middleware/security-headers.ts`

### 3.1 CSP (Content Security Policy)

| Directive                 | Production Value    | Assessment              |
| ------------------------- | ------------------- | ----------------------- |
| default-src               | 'self'              | PASS                    |
| script-src                | 'self'              | PASS (no unsafe-inline) |
| style-src                 | 'self'              | PASS                    |
| img-src                   | 'self' data: https: | PASS                    |
| object-src                | 'none'              | PASS                    |
| frame-src                 | 'none'              | PASS                    |
| frame-ancestors           | 'none'              | PASS                    |
| base-uri                  | 'self'              | PASS                    |
| form-action               | 'self'              | PASS                    |
| upgrade-insecure-requests | Present             | PASS                    |
| block-all-mixed-content   | Present             | PASS                    |

**Note**: connect-src includes `'self'`, `https://api.sovren.dev`, `wss:`, `https:` -- the broad `https:` allowlist is permissive. Consider restricting to specific domains if possible, though this may be intentional for NOSTR relay connectivity.

### 3.2 HSTS

| Property          | Value                                                    | Assessment |
| ----------------- | -------------------------------------------------------- | ---------- |
| max-age           | 31536000 (1 year default), 63072000 (2 years production) | PASS       |
| includeSubDomains | true                                                     | PASS       |
| preload           | true                                                     | PASS       |

### 3.3 Other Headers

| Header                       | Value                                     | Assessment |
| ---------------------------- | ----------------------------------------- | ---------- |
| X-Frame-Options              | DENY                                      | PASS       |
| X-Content-Type-Options       | nosniff                                   | PASS       |
| X-XSS-Protection             | 1; mode=block                             | PASS       |
| Referrer-Policy              | strict-origin-when-cross-origin           | PASS       |
| Permissions-Policy           | All features denied except payment='self' | PASS       |
| Cross-Origin-Embedder-Policy | require-corp                              | PASS       |
| Cross-Origin-Opener-Policy   | same-origin                               | PASS       |
| Cross-Origin-Resource-Policy | same-origin                               | PASS       |

**Security Headers Verdict**: Comprehensive and well-configured. Nonce-based CSP is available via `generateNonce()`. The `connect-src https:` is broad but may be required for NOSTR relay connectivity.

---

## 4. Rate Limiter Review

**File**: `packages/backend/src/middleware/rate-limit-middleware.ts`

| Check                               | Result | Notes                                                           |
| ----------------------------------- | ------ | --------------------------------------------------------------- |
| Redis-backed store available        | PASS   | `createRedisRateLimiter()` for distributed deployments          |
| Sensible defaults per endpoint type | PASS   | Auth: 10/15min, Content: 10/min, Payment: 20/min, Read: 100/min |
| Health checks excluded              | PASS   | Skips `/health` and `/api/health`                               |
| Standard headers enabled            | PASS   | `standardHeaders: true`, legacy headers disabled                |
| Per-user rate limiting available    | PASS   | Falls back to IP if user not authenticated                      |
| Bypass only in dev/test             | PASS   | Test: bypass all; Dev: requires secret header                   |

**Bypass Vector Analysis**: The `bypassRateLimitInTest` function at line 272 allows bypass in `NODE_ENV=test` unconditionally and in development with a header matching `RATE_LIMIT_BYPASS_SECRET`. This is acceptable as it cannot be triggered in production.

**Rate Limiter Verdict**: Well-designed with appropriate granularity. Redis backing ensures correctness across multiple instances.

---

## 5. Sentry Data Sanitization Review

### 5.1 Backend (`packages/backend/src/lib/sentry.ts`)

| Sanitization                       | Result |
| ---------------------------------- | ------ |
| authorization header redacted      | PASS   |
| cookie header redacted             | PASS   |
| x-api-key header redacted          | PASS   |
| password fields in request body    | PASS   |
| token fields in request body       | PASS   |
| secret fields in request body      | PASS   |
| private_key fields in request body | PASS   |
| nsec (NOSTR secret key)            | PASS   |
| Breadcrumb URL token redaction     | PASS   |

### 5.2 Frontend (`packages/frontend/src/monitoring/sentry.ts`)

| Sanitization                                  | Result |
| --------------------------------------------- | ------ |
| authorization header redacted                 | PASS   |
| cookie header redacted                        | PASS   |
| Breadcrumb URL token/key/secret/password/nsec | PASS   |
| Session replay masks all text                 | PASS   |
| Session replay blocks all media               | PASS   |

**Finding ID**: FINDING-06
**Severity**: LOW
**Assessment**: The frontend Sentry `beforeSend` does not redact `x-api-key` header (backend does). While this header is unlikely to appear in frontend requests, adding it for defense-in-depth would be consistent.

**Sentry Verdict**: Solid sanitization. The NOSTR-specific `nsec` key redaction is a thoughtful addition.

---

## 6. Health Routes Review

**File**: `packages/backend/src/routes/health.ts`

| Check                                                    | Result       | Notes                                                                             |
| -------------------------------------------------------- | ------------ | --------------------------------------------------------------------------------- |
| Singleton Redis/Supabase clients (FINDING-01/02)         | PASS (FIXED) | Module-level singletons with lazy initialization                                  |
| No user-supplied URLs in health probes                   | PASS         | All URLs from env vars only                                                       |
| Detailed health check not publicly accessible by default | INFO         | `/health/detailed` exposes system metrics; ensure it is behind auth in production |
| Error messages don't leak stack traces                   | PASS         | Only `error.message` exposed                                                      |
| SSRF vectors                                             | NONE         | `LNBITS_API_URL` and `NOSTR_RELAYS` sourced from environment only                 |

**Finding ID**: FINDING-07
**Severity**: LOW
**Assessment**: The `/health/detailed` endpoint exposes memory usage, CPU load, PID, uptime, and Node.js version. While useful for monitoring, this information should be restricted to internal/authenticated callers in production. Consider adding basic auth or IP allowlisting for this endpoint.

---

## 7. Database Configuration Review

**File**: `packages/backend/src/config/database-pool.config.ts`

| Check                               | Result             | Notes                                                    |
| ----------------------------------- | ------------------ | -------------------------------------------------------- |
| SSL enforced in production          | PASS               | `rejectUnauthorized: true` for staging and production    |
| SSL enforced in staging             | PASS               | Same as production                                       |
| SSL disabled in dev/test            | PASS (Appropriate) | Local development does not need SSL                      |
| Zod validation of config            | PASS               | All config values validated against schema               |
| Connection string not hardcoded     | PASS               | Sourced from `DATABASE_URL` or individual `PG*` env vars |
| Statement/query timeouts configured | PASS               | 30s production, 60s dev, 10s test                        |
| Pool sizing reasonable              | PASS               | Max 20 production, calculated with HikariCP formula      |

**Database Config Verdict**: Production-ready configuration with proper SSL enforcement.

---

## 8. Logging & Correlation ID Review

### Logger (`packages/backend/src/lib/logger.ts`)

| Check                                                                                                                   | Result |
| ----------------------------------------------------------------------------------------------------------------------- | ------ |
| Structured JSON format in production                                                                                    | PASS   |
| Correlation ID injected from AsyncLocalStorage                                                                          | PASS   |
| Sensitive data redaction                                                                                                | PASS   |
| Redacted fields include: password, token, secret, authorization, cookie, x-api-key, credit_card, ssn, private_key, nsec | PASS   |
| Recursive object sanitization                                                                                           | PASS   |
| Log level configurable via env                                                                                          | PASS   |

### Correlation ID (`packages/backend/src/middleware/correlation-id.ts`)

| Check                                   | Result |
| --------------------------------------- | ------ |
| Uses crypto.randomUUID()                | PASS   |
| Accepts upstream X-Correlation-ID       | PASS   |
| Accepts upstream X-Request-ID           | PASS   |
| Sets response header for client tracing | PASS   |
| Uses AsyncLocalStorage (non-blocking)   | PASS   |

**Logging Verdict**: Excellent implementation. The combination of structured logging, automatic correlation, and sensitive data redaction meets production observability standards.

---

## 9. CI/CD Pipeline Security Review

**File**: `.github/workflows/ci.yml`

| Check                                   | Result | Notes                                       |
| --------------------------------------- | ------ | ------------------------------------------- |
| permissions: read-all (least privilege) | PASS   | Global read-only, scoped write where needed |
| Concurrency control                     | PASS   | Cancels in-progress PR runs                 |
| Pinned action versions (@v4, @v3, etc.) | PASS   | All actions use major version tags          |
| npm audit in pipeline                   | PASS   | `npm audit --audit-level=high`              |
| Trivy filesystem scan                   | PASS   | CRITICAL/HIGH severity, exit-code: 1        |
| Trivy image scan                        | PASS   | Fails on CRITICAL                           |
| SARIF upload to GitHub Security         | PASS   | Both backend and frontend images            |
| Manual approval for production          | PASS   | Uses GitHub Environments                    |
| Secrets via ${{ secrets.* }}            | PASS   | No hardcoded secrets in workflows           |
| Health check after deploy               | PASS   | Both staging and production                 |
| Hadolint Dockerfile scanning            | PASS   | In security-scan.yml                        |

**CI/CD Verdict**: Well-structured pipeline with security gates at every stage. The separate security-scan.yml provides scheduled daily scans.

---

## 10. CORS Configuration Review

**File**: `packages/backend/src/app.ts:76-87`

| Check                          | Result                                    |
| ------------------------------ | ----------------------------------------- |
| Production origin restricted   | PASS (`sovren.app`, `www.sovren.app`)     |
| Development origin restricted  | PASS (`localhost:3000`, `localhost:5173`) |
| Credentials enabled            | PASS (required for cookies/CSRF)          |
| X-CSRF-Token in allowedHeaders | PASS                                      |
| X-CSRF-Token in exposedHeaders | PASS                                      |
| Wildcard origin (\*)           | NOT PRESENT (correct)                     |

---

## 11. Dependency Vulnerability Summary (npm audit)

**Total**: 44 vulnerabilities

| Severity | Count | Key Packages                                                                                  |
| -------- | ----- | --------------------------------------------------------------------------------------------- |
| Critical | 1     | form-data (unsafe random for boundary)                                                        |
| High     | 27    | express, body-parser, axios, react-router, playwright, validator, tar, ws, node-forge, others |
| Moderate | 8     | vite, nodemailer, lodash, undici, js-yaml                                                     |
| Low      | 8     | brace-expansion, eslint-plugin-kit, others                                                    |

### Critical Vulnerabilities

| Package               | Issue                                     | Fix Available |
| --------------------- | ----------------------------------------- | ------------- |
| form-data 4.0.0-4.0.3 | Uses unsafe random for multipart boundary | Yes (patch)   |

### Notable High-Severity Vulnerabilities

| Package                       | Issue                                      | Direct Dep?          | Fix                     |
| ----------------------------- | ------------------------------------------ | -------------------- | ----------------------- |
| express <=4.21.2              | XSS via response.redirect(), open redirect | Yes                  | Update to 4.22+         |
| body-parser <1.20.3           | DoS via URL encoding                       | Transitive (express) | Update express          |
| axios <=1.13.4                | DoS via data size / **proto** key          | No                   | Update to 1.14+         |
| @remix-run/router <=1.23.1    | XSS via open redirects (React Router)      | No                   | Update react-router-dom |
| react-router-dom 6.0.0-6.30.2 | External redirect via untrusted paths      | Yes                  | Update to 6.31+         |
| validator <=13.15.20          | URL validation bypass                      | Yes                  | Update to 13.16+        |
| path-to-regexp <=0.1.11       | ReDoS                                      | Yes                  | Update to 0.1.12        |
| playwright <1.55.1            | SSL certificate not verified on download   | Yes                  | Update                  |
| storybook 9.0.0-9.1.16        | Env vars exposed during build              | Yes                  | Update to 9.2+          |

### Recommended Remediation Priority

1. **Immediate**: `form-data` (critical), `express`/`body-parser` (high, direct deps)
2. **This Sprint**: `react-router-dom`/`@remix-run/router` (XSS), `axios` (DoS), `validator` (bypass), `path-to-regexp` (ReDoS)
3. **Next Sprint**: `playwright`, `puppeteer` (dev dependencies), `storybook` (dev dependency), `nodemailer`, `vite`
4. **Track**: `ipfs-http-client` and transitive deps (major version upgrade required)

---

## 12. OWASP Top 10 (2021) Compliance Assessment

### A01: Broken Access Control -- PASS

- CSRF middleware with double-submit cookie pattern on all state-changing routes
- CORS restricted to specific origins (no wildcard)
- X-Frame-Options: DENY prevents clickjacking
- frame-ancestors: 'none' in CSP provides belt-and-suspenders

### A02: Cryptographic Failures -- PASS

- `crypto.randomBytes()` for CSRF tokens (CSPRNG)
- `crypto.timingSafeEqual()` for token comparison
- `crypto.randomUUID()` for correlation IDs
- SSL/TLS enforced for database in production (`rejectUnauthorized: true`)
- HSTS with preload prevents downgrade attacks
- One concern: hardcoded PBKDF2 password in NostrSecureKeyStorage (FINDING-04)

### A03: Injection -- PASS (with caveat)

- All SQL queries use parameterized placeholders (`$1`, `?`)
- One `DATE_TRUNC('${filters.groupBy}')` string interpolation in UserAnalyticsService needs whitelist validation (FINDING-05)
- No command injection vectors in production code
- Content sanitization middleware blocks eval-based XSS patterns
- DOMPurify used for all HTML rendering

### A04: Insecure Design -- PASS

- Rate limiting configured per endpoint type with appropriate thresholds
- Defense-in-depth approach: Helmet + custom security headers + CSRF + rate limiting
- Error handling middleware with proper fallback (minimal security headers on error)
- Structured error responses without stack trace leakage

### A05: Security Misconfiguration -- PASS

- CSP strict in production (no unsafe-inline)
- HSTS max-age 2 years with preload in production
- All security headers properly configured
- Development-only relaxations are gated behind NODE_ENV checks
- Cookie secure flag gated on production

### A06: Vulnerable and Outdated Components -- NEEDS ATTENTION

- 44 npm audit vulnerabilities (1 critical, 27 high)
- Key direct dependencies need updating: express, react-router-dom, validator, path-to-regexp
- Trivy scanning in CI/CD catches container-level vulnerabilities
- `npm audit` runs in CI pipeline with `--audit-level=high`

### A07: Identification and Authentication Failures -- N/A

Not in scope for this infrastructure sprint (no auth changes).

### A08: Software and Data Integrity Failures -- PASS

- CSRF protection prevents cross-site request forgery
- Docker images scanned with Trivy in CI
- Action versions pinned in GitHub workflows
- SBOM generation and SARIF upload to GitHub Security tab

### A09: Security Logging and Monitoring Failures -- PASS

- Winston structured logging with JSON output for Loki ingestion
- Correlation IDs propagated via AsyncLocalStorage
- Sensitive data automatically redacted from logs
- Sentry integration for error tracking with data sanitization
- CSP violation reporting endpoint
- Security header monitoring with compliance scoring

### A10: Server-Side Request Forgery (SSRF) -- PASS

- Health check URLs sourced exclusively from environment variables
- No user-supplied URLs reach HTTP clients in health probes
- Lightning health check uses `LNBITS_API_URL` env var only
- NOSTR health check uses `NOSTR_RELAYS` env var only

---

## 13. Previously Reported Findings Status

| Finding    | Issue                             | Status                                                          |
| ---------- | --------------------------------- | --------------------------------------------------------------- |
| FINDING-01 | Health check Redis singleton      | **FIXED** -- Module-level lazy singleton (health.ts:8-16)       |
| FINDING-02 | Health check Supabase singleton   | **FIXED** -- Module-level lazy singleton (health.ts:18-26)      |
| FINDING-03 | CSP logging gated behind NODE_ENV | **FIXED** -- Only logs in development (security-headers.ts:262) |

---

## 14. New Findings Summary

| ID         | Severity | CWE     | File                                                            | Description                                                                                 |
| ---------- | -------- | ------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| FINDING-04 | MODERATE | CWE-798 | packages/shared/src/services/NostrSecureKeyStorage.ts:476       | Hardcoded PBKDF2 password 'sovren-key-material' should be user-provided                     |
| FINDING-05 | MODERATE | CWE-89  | packages/backend/src/services/user/UserAnalyticsService.ts:1304 | `filters.groupBy` interpolated directly into SQL without whitelist validation               |
| FINDING-06 | LOW      | CWE-200 | packages/frontend/src/monitoring/sentry.ts                      | Frontend Sentry `beforeSend` does not redact `x-api-key` header (inconsistent with backend) |
| FINDING-07 | LOW      | CWE-200 | packages/backend/src/routes/health.ts                           | `/health/detailed` exposes system metrics; consider restricting in production               |

---

## 15. Recommendations

### Immediate Actions (This Sprint)

1. **Update critical/high direct dependencies**: Run `npm update express body-parser form-data react-router-dom validator path-to-regexp` and verify tests pass.
2. **Validate `filters.groupBy`** in UserAnalyticsService.ts against a whitelist before SQL interpolation (FINDING-05).

### Short-Term (Next Sprint)

3. Replace hardcoded PBKDF2 password in NostrSecureKeyStorage with user-provided input (FINDING-04).
4. Add `x-api-key` redaction to frontend Sentry `beforeSend` (FINDING-06).
5. Add auth/IP restriction to `/health/detailed` endpoint (FINDING-07).
6. Update remaining high-severity dependencies (axios, storybook, playwright).

### Long-Term

7. Consider restricting `connect-src` in CSP to specific NOSTR relay domains rather than broad `https:`.
8. Plan major version upgrades for ipfs-http-client, puppeteer, nodemailer, testcontainers.
9. Enable npm audit `--audit-level=moderate` in CI once high-severity items are resolved.

---

## Appendix A: Files Audited

| File                                                     | Lines | Status  |
| -------------------------------------------------------- | ----- | ------- |
| packages/backend/src/middleware/csrf.ts                  | 177   | Audited |
| packages/backend/src/middleware/security-headers.ts      | 1094  | Audited |
| packages/backend/src/middleware/rate-limit-middleware.ts | 301   | Audited |
| packages/backend/src/lib/sentry.ts                       | 85    | Audited |
| packages/frontend/src/monitoring/sentry.ts               | 214   | Audited |
| packages/backend/src/routes/health.ts                    | 409   | Audited |
| packages/backend/src/config/database-pool.config.ts      | 352   | Audited |
| packages/backend/src/lib/logger.ts                       | 107   | Audited |
| packages/backend/src/middleware/correlation-id.ts        | 74    | Audited |
| packages/backend/src/app.ts (CORS section)               | N/A   | Audited |
| .github/workflows/ci.yml                                 | 315   | Audited |
| .github/workflows/security-scan.yml                      | 215   | Audited |

## Appendix B: SAST Patterns Scanned

| Pattern                   | Scope                      | Results                                        |
| ------------------------- | -------------------------- | ---------------------------------------------- |
| `eval(`                   | Backend src                | 1 hit (test vector in sanitization rules)      |
| `dangerouslySetInnerHTML` | Frontend src               | 2 hits (both DOMPurify-sanitized or static)    |
| `innerHTML =`             | Frontend src               | 1 hit (DOMPurify-sanitized)                    |
| Hardcoded credentials     | All packages (excl. tests) | 1 hit (NostrSecureKeyStorage)                  |
| `exec(`/`spawn(`          | Backend src                | 0 production hits (only in test files)         |
| SQL concatenation         | Backend src                | Parameterized queries; 1 interpolation concern |
| `unsafe-inline`           | Backend src                | Development config only                        |
| `child_process` import    | Backend src                | Test file only                                 |
| CORS wildcard             | Backend src                | Not present                                    |

---

_Report generated by Security Engineer Agent as part of Infrastructure Sprint Phase 3 verification._
