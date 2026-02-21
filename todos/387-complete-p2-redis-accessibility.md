---
status: pending
priority: p2
issue_id: 387
tags:
  - code-review
  - deployment
  - infrastructure
dependencies: []
---

# New Services Depend on Redis Without Health Check or Graceful Degradation

## Problem Statement

Four new services (MarketplaceService, BusinessInvoiceService, RevenueService, TaxService) depend on Redis via QueueService and CacheService. Rate limiters also use Redis in production. If Redis is unavailable, these services will fail without clear diagnostics or fallback behavior.

## Findings

**Source agents:** deployment-agent, infrastructure-agent, code-review-agent

**Evidence:**

- File: `packages/backend/src/container/bindings/*.ts`
- Issue: Services bind to QueueService and CacheService which require Redis. No health check endpoint verifies Redis connectivity. No graceful degradation if Redis is down.

## Proposed Solutions

### Option A: Add Redis health check and graceful degradation

- **Approach:** Verify Redis connectivity in target environment. Add a health check for Redis in the `/ready` endpoint. Ensure graceful degradation if Redis is unavailable (e.g., fall back to in-memory cache, skip queue operations with a warning).
- **Effort:** Medium
- **Risk:** Low

## Recommended Action

_To be filled during triage_

## Technical Details

**Affected files:**

- `packages/backend/src/container/bindings/*.ts`

## Acceptance Criteria

- [ ] `/ready` endpoint includes Redis connectivity check
- [ ] Health check returns degraded status (not 500) if Redis is unavailable
- [ ] Services gracefully degrade when Redis is down (in-memory fallback or clear error)
- [ ] Startup logs clearly indicate Redis connection status
- [ ] Rate limiters fall back to in-memory if Redis is unavailable

## Work Log

| Date       | Action  | Notes                      |
| ---------- | ------- | -------------------------- |
| 2026-02-19 | Created | PR #86 code review finding |

## Resources

- PR: https://github.com/zone17/sovren/pull/86
