---
title: 'Production Readiness Remediation — 12-Agent Audit to 5-Phase Sequential Fix'
category: infrastructure-issues
date: 2026-03-25
tags:
  [
    production-readiness,
    security,
    rls,
    idor,
    gdpr,
    ci-cd,
    testing,
    circuit-breakers,
    parallel-audit,
    nostr,
    lightning,
    idempotency,
    compliance,
  ]
severity: critical
module: full-stack
problem_type: infrastructure_issue
recurrence: 1
related_prs: [171, 172, 173, 174, 175]
audit_scope: 12-domains
findings_total: 157
findings_resolved: 43
---

# Production Readiness Audit Remediation — 43 P0+P1 Fixes Across 5 Phases

## Problem

Sovren — a 10-month-old decentralized creator monetization platform on NOSTR + Lightning — appeared production-ready based on its documentation (99/100 quality score, 94% type safety, 100% test success rate). A 12-agent parallel production readiness audit revealed 157 findings across 12 domains, including 7 P0 launch blockers and 36 P1 must-fix items. The overarching theme: **"strict by config, permissive in practice"** — quality mechanisms existed but did not block.

### Key Symptoms

- TypeScript `strict: true` in tsconfig but 157 files silenced with `@ts-nocheck`
- ESLint rules configured in an inactive flat config (ESLint 9 format on ESLint 8)
- Coverage thresholds documented in CLAUDE.md but never enforced in CI
- RLS enabled on core tables but missing on ~55 added in later epics
- `VITE_DEMO_MODE: 'true'` baked into production build artifact via CI env var
- Real Supabase credentials committed to a non-gitignored `.env` path

## Root Cause

Incremental feature development across 9 slices added tables, routes, and services without propagating the security/quality patterns established in the baseline. Each new epic copied the route structure but not the ownership middleware. Each new migration created tables but not RLS policies. The CI pipeline grew organically without verifying its quality gates were load-bearing.

## Audit Methodology

### 12-Agent Parallel Audit (New Pattern)

Spawn 12 domain-expert agents simultaneously, each with:

- **Scoped file access** (non-overlapping file ownership = zero conflicts)
- **Enterprise checklist** per domain (AWS Well-Architected + Google SRE + OWASP + 12-Factor)
- **Structured output format** (finding ID, severity, evidence with file:line, effort estimate, fix recommendation)

| #   | Agent          | Focus                 | Key Findings                                              |
| --- | -------------- | --------------------- | --------------------------------------------------------- |
| 1   | Security       | Auth, OWASP, CVEs     | Webhook timing oracle, IDOR on 8+ endpoints               |
| 2   | Testing        | Coverage, quality     | 0.6% frontend coverage, PaymentProcessingService untested |
| 3   | CI/CD          | Pipeline, deploy      | Demo mode in prod, no rollback, no migration step         |
| 4   | Observability  | Logging, metrics      | Prometheus scrape auth broken, no business metrics        |
| 5   | Performance    | N+1, caching          | Unbounded queries, Redis KEYS blocking                    |
| 6   | Database       | Schema, RLS           | ~55 tables missing RLS, ~19 missing FK                    |
| 7   | API Design     | Contracts, versioning | No idempotency on payments, no OpenAPI                    |
| 8   | Infrastructure | Scaling, secrets      | Credentials on disk, local fs breaks replicas             |
| 9   | Error Handling | Degradation           | uncaughtException not in Sentry                           |
| 10  | Documentation  | Runbooks, API docs    | No incident response, no DR plan                          |
| 11  | Code Quality   | Debt, complexity      | 157 @ts-nocheck, dual ESLint configs                      |
| 12  | Compliance     | GDPR, privacy         | No deletion/export, NOSTR keys server-side                |

**Critical gate**: SpecFlow analysis after audit, before coding — identified 14 dependency gaps and correct phase ordering.

### 5-Phase Sequential Remediation

| Phase     | PR   | Focus                  | Findings | Lines      |
| --------- | ---- | ---------------------- | -------- | ---------- |
| 1         | #171 | Emergency Triage       | 10       | +1,338     |
| 2         | #172 | Security Hardening     | 9        | +1,014     |
| 3         | #173 | Infrastructure & CI/CD | 6        | +364       |
| 4         | #174 | Testing & Quality      | 6        | +1,082     |
| 5         | #175 | Compliance & Docs      | 12       | +1,796     |
| **Total** |      |                        | **43**   | **+5,594** |

## Key Patterns (Reusable)

### Pattern A: Timing-Safe Comparison — Hash to Fixed Length

```typescript
// WRONG — length pre-check leaks timing information
if (a.length !== b.length) return false;
return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

// CORRECT — hash both to fixed-length digests, then compare
const aBuf = crypto.createHash('sha256').update(a).digest();
const bBuf = crypto.createHash('sha256').update(b).digest();
return crypto.timingSafeEqual(aBuf, bBuf);
```

**Detection rule**: `timingSafeEqual` preceded by any `.length` comparison within 3 lines = P1.

### Pattern B: Two-Layer IDOR Prevention

- **Layer 1 — Route middleware**: `requireOwnership` checks `req.user.nostr_pubkey === req.params.id` for user-resource routes
- **Layer 2 — Controller verification**: Payment controllers verify resource belongs to authenticated user before returning data

Both layers required. Middleware catches the broad case; controllers catch resource-specific ownership.

### Pattern C: RLS Column Type Audit Before Policy Writing

```sql
-- Run BEFORE writing any RLS policy
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'target_table' AND column_name IN ('user_id', 'creator_id');
```

RLS policies comparing `uuid` to `text` fail silently — the policy evaluates to false for all rows, causing data lockout. Pattern #130 from prior sprint confirmed.

### Pattern D: StorageService with Local Fallback

Supabase Storage in production, local filesystem in development. A single `uploadFile()` function abstracts the difference. Eliminates the class of "works locally, 404 in production" bugs caused by local `fs.writeFile` in multi-replica deployments.

### Pattern E: Circuit Breaker Profiles by Service Type

```typescript
const profiles = {
  supabase: { timeout: 15000, errorThreshold: 50%, reset: 30s },
  lnbits:   { timeout: 10000, errorThreshold: 40%, reset: 60s },
  nostr:    { timeout: 20000, errorThreshold: 60%, reset: 45s },
  email:    { timeout: 30000, errorThreshold: 70%, reset: 60s },
};
```

Payment circuits trip faster (lower threshold) because failed payments are high-cost. Email tolerates more errors.

### Pattern F: Idempotency Middleware with Redis + In-Memory Fallback

Redis stores `idempotency:{key}` → `{statusCode, body}` with 24h TTL. Falls back to in-memory Map (1000 entries) if Redis unavailable. Applied to `POST /invoices`, `/subscriptions`, `/refunds`. Intercepts `res.json()` to cache response transparently.

### Pattern G: GDPR Soft-Delete with NIP-09 Relay Deletion

1. Soft-delete: `users.deleted_at = now()`, `status = 'inactive'`
2. Anonymize payment PII (retain amounts for financial audit)
3. Delete sessions, preferences, activity logs
4. Best-effort NIP-09 kind:5 deletion events to NOSTR relays
5. BullMQ scheduled job hard-deletes after 30-day grace period

Legal position: NOSTR relay data is outside platform control. Document in privacy policy.

## Review Caught Pre-Production P1s

The `/ce-review` phase after Phase 1 caught 2 P1 blockers that would have caused production failures:

1. **Timing oracle length leak in the fix itself** — the initial `timingSafeCompare` had a `a.length !== b.length` pre-check
2. **Missing `compression` runtime dependency** — added to imports but only `@types/compression` was in devDependencies

**Lesson**: Post-remediation review is mandatory. The act of fixing a vulnerability can introduce a new one in the same file. (auto memory [claude]: "Post-remediation review always — catches 3+ new P1s after bulk fixes")

## Prevention Strategies

### Meta-Principle: Make Quality Load-Bearing

> If a quality check does not cause a build to fail, it does not exist.

Every gap in this sprint traces to a quality mechanism that existed but did not block.

### CI/CD Prevention

1. **@ts-nocheck ratchet**: Track count in `ci/ts-nocheck-baseline.txt`. PRs can only decrease it.
2. **ESLint `--max-warnings 0`**: Warnings now fail the build (added in Phase 4).
3. **RLS coverage scanner**: `CREATE TABLE` without `ENABLE ROW LEVEL SECURITY` in same migration = CI failure.
4. **Route middleware audit**: Static analysis verifies every route passes through `authenticate`.
5. **Secret scanning**: TruffleHog in CI + `secretlint` pre-commit hook.
6. **Coverage thresholds in runner config**: Not in docs — in `vitest.config.ts` where CI enforces them.

### Code Review Focus

1. **Two-check rule**: Every route needs BOTH `authenticate` (who are you?) AND ownership verification (is this yours?).
2. **Migration four questions**: RLS enabled? Correct user context function? Column types consistent? Rollback path?
3. **Environment variable review**: Added to `.env.example`? Default-absent safe for production?

### Architecture Prevention

1. **Centralized route registration** with mandatory middleware (auth is opt-out, not opt-in)
2. **RLS-by-default migration template** in `supabase/templates/`
3. **Runtime feature flags** (not build-time env vars) — `NODE_ENV === 'development' && DEMO_MODE`

## Related Documentation

- `docs/solutions/patterns/critical-patterns.md` — Patterns #1-6 (TOCTOU, auth, pagination, atomic writes, payment persistence, SSRF)
- `docs/solutions/security-issues/p1-critical-fixes-pr73-round4.md` — JWT secret generation, payment persistence
- `docs/solutions/infrastructure-issues/cicd-full-pipeline-hardening-sprint-prs117-130-20260302.md` — Pipeline hardening
- `docs/solutions/testing/payment-test-harness-mock-elimination-20260226.md` — PaymentTestHarness pattern
- `docs/solutions/security-issues/discovery-mvp-r2-postgrest-view-security-20260227.md` — RLS VIEW patterns

### Refresh Candidates

- `critical-patterns.md` — needs new patterns for webhook HMAC, idempotency, circuit breakers
- `common-solutions.md` — needs deploy secret guards, Docker lockfile, consent management
- `PROJECT_CONTEXT.md` — needs updated Critical Patterns Index

## Sprint Statistics

| Metric              | Value                                                          |
| ------------------- | -------------------------------------------------------------- |
| Audit agents        | 12 (parallel)                                                  |
| Total findings      | 157                                                            |
| P0+P1 resolved      | 43                                                             |
| PRs created         | 5                                                              |
| Lines added         | +5,594                                                         |
| Supabase migrations | 5                                                              |
| New test files      | 4 (~1,100 lines)                                               |
| New services        | 3 (StorageService, UserDeletionService, UserDataExportService) |
| New middleware      | 2 (idempotency, requireOwnership)                              |
| Operational docs    | 3 (incident playbook, on-call policy, DR plan)                 |
| Review P1s caught   | 2 (timing oracle, missing dep)                                 |
| Merge conflicts     | 0                                                              |
