---
status: pending
priority: p1
issue_id: '118'
tags:
  - code-review
  - performance
  - payment
  - lightning
dependencies: []
---

# 118: O(n) Linear Scan in Webhook Hot Path — invoiceCache.values().find()

## Problem Statement

`/packages/backend/src/services/lightning-service.ts` (lines 580-582) uses `this.invoiceCache.values().find()` to search for invoices by payment_hash on every webhook callback. This is O(n) where n = number of cached invoices (up to 10,000). Webhooks are time-sensitive — the Lightning node expects quick acknowledgment.

## Findings

- **Lines 580-582**: `const invoice = [...this.invoiceCache.values()].find(inv => inv.payment_hash === data.payment_hash)`
- Creates full array copy of all cached invoices (up to 10,000)
- Linear scan through all entries to find matching payment_hash
- O(n) complexity on critical webhook path
- Lightning nodes expect webhook acknowledgment within seconds
- With 10,000 invoices, each webhook triggers 10,000 comparisons
- Blocks event loop during iteration

## Proposed Solutions

**Option A: Add secondary index Map (Recommended)**

- Create `paymentHashIndex: Map<string, string>` mapping payment_hash → invoice_id
- O(1) lookup on webhook path
- Maintain index on set/delete operations
- Effort: Small, Risk: Low

**Option B: Store invoices keyed by payment_hash instead of invoice_id**

- Change primary cache key to payment_hash
- Direct O(1) lookup on webhooks
- Effort: Small, Risk: Medium (breaks other lookups that use invoice_id)

## Acceptance Criteria

- [ ] Webhook invoice lookup is O(1)
- [ ] No full array copy on webhook path
- [ ] Secondary index maintained on set/delete operations
- [ ] Index consistency tested (no orphaned entries)
- [ ] Webhook response time < 100ms even with full cache

## Work Log

| Date       | Action                                      | Learnings                                                            |
| ---------- | ------------------------------------------- | -------------------------------------------------------------------- |
| 2026-02-14 | Identified in code review round 6 of PR #73 | Hot paths like webhooks must use indexed lookups, never linear scans |
