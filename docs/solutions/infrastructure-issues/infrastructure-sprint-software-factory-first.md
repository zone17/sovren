---
title: 'Infrastructure Sprint: Software Factory First with Team-Builder Enterprise'
category: infrastructure-issues
tags: [team-builder, enterprise, ci-cd, observability, security, factory-agents, phase-0]
module: infrastructure
severity: n/a
symptoms:
  - 'Simulation code in production infrastructure (Math.random health checks, hand-rolled metrics)'
  - '15+ fragmented CI/CD workflows with echo stubs'
  - 'Missing CSRF protection, unsafe-inline in CSP, no DB SSL'
  - 'No structured logging or correlation IDs'
date_solved: '2026-02-12'
solving_agent: 'team-builder enterprise (10 agents, 5 phases)'
stories: [US-E0-009, US-E0-010, US-E0-011]
---

# Infrastructure Sprint: Software Factory First with Team-Builder Enterprise

## Problem

The Sovren platform had simulation-grade infrastructure code that needed to be replaced with production-ready implementations across three workstreams:

1. **US-E0-009 (CI/CD)**: 22 fragmented workflows with echo stubs, outdated action versions, missing permissions blocks, `continue-on-error` on security steps
2. **US-E0-010 (Observability)**: Sentry simulation classes, `Math.random()` health checks, hand-rolled Prometheus text format, no correlation IDs
3. **US-E0-011 (Security)**: No CSRF middleware, `unsafe-inline` in production CSP, no DB SSL enforcement, rate limiter using in-memory store

## Solution: Team-Builder Enterprise Pipeline

Used `/team-builder enterprise` which deploys 10 agents across 5 phases with quality gates between each:

### Phase 0: Factory (3 agents, parallel)

**Key insight**: Factory agents (cicd, observability, security-gates) mapped 1:1 to the infrastructure stories. This was the right tier choice.

- **factory-cicd** (cicd-pipeline-architect, sonnet): Consolidated workflows, added `permissions: read-all`, updated action versions, real Vercel deployment
- **factory-observability** (monitoring-observability-architect, sonnet): Real @sentry/node + @sentry/react, prom-client, Winston + AsyncLocalStorage correlation IDs, Web Vitals, SLO definitions
- **factory-security-gates** (security-engineer, sonnet): Double-submit cookie CSRF, production CSP without unsafe-inline, DB SSL, Redis rate limiter, removed soft_fail

Gate 0: 8/8 PASS

### Phase 1: Architecture & Design (2 agents, parallel)

- **architect**: Created 3 ADRs (016-CSRF, 017-Observability, 018-CI/CD), architecture review with 3 findings
- **product-owner**: DoD validation — 15/21 PASS, 3 PARTIAL, 3 FAIL (all test coverage gaps)

Gate 1: 6/6 PASS

### Phase 2: Gap Fixes (2 agents, parallel)

- **backend**: Wrote 4 test suites (125 test cases total), fixed health check singletons, gated CSP logging
- **frontend** (repurposed as config-fix agent): Updated action versions, Grafana password, workflow permissions

Gate 2: 9/9 PASS

### Phase 3: Verification (2 agents, parallel)

- **qa**: Verified test execution and quality of 4 new test files
- **security-audit**: Full OWASP Top 10 audit, SAST scan, npm audit — scored 90/100

Gate 3: 7/8 PASS, 1 SKIP (no Playwright runner)

### Phase 4: Ship

Covered by Phase 1 + Phase 3 reviews (per team-builder skill optimization rule).

## Final Results

| Metric                         | Before                   | After                                       |
| ------------------------------ | ------------------------ | ------------------------------------------- |
| DoD Compliance                 | 71% (15/21 PASS)         | 90% (19/21 PASS)                            |
| Security Score                 | ~60%                     | 90/100                                      |
| Test Coverage (new middleware) | 0%                       | 125 test cases across 4 files               |
| CSRF Protection                | None                     | Double-submit cookie (ADR-016)              |
| Health Checks                  | Math.random() simulation | Real DB/Redis/Lightning/NOSTR probes        |
| Metrics                        | Hand-rolled text         | Real prom-client with route normalization   |
| Logging                        | Basic console.log        | Winston + AsyncLocalStorage correlation IDs |
| Sentry                         | Simulation classes       | Real @sentry/node + @sentry/react           |

## Learnings

### 1. Factory agents consistently skip tests

All 3 Phase 0 factory agents delivered excellent implementation code but wrote zero tests. The DoD validation (Phase 1) caught this, and Phase 2 had to backfill. **Action**: Update factory briefs to include "write tests for new code" as an explicit deliverable, or accept this as a known pattern and always plan a test-backfill phase.

### 2. Product-owner DoD validation is extremely valuable

The structured DoD report (PASS/PARTIAL/FAIL per criterion per story) made it trivial to identify exactly what Phase 2 needed to fix. This report format should be standard for all enterprise runs.

### 3. Glob tool unreliable in this repo

Throughout the sprint, the Glob tool consistently returned "No files found" for patterns that definitely match existing files (`.github/workflows/*.yml`, `packages/*/package.json`). Grep and `find` via Bash were reliable workarounds. Root cause unknown (possibly symlinks or hidden directory issues).

### 4. Enterprise tier maps perfectly to infrastructure sprints

Phase 0 factory agents = infrastructure implementation. Phase 1 architect = ADRs and review. Phase 1 product-owner = DoD validation. Phase 2 = gap fixes. Phase 3 = security audit. This is the ideal tier for any sprint touching CI/CD + observability + security.

### 5. CSP logging fix requires reading carefully

The backend agent marked the CSP logging fix as complete. Initial Grep showed `logCSPUsage` still present, which looked like a failure. But reading the code revealed the agent had added `NODE_ENV === 'development'` guards — the calls remain but are no-ops in production. **Lesson**: Verify fixes by reading the actual code, not just checking if patterns exist.

### 6. Security audit report as a sprint artifact

The security-audit agent produced a 529-line comprehensive report covering SAST, OWASP Top 10, dependency vulnerabilities, and every middleware file. This is a valuable artifact for compliance and should be generated for every enterprise sprint.

### 7. Pre-existing dependency vulnerabilities are noise for sprint gates

The 44 npm audit vulnerabilities (1 critical, 27 high) are all pre-existing. Treating them as Gate 3 failures would have blocked the sprint unnecessarily. **Action**: Gate checks should distinguish between "newly introduced" vs "pre-existing" vulnerabilities.

## New Findings Requiring Follow-Up

| ID         | Severity | Location                             | Issue                                |
| ---------- | -------- | ------------------------------------ | ------------------------------------ |
| FINDING-04 | MODERATE | shared/NostrSecureKeyStorage.ts:476  | Hardcoded PBKDF2 password            |
| FINDING-05 | MODERATE | backend/UserAnalyticsService.ts:1304 | SQL interpolation needs whitelist    |
| FINDING-06 | LOW      | frontend/monitoring/sentry.ts        | Missing x-api-key redaction          |
| FINDING-07 | LOW      | backend/routes/health.ts             | /health/detailed publicly accessible |

## Files Created/Modified

### New Files (15)

- `packages/backend/src/middleware/csrf.ts`
- `packages/backend/src/middleware/correlation-id.ts`
- `packages/backend/src/lib/sentry.ts`
- `packages/frontend/src/monitoring/web-vitals.ts`
- `packages/backend/src/__tests__/middleware/csrf.test.ts`
- `packages/backend/src/__tests__/routes/health.test.ts`
- `packages/backend/src/__tests__/middleware/correlation-id.test.ts`
- `packages/backend/src/__tests__/middleware/deployment-monitoring.test.ts`
- `docs/decisions/ADR-016-csrf-double-submit-cookie.md`
- `docs/decisions/ADR-017-observability-stack.md`
- `docs/decisions/ADR-018-cicd-consolidation.md`
- `docs/observability/slos.md`
- `docs/architecture/infrastructure-sprint-review.md`
- `docs/reviews/infrastructure-sprint-dod-validation.md`
- `docs/security/infrastructure-sprint-security-audit.md`

### Modified Files (12)

- `.github/workflows/ci.yml`
- `.github/workflows/docker-security-scan.yml`
- `.github/workflows/test-deployment.yml`
- `packages/backend/src/routes/health.ts`
- `packages/backend/src/middleware/deployment-monitoring.ts`
- `packages/backend/src/middleware/security-headers.ts`
- `packages/backend/src/middleware/rate-limit-middleware.ts`
- `packages/backend/src/config/database-pool.config.ts`
- `packages/backend/src/lib/logger.ts`
- `packages/backend/src/app.ts`
- `packages/frontend/src/monitoring/sentry.ts`
- `monitoring/dashboard/grafana/docker-compose.grafana.yml`

## Prevention

For future infrastructure sprints:

1. Always use `/team-builder enterprise` — the factory agents are purpose-built for this
2. Include "write tests" as an explicit deliverable in factory agent briefs
3. Plan for a Phase 2 test-backfill based on Phase 1 DoD validation findings
4. Use Grep instead of Glob for file verification in gate checks
5. Run security audit as standard Phase 3 deliverable — the report is worth the tokens
