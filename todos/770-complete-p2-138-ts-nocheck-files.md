---
status: pending
priority: p2
issue_id: 770
tags: [code-review, typescript, type-safety, architecture]
dependencies: []
---

# 138 @ts-nocheck Files Disable Type Safety Across Codebase

## Problem Statement

102 backend files and 36 frontend files have @ts-nocheck, including production-critical code: error handler, rate limiter, DI bindings, controllers, v2 routes, payment services. This disables ALL TypeScript checking — typos, wrong property names, and type mismatches pass silently. The DI/interface/factory layer (~19,238 LOC) provides zero value when every consumer has @ts-nocheck.

## Findings

- **Architecture Agent**: P1-01 — 33.5% of backend files
- **TypeScript Agent**: P1-1 — 138 total files, including error-handler-middleware.ts, rate-limit-middleware.ts, all DI bindings
- **Simplicity Agent**: P1-01 — notes entire interface/DI layer is dead abstraction

### Critical Files

- `error-handler-middleware.ts` — every request passes through
- `rate-limit-middleware.ts` — security-critical
- `container/bindings/*.ts` (6 files) — all DI bindings
- `controllers/` (3 files) — all controllers
- `routes/v2/*.ts` (5 files) — v2 API routes
- `payout-management-service.ts` — payment processing

## Proposed Solutions

**Phase 1**: Remove from error-handler, rate-limiter, app-error.ts (highest risk)
**Phase 2**: Remove from controllers and v2 routes
**Phase 3**: Remove from DI bindings and service layer

## Acceptance Criteria

- [ ] Phase 1: 3 critical middleware files have @ts-nocheck removed
- [ ] Targeted @ts-expect-error on specific lines that need suppression
- [ ] Type errors in critical paths caught at compile time
