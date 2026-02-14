---
status: complete
priority: p1
issue_id: "090"
tags: [code-review, data-integrity, lightning, payments, critical]
dependencies: []
---

# 090: Lightning Payments Volatile-Only Storage

## Problem Statement

The `LightningService` stores ALL payment records exclusively in an in-memory `TTLCache` with no database persistence. Payment records expire after 24 hours, are lost on server restart, and can be evicted when the cache reaches 50K entries. This results in permanent loss of financial transaction history and broken webhook processing for expired invoices.

## Findings

**Location**: `packages/backend/src/services/lightning-service.ts`

**In-memory cache configuration**:
```typescript
private paymentCache = new TTLCache<string, LightningPayment>({
  ttl: 24 * 60 * 60 * 1000, // 24 hours
  max: 50000
});
```

**Critical operations relying solely on volatile cache**:

- **Line 632**: `getCreatorPayments()` - Retrieves payment history from cache only
- **Line 678**: `getStats()` - Calculates statistics from cache only
- **Line 558**: `processWebhook()` - Looks up invoice via O(n) linear scan of cache
- **No database writes**: Zero persistence logic anywhere in the service

**Impact scenarios**:

1. **Server restart**: 100% of payment history lost permanently
2. **24h TTL expiration**: Payments older than 24h vanish from all queries
3. **Cache overflow**: When 50,001st payment is created, oldest payment is evicted forever
4. **Webhook processing**: If invoice has expired from cache, `processWebhook()` silently succeeds but records no payment (line 558-582)
5. **Financial reconciliation**: Impossible to audit or reconcile payments beyond 24h window

**Webhook silently drops payments** (lines 558-582):
```typescript
const invoice = Array.from(this.paymentCache.values())
  .find(p => p.invoice_id === payment_hash);

if (!invoice) {
  return { success: true }; // Silently succeeds, payment lost
}
```

## Proposed Solutions

### Option A: Add database persistence layer to existing cache
- **Pros**: Preserves cache performance optimization, adds durability, minimal refactoring
- **Cons**: Requires careful write-through/write-back logic
- **Effort**: Medium
- **Risk**: Low

### Option B: Replace cache with database-only storage
- **Pros**: Simple, guaranteed durability, proper indexing
- **Cons**: Loses read performance optimization, higher database load
- **Effort**: Medium
- **Risk**: Low

### Option C: Database primary + cache as read-through optimization
- **Pros**: Best of both worlds, industry standard pattern
- **Cons**: Most complex implementation, requires cache invalidation logic
- **Effort**: Large
- **Risk**: Low

## Recommended Action

Implement Option A (write-through cache with database persistence):

1. **Create Supabase payments table**:
   - Schema: payment_hash (PK), invoice_id (unique), amount, status, pubkey, created_at, settled_at
   - Index on: pubkey, status, created_at
   - Unique constraint on invoice_id for webhook idempotency

2. **Modify payment creation** (line ~200):
   - Insert into database
   - Then add to cache
   - Rollback cache if DB write fails

3. **Modify webhook processing** (line 558):
   - Query database if not in cache
   - Update database on status change
   - Use payment_hash for idempotency

4. **Modify getCreatorPayments()** (line 632):
   - Query database with proper pagination
   - Use cache only for hot-path optimization

5. **Add payment_hash uniqueness**:
   - Prevents duplicate webhook processing
   - Enables safe retry logic

## Technical Details

- **Affected files**:
  - `packages/backend/src/services/lightning-service.ts` (all payment methods)
  - Database migrations (new payments table)
  - `packages/backend/src/types/lightning.ts` (payment types)
- **Components**: Lightning payments, webhook processing, payment history, statistics
- **Root cause**: Cache used as primary data store instead of database with cache optimization

## Acceptance Criteria

- [ ] All payment records persisted to database on creation
- [ ] Server restart does not lose payment history
- [ ] Payments older than 24h remain queryable
- [ ] Webhook processing is idempotent via payment_hash uniqueness
- [ ] getCreatorPayments() returns complete history from database
- [ ] Cache continues to optimize hot-path reads
- [ ] Migration script handles any existing cache data
- [ ] Payment statistics remain accurate beyond 24h window

## Work Log

| Date | Action | Result |
|------|--------|--------|
| 2026-02-14 | Identified in PR #73 full code review | Review finding |

## Resources

- PR: https://github.com/zone17/sovren/pull/73
