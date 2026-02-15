---
status: pending
priority: p2
issue_id: '139'
tags:
  - code-review
  - round-7
  - performance
  - cache
  - lightning
dependencies: []
---

# 139: Cache Stampede on Persistence Fallback — Thundering Herd

## Problem Statement

When a Lightning invoice is evicted from the TTLCache, the next lookup falls through to `persistence.getInvoiceById()`. If multiple concurrent requests hit the same cache miss (e.g., webhook + status check + UI poll), they ALL hit the persistence layer simultaneously. For file-based JSON persistence, this means multiple concurrent reads/parses of the full `invoices.json` file.

**Why it matters**: Under load, a single cache eviction triggers N concurrent file reads, degrading performance and potentially causing I/O contention.

## Findings

**Performance Oracle (Round 7)**: Flagged as CRITICAL — cache stampede risk with no request coalescing.

**Location**: `packages/backend/src/services/lightning-service.ts` — cache-miss fallback to persistence in `checkInvoiceStatus()` and `processWebhook()`.

## Proposed Solutions

### Option A: Request Coalescing / Singleflight (Recommended)
**Effort**: Medium | **Risk**: Low

Only the first request for a given key hits persistence; concurrent requests wait for and share the result.

```typescript
private pendingLookups = new Map<string, Promise<LightningInvoice | null>>();

async getInvoiceWithFallback(id: string): Promise<LightningInvoice | null> {
  let invoice = this.invoiceCache.get(id);
  if (invoice) return invoice;

  const pending = this.pendingLookups.get(id);
  if (pending) return pending; // Wait for in-flight lookup

  const lookup = this.persistence.getInvoiceById(id).then(result => {
    this.pendingLookups.delete(id);
    if (result) this.invoiceCache.set(result.id, result);
    return result;
  });
  this.pendingLookups.set(id, lookup);
  return lookup;
}
```

**Pros**: Eliminates thundering herd, simple pattern
**Cons**: Adds ~20 lines of code

### Option B: Stale-While-Revalidate
**Effort**: Large | **Risk**: Medium

Return stale cached value while refreshing in background.

**Pros**: Zero-latency cache misses
**Cons**: Complex, may return stale data for payments (unacceptable)

## Recommended Action

Option A — singleflight/request coalescing is the standard pattern for this problem.

## Technical Details

**Affected Files**:
- `packages/backend/src/services/lightning-service.ts`

## Acceptance Criteria

- [ ] Concurrent cache misses for same key result in single persistence read
- [ ] Subsequent requests share the result of the first lookup
- [ ] Pending lookup map is cleaned up after resolution (both success and error)
- [ ] If the coalesced promise rejects, all waiting callers receive the error
- [ ] Test: 10 concurrent lookups for evicted invoice produce 1 persistence read

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-15 | Created from Round 7 performance review | Cache fallback needs request coalescing to prevent stampede |
