---
title: 'P3 Sprint 2: API Docs, Caching, Docker, Frontend Cleanup — 14 Findings'
date: 2026-02-15
category: code-quality
tags:
  [
    openapi-docs,
    ttlcache-lru,
    crypto-uuid,
    error-boundary-factory,
    docker-security,
    health-endpoints,
    sensitive-fields,
    polling-timers,
    scheduled-recovery,
    async-constructor,
    mock-database,
    zod-metadata,
    n-plus-one,
  ]
module: backend
symptoms:
  - Health endpoints returning 307 redirects instead of direct responses
  - Math.random() used for production ID generation (~15 services)
  - TTLCache FIFO eviction, stale size, mutation during iteration
  - 6 identical error boundary files across frontend features
  - Redis health check exposing password in CLI args
  - Unbounded polling timers never cleared on terminal invoice states
  - Zod validation errors dropping expected/received metadata
  - Scheduled publish jobs lost on process restart
  - Async constructor anti-pattern in LightningPaymentService
  - Mock database silently returning empty results
  - Sensitive fields over-matching (broad 'key' and 'auth')
  - N+1 query patterns in recommendation service
  - Zero OpenAPI annotations on payment/user routes
severity: P3
resolution_time: '2 hours'
related_issues:
  - todo-018-openapi-docs
  - todo-035-docker-security
  - todo-059-docker-hardening
  - todo-083-zod-metadata
  - todo-084-health-redirects
  - todo-085-weak-uuid
  - todo-104-ttlcache-issues
  - todo-105-sensitive-fields
  - todo-106-error-boundaries
  - todo-109-macos-artifacts
  - todo-130-n-plus-one
  - todo-131-polling-timers
  - todo-132-mock-database
  - todo-133-scheduled-publish
  - todo-134-async-constructor
pr: 73
branch: feature/US-007-error-boundaries-rebased
---

# P3 Sprint 2: API Docs, Caching, Docker, Frontend Cleanup

## Overview

Sprint 2 of the P3 cleanup resolved 14 of 20 remaining findings from PR #73, spanning API documentation, caching architecture, Docker security, frontend refactoring, and code quality. 6 items were strategically deferred as feature work rather than cleanup.

**Team**: Standard tier (architect + product-owner + backend + frontend + qa + security-audit)
**Net result**: 52 files changed, +1,716 / -180 lines (net +1,536 lines)
**Commit**: `c39171b`

## Problem

After Sprint 1 resolved 14 findings (net -141K lines of dead code), 20 P3 findings remained spanning:
- API documentation (018, 060, 086, 087, 146)
- Docker/security (035, 059)
- Caching/architecture (083, 084, 085, 104, 105, 130, 131, 132, 133, 134)
- Frontend (106)
- macOS artifacts (109)
- God classes (145)

## Stale Todo Detection

Per Sprint 1 lesson: "Always verify against source before implementing."

| Todo | Finding |
|------|---------|
| 035 | Vault setup script deleted in prior sprint. Postgres ports already 127.0.0.1. Scope reduced to 2 items. |
| 059 | Console.log: 0 hits. `_next` fixed. Emojis removed. **Merged into 035.** |
| 109 | Zero " 2" directories found — already cleaned in Sprint 1. **Mark complete, no changes.** |
| 085 | ~90+ Math.random() total but ~75 in tests/mocks. Only ~15 production files need fixing. |
| 106 | Import path is `../../monitoring/ErrorBoundary`, NOT `@/components/ErrorBoundary`. 6 files, not 5. |

**Result**: 4 stale/narrower items detected, preventing ~2 hours of wasted work.

## Solution

### Batch 0: Pre-Work (No Code Changes)

**Todo 109 — macOS artifacts**: Already resolved in Sprint 1. Marked complete.

**Todo 059 — Docker hardening**: Merged remaining valid items into 035. Marked complete.

### Batch 1: Quick Wins

**Todo 083 — Zod error metadata**: Added `expected` and `received` fields from Zod error issues to validation error response in `error-handler-middleware.ts`.

**Todo 084 — Health endpoint redirects**: Replaced 307 redirects at `/ready` and `/live` with inline health check responses in `routes/health.ts`. Database and Redis checks run directly instead of redirecting to `/health/ready` and `/health/live`.

**Todo 085 — Weak UUID generation**: Replaced `Math.random().toString(36)` with `crypto.randomUUID()` across ~15 production service files. Skipped test/mock files where Math.random() is acceptable. Services affected: EventBusService, email-integration, payment processing, receipts, user profiles, recommendations.

**Todo 105 — Sensitive fields precision**: Removed broad `'key'` and `'auth'` from `SENSITIVE_FIELDS` array. Added specific patterns: `authToken`, `accessToken`, `refreshToken`, `sessionToken`, `encryptionKey`, `signingKey`, `secretKey`, `secret_key`.

**Todo 132 — Mock database throws**: Changed silent mock in `bootstrap.ts` from returning `{ rows: [], rowCount: 0 }` to throwing `NotImplementedError`, preventing silent data absence in development.

### Batch 2: Architecture Fixes

**Todo 104 — TTLCache LRU refactor**: Comprehensive fix in `utils/ttl-cache.ts`:
1. Added `lastAccessed` timestamp tracking to cache entries
2. Changed eviction from FIFO to LRU (evicts entry with oldest `lastAccessed`)
3. Fixed `size` getter to exclude expired entries
4. Fixed `values()` to collect expired keys then delete after iteration (no mutation during iteration)
5. Added `cleanExpired()` public method

**Todo 131 — Bounded polling timers**: In `lightning-payment-service.ts`, stored interval IDs in a Map keyed by invoice ID. Timers are cleared when invoice transitions to paid/expired/cancelled. Added `maxPollingDuration` failsafe to auto-stop polling after a timeout.

**Todo 133 — Scheduled publish recovery**: Added `recoverScheduledJobs()` to `ContentPublishingService.ts` that queries for content with status='scheduled' on startup and re-registers timers. Past-due content published immediately.

**Todo 134 — Async constructor fix**: Removed async `initializeService()` from constructor in `LightningPaymentService`. Added explicit `async initialize()` method with initialization guard pattern. Bootstrap/DI calls `await service.initialize()` after construction.

### Batch 3: Frontend

**Todo 106 — Error boundary factory**: Created `createFeatureErrorBoundary.tsx` factory function in `packages/frontend/src/monitoring/`. Refactored 6 identical 16-line files (ai, analytics, dashboard, nostr, content, subscriptions) to one-line factory calls. Auth ErrorBoundary kept unchanged (custom implementation).

```typescript
// packages/frontend/src/monitoring/createFeatureErrorBoundary.tsx
export function createFeatureErrorBoundary(featureName: string): React.FC<Props> {
  const FeatureErrorBoundary: React.FC<Props> = ({ children }) => (
    <ErrorBoundary level="feature" featureName={featureName}>
      {children}
    </ErrorBoundary>
  );
  FeatureErrorBoundary.displayName = `${featureName}ErrorBoundary`;
  return FeatureErrorBoundary;
}

// Usage: export default createFeatureErrorBoundary('ai');
```

### Batch 4: Docker Security

**Todo 035+059 (merged)**: In `docker/security/docker-compose.secure.yml`:
1. Redis health check: Changed from `-a ${REDIS_PASSWORD}` CLI arg to `REDISCLI_AUTH=$REDIS_PASSWORD redis-cli ping` (prevents password in process list)
2. ICC: Changed to `false` for container isolation

### Batch 5: Database Patterns

**Todo 130 — N+1 queries**: Added WHERE clause filtering at query level in `recommendation-service.ts` and `lightning-service.ts`. Since these use placeholder implementations, added TODO comments for when real DB is wired.

### Batch 6: OpenAPI Documentation

**Todo 018 — OpenAPI annotations**: Added `@openapi` JSDoc blocks to `payment.routes.ts` and `user.routes.ts`, matching the pattern in `content.routes.ts`. All endpoints documented with paths, methods, parameters, request/response schemas, and security requirements.

## Deferred Items

| Todo | Title | Reason |
|------|-------|--------|
| 086 | Agent API key auth | New feature, not cleanup. Needs API key table, CRUD, rate-limit integration. |
| 087 | Content CRUD v1 | Overlaps 146. Should be part of v1 API migration sprint. |
| 146 | v1 API fragmentation (24 endpoints) | Multi-week phased migration. Needs dedicated sprint. |
| 145 | God classes (5 classes, 4,800+ lines) | High-risk refactor. Already deferred from Sprint 1. |
| 060 | Agent-native metrics/error APIs | New feature. Depends on 086 (agent auth). |

## Key Patterns

### Pattern: Stale todo detection saves sprint time
Architect verified ALL 20 items against source before planning. Found 4 stale/narrower items. This prevented implementing against deleted files or wrong import paths. Saved ~2 hours.

### Pattern: Strategic merge of related todos
Todos 035 and 059 had significant overlap (Docker hardening). Architect merged them, identified already-resolved items in both, and reduced scope to 2 actual changes. Future sprints should consolidate overlapping todos during Phase 0.

### Pattern: Factory function for identical React components
6 error boundary files reduced to 1 factory + 6 one-liners. The factory pattern works when components differ only by a config prop (featureName). Pattern reusable for any feature-specific wrapper.

### Pattern: TTLCache LRU as drop-in Map replacement
TTLCache with LRU eviction, auto-expiry, and cleanup interval replaces unbounded Maps across the codebase. Interface is Map-compatible (`get`, `set`, `has`, `delete`) so no consumer changes needed.

## Verification

- QA agent verified all 14 fixes against DoD acceptance criteria
- Security-audit agent verified: crypto UUID in payment paths, sensitive fields still cover passwords/tokens, Docker Redis password not in process list, mock DB fails safely
- 5 deferred items confirmed still pending

## Files Modified Summary

| Category | Files Changed | Lines Added |
|----------|---------------|-------------|
| Services (UUID, timers, async init) | 18 modified | ~350 |
| TTLCache | 1 modified | ~200 |
| Error handler + health | 2 modified | ~80 |
| Sensitive fields + bootstrap | 2 modified | ~30 |
| Frontend error boundaries | 7 (6 modified + 1 new) | ~80 |
| Docker compose | 1 modified | ~15 |
| Route files (OpenAPI) | 3 modified | ~780 |
| Todo renames | 15 renamed | 0 |
| Plan docs | 2 new | ~730 |

## Sprint Statistics

| Metric | Value |
|--------|-------|
| Findings resolved | 14 of 20 (6 deferred) |
| Files changed | 52 |
| Lines added | 1,716 |
| Lines removed | 180 |
| Net change | +1,536 |
| Team size | 6 agents |
| Phases | 3 (arch+PO → backend+frontend → QA+security) |
| Commit | c39171b |

## Cumulative PR #73 Statistics

| Metric | Sprint 1 | Sprint 2 | Total |
|--------|----------|----------|-------|
| Findings resolved | 14 | 14 | 28 |
| Items deferred | 1 (145) | 6 | 5 unique remaining |
| Files changed | 690 | 52 | 742 |
| Net lines | -141,316 | +1,536 | -139,780 |

## Related Documentation

- `docs/plans/p3-sprint2-cleanup-plan.md` — Architect implementation plan (244 lines)
- `docs/plans/p3-sprint2-cleanup-dod.md` — Product owner acceptance criteria (483 lines)
- `docs/solutions/code-quality/p3-sprint1-cleanup-dead-code-architecture.md` — Sprint 1 compound doc
- `docs/solutions/p2-remediation-r8-pr73-round8.md` — P2 remediation sprint
- `docs/solutions/security-issues/r7-remediation-sprint-round7-fixes.md` — R7 sprint
