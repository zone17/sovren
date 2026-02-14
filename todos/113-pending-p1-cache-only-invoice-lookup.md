---
status: pending
priority: p1
issue_id: '113'
tags:
  - code-review
  - data-integrity
  - payment
  - lightning
  - cache
dependencies: []
---

# 113: Cache-Only Invoice Lookup — Payments Silently Lost After TTL Eviction

## Problem Statement

`checkInvoiceStatus` in `/packages/backend/src/services/lightning-service.ts` (lines 338-339) only looks up invoices from `invoiceCache` (TTLCache, 1-hour TTL, 10,000 max entries). If cache entry expired or evicted, returns `{ success: false, error: 'Invoice not found' }` even though invoice exists in persistence. Payments arriving after eviction are never matched.

## Findings

- **Lines 338-339**: Cache-only lookup with no persistence fallback
- **TTLCache configuration**: maxSize=10000, ttlMs=3600000 (1 hour)
- Invoices evicted due to TTL expiration or LRU eviction when cache is full
- Payments arriving after eviction fail silently with "Invoice not found" error
- No warning or fallback mechanism to persistence layer

## Proposed Solutions

**Option A: Fall through to persistence on cache miss (Recommended)**

- Check cache first, then query persistence if not found
- Implementation: `let invoice = this.invoiceCache.get(id); if (!invoice) invoice = await this.persistence.getInvoiceById(id);`
- Effort: Small, Risk: Low

**Option B: Increase cache size/TTL**

- Extend TTL beyond 1 hour and increase max entries
- Effort: Small, Risk: Medium (just delays the problem, doesn't solve it)

## Acceptance Criteria

- [ ] checkInvoiceStatus falls through to persistence on cache miss
- [ ] No payments silently lost due to cache eviction
- [ ] Cache miss fallback tested with expired and evicted entries
- [ ] Performance impact of persistence fallback measured and acceptable

## Work Log

| Date       | Action                                      | Learnings                                                             |
| ---------- | ------------------------------------------- | --------------------------------------------------------------------- |
| 2026-02-14 | Identified in code review round 6 of PR #73 | Cache-only lookups in payment flows create silent data loss scenarios |
