---
status: complete
priority: p1
issue_id: '261'
tags: [code-review, security]
dependencies: []
---

# EPIC-011 Routes Missing Rate Limiting

## Problem Statement

All 4 EPIC-011 route files have zero rate limiting — no router.use(readOnlyRateLimiter) and no per-route mutation limiters.

## Findings

- `packages/backend/src/routes/v2/business-contracts.routes.ts` — no rate limiter
- `packages/backend/src/routes/v2/business-invoices.routes.ts` — no rate limiter
- `packages/backend/src/routes/v2/business-revenue.routes.ts` — no rate limiter
- `packages/backend/src/routes/v2/business-tax.routes.ts` — no rate limiter

## Proposed Solutions

### Option 1: Add rate limiters matching EPIC-010 pattern

**Approach:** Add readOnlyRateLimiter via router.use() and mutationRateLimiter on POST/PUT/DELETE routes.
**Effort:** 30min **Risk:** Low

## Acceptance Criteria

- [ ] All 4 route files have readOnlyRateLimiter
- [ ] Mutation endpoints have mutationRateLimiter

## Work Log

### 2026-02-18 - Code Review Discovery

**By:** Claude Code (13-agent parallel review)
