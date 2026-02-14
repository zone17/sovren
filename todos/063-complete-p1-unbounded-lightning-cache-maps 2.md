---
status: pending
priority: p1
issue_id: 063
tags: [code-review, performance, memory-leak]
dependencies: []
---

# Unbounded Lightning Cache Maps (OOM Risk)

## Problem Statement

`lightning-payment-service.ts` and `lightning-service.ts` both use plain `Map` objects (`invoiceCache`, `paymentMonitors`, `paymentCache`) that grow without bound. In production with sustained traffic, these Maps will consume all available memory causing an OOM crash.

## Findings

- **Performance Oracle P1-001/P1-002**: Both Lightning services have unbounded Maps with no TTL, no max-size, no eviction policy.
- **Architecture Strategist**: Flagged as reliability concern for production deployment.

## Proposed Solutions

### Option A: Add TTL + max-size eviction (Recommended)

Use a bounded LRU cache (e.g., `lru-cache` package or simple Map wrapper with TTL cleanup interval).
**Pros:** Prevents OOM, configurable limits, minimal code change
**Cons:** Adds dependency or ~30 lines of wrapper code
**Effort:** Small
**Risk:** Low

### Option B: Move caches to Redis

Use Redis with TTL for all Lightning caches.
**Pros:** Survives restarts, shared across instances
**Cons:** Adds Redis dependency to Lightning service, higher latency
**Effort:** Medium
**Risk:** Low

## Technical Details

- **Affected files:** `packages/backend/src/services/lightning-payment-service.ts`, `packages/backend/src/services/lightning-service.ts`
- **Components:** Lightning payment processing
- **Runtime impact:** Memory leak → eventual OOM crash in production

## Acceptance Criteria

- [ ] All Lightning cache Maps have max-size limit (e.g., 10,000 entries)
- [ ] All cached entries have TTL (e.g., 30 minutes for invoices, 1 hour for payments)
- [ ] Eviction runs periodically or on insert
- [ ] No memory growth under sustained load

## Work Log

| Date       | Action                          | Learnings                                |
| ---------- | ------------------------------- | ---------------------------------------- |
| 2026-02-13 | Created from full PR #73 review | Performance Oracle flagged both services |

## Resources

- PR #73 full review
- Performance Oracle agent report
