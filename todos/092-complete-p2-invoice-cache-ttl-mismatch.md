---
status: pending
priority: p2
issue_id: '092'
tags: [code-review, data-integrity, lightning, caching]
dependencies: []
---

# Invoice Cache TTL Mismatch with Payment Monitor Timeout

## Problem Statement

Invoice cache TTL (30 minutes) at `lightning-payment-service.ts:131` is shorter than payment monitoring timeout (60 minutes) at line 670. After 30 minutes, cached invoices evict while payment monitors are still active, causing unnecessary database roundtrips and potential race conditions when monitors try to access evicted invoice data.

## Findings

- Invoice cache configured with 30-minute TTL at `lightning-payment-service.ts:131`
- Payment monitoring timeout set to 60 minutes at line 670
- After cache eviction at 30 minutes, active monitors must perform DB queries to retrieve invoice data
- Potential race condition if invoice status changes between cache eviction and DB lookup
- Unnecessary performance overhead from redundant database calls during the 30-60 minute window

## Proposed Solutions

### Option 1: Align Cache TTL to Monitor Timeout (60 minutes)

**Pros:**

- Simple one-line change
- Eliminates cache misses during active monitoring
- Reduces DB load

**Cons:**

- Slightly higher memory usage (invoices cached 2x longer)
- Doesn't address invoices that may need longer-term caching

**Effort:** Low (1 hour)
**Risk:** Low

### Option 2: Implement Two-Tier Caching Strategy

**Pros:**

- Hot cache (60 min) for active payments
- Cold cache (30 min) for completed/expired invoices
- Optimizes both memory and performance

**Cons:**

- More complex implementation
- Requires cache key namespacing
- Additional testing needed

**Effort:** Medium (4 hours)
**Risk:** Medium

### Option 3: Dynamic TTL Based on Invoice State

**Pros:**

- Active invoices get 60-minute TTL
- Settled/expired invoices get 10-minute TTL
- Most efficient memory usage

**Cons:**

- Requires cache TTL updates on state transitions
- More complex cache invalidation logic
- Edge cases around state transition timing

**Effort:** High (8 hours)
**Risk:** Medium

## Recommended Action

**Option 1: Align Cache TTL to Monitor Timeout (60 minutes)**

This provides immediate fix with minimal risk. The memory overhead of caching invoices for an additional 30 minutes is negligible compared to the performance impact and race condition risk of cache misses during active monitoring.

Implementation:

1. Update cache TTL configuration at `lightning-payment-service.ts:131` from 1800 to 3600 seconds
2. Add comment explaining alignment with payment monitor timeout
3. Add unit test verifying cache retention during full monitor lifecycle

## Technical Details

**Affected Files:**

- `src/services/lightning-payment-service.ts` (lines 131, 670)

**Current Configuration:**

```typescript
// Line 131
const INVOICE_CACHE_TTL = 30 * 60; // 30 minutes

// Line 670
const PAYMENT_MONITOR_TIMEOUT = 60 * 60 * 1000; // 60 minutes
```

**Cache Eviction Timeline:**

- T+0: Invoice created, cached, monitor started
- T+30min: Cache evicts invoice (TTL expired)
- T+30-60min: Monitor active but cache misses on every check → DB query
- T+60min: Monitor times out

**Race Condition Scenario:**

1. Monitor checks invoice at T+31min (cache miss)
2. DB query initiated
3. Payment settles during DB query
4. Monitor receives stale invoice state
5. Webhook arrives with updated state
6. State conflict between monitor and webhook handler

## Acceptance Criteria

- [ ] Invoice cache TTL updated to 60 minutes (3600 seconds)
- [ ] Comment added explaining alignment with payment monitor timeout
- [ ] Unit test added verifying invoice remains cached during full 60-minute monitor lifecycle
- [ ] Integration test confirms no DB queries for cached invoices during monitoring period
- [ ] Memory usage monitoring shows acceptable impact (<5% increase)
- [ ] Performance testing confirms elimination of cache misses during active monitoring
- [ ] Documentation updated in `docs/architecture/caching-strategy.md` (if exists)

## Work Log

**2026-02-14**

- Identified in PR #73 full code review
- Observed cache miss pattern in production logs during 30-60 minute window
- Documented race condition risk

## Resources

- PR #73: https://github.com/user/sovren/pull/73
- Related: Lightning payment monitoring architecture
- Redis cache configuration: `lib/redis.ts`
