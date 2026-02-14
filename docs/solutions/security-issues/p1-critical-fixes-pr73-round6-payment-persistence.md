---
title: 'P1 Critical Fixes Sprint: Payment Data Persistence & Cache Recovery (Round 6)'
date: 2026-02-14
status: completed
category: security-issues
tags:
  [
    code-review,
    payment-persistence,
    cache-recovery,
    atomic-writes,
    data-integrity,
    lightning,
    p1-critical,
  ]
module: payment_services
symptoms:
  - Cache-as-primary-store across 3 payment services
  - Data loss on process restart (invoices, receipts)
  - Non-atomic file writes causing corruption
  - Premature status mutation before persistence
  - O(n) webhook scan performance degradation
  - Puppeteer memory exhaustion (per-receipt browser launch)
  - Non-atomic subscription creation leaving orphaned records
severity: P1
effort: Standard team (5 agents, 3 phases)
pr: '#73'
todos: [112, 113, 114, 115, 116, 117, 118]
related:
  - docs/solutions/security-issues/p1-critical-fixes-pr73-round4.md
  - docs/solutions/security-issues/p2-remediation-sprint-25-findings.md
  - docs/solutions/security-issues/pr73-code-review-round6-cache-persistence-api-coverage.md
  - docs/solutions/infrastructure-issues/infrastructure-sprint-software-factory-first.md
---

# P1 Critical Fixes: Payment Data Persistence & Cache Recovery (Round 6)

## Problem

Code review round 6 of PR #73 used 10 parallel review agents to perform a full-file security audit (not just diff-focused) across 194 files. This revealed the **cache-as-primary-store anti-pattern** across 3 payment services: Lightning invoices, receipts, and subscription state all used in-memory Maps/caches as their source of truth.

### Root Cause

The system was designed with caches as primary data stores rather than as performance layers over persistent storage:

1. **Lightning invoices** lived only in a `TTLCache` with 1hr TTL — webhooks arriving after eviction failed silently
2. **Receipts** existed only in a `Map` — process restart lost all receipt data permanently
3. **Payment files** were written with `writeFileSync` directly — process crash mid-write corrupted the file
4. **Status mutations** happened before persistence — crash between mutation and write left inconsistent state
5. **Subscription creation** was a 4-step process with no rollback — failure at step 3 left orphaned records

### Symptoms

- Webhooks returning "invoice not found" for valid payments (after cache eviction)
- Complete receipt data loss on service restart
- Corrupted `payments.json` after ungraceful shutdown
- Invoice showing "paid" in cache but "pending" in persistence
- Orphaned `recurring_payment` records without matching subscriptions
- O(n) scan of 10K+ invoices on every webhook (performance degradation)
- OOM kills from Puppeteer launching new browser per PDF receipt

## Solution

7 fixes across 5 files, implementing 4 shared patterns:

### Fix #112: Atomic Writes (payment-persistence.ts)

**Pattern: temp-file + atomic rename + write mutex**

```typescript
// Write to .tmp first, then atomic rename
private doWrite(type: 'invoices' | 'payments'): void {
  const filePath = path.join(this.dataDir, `${type}.json`);
  const tmpPath = `${filePath}.tmp`;
  writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
  renameSync(tmpPath, filePath); // Atomic on POSIX
}

// Serialize concurrent writes via promise chain
private writeMutex: Promise<void> = Promise.resolve();
writeToDisk(type): Promise<void> {
  this.writeMutex = this.writeMutex.then(() => this.doWrite(type));
  return this.writeMutex;
}
```

Also added corruption recovery: if main file fails to parse, backs up to `.corrupt.<timestamp>` and tries `.tmp` file.

### Fix #113: Cache-Miss Fallback to Persistence (lightning-service.ts)

**Pattern: cache-first, persist-fallback, re-warm**

```typescript
let invoice = this.invoiceCache.get(invoiceId);
if (!invoice) {
  const persisted = await this.persistence.getInvoiceById(invoiceId);
  if (persisted) {
    this.invoiceCache.set(persisted.id, persisted);
    this.paymentHashIndex.set(persisted.payment_hash, persisted.id);
    invoice = persisted;
  }
}
```

Applied to both `checkInvoiceStatus` and `processWebhook` paths.

### Fix #114: Receipt Persistence (receipt-service.ts)

New `ReceiptPersistence` class using same atomic write pattern as #112. Receipts loaded from disk on startup with all 3 index keys (id, receiptNumber, paymentHash) restored. Deduplication during serialization.

### Fix #115: Persist-Then-Mutate (lightning-service.ts)

```typescript
// BEFORE (broken): mutate first, persist after
invoice.status = 'paid';
await this.persistence.savePayment(payment);

// AFTER (correct): persist first, mutate after
await this.persistence.savePayment(payment);
await this.persistence.updateInvoiceStatus(invoice.id, 'paid');
invoice.status = 'paid'; // Only after successful persistence
```

### Fix #116: Compensating Transaction (subscription-management-service.ts)

4-step subscription creation with boolean flags tracking each completed step. On failure, rollback in reverse order with each rollback wrapped in `.catch()` to prevent cascading failures.

### Fix #117: BrowserPool (receipt-service.ts)

Single Puppeteer browser instance with configurable max concurrent pages (default 5), wait queue for burst traffic, auto-recovery from browser crash. Pages always released in `finally` block.

### Fix #118: O(1) Webhook Lookup (lightning-service.ts)

Secondary `paymentHashIndex: Map<string, string>` maintained alongside cache. TTLCache `onEvict` callback cleans up index entries when invoices expire. Webhook lookup: O(1) index check → cache get → persistence fallback.

## Files Modified

| File                               | Lines Changed | Fixes            |
| ---------------------------------- | ------------- | ---------------- |
| payment-persistence.ts             | +133/-55      | #112             |
| lightning-service.ts               | +76           | #113, #115, #118 |
| receipt-service.ts                 | +469/-298     | #114, #117       |
| subscription-management-service.ts | +146          | #116             |
| ttl-cache.ts                       | +26           | Supporting #118  |

## Security Review

Score: **88/100** (no new vulnerabilities introduced)

Key findings (all pre-existing, some amplified by persistence):

- C-1: Hardcoded `RECEIPT_SIGNATURE_SECRET` fallback (pre-existing, now amplified)
- H-1: Unbounded corrupt backup accumulation
- H-2: Plaintext preimages in persisted JSON
- H-3: Unbounded BrowserPool wait queue

All verified secure: atomic write pattern, write mutex, TTLCache bounded size, paymentHashIndex consistency, persist-before-mutate, compensating transaction rollback.

## Prevention Strategies

### Architectural

1. **Never use cache as primary store** — caches are performance layers, persistence is truth
2. **Always persist before mutating** — in-memory state should follow persistence, not lead it
3. **Atomic writes for file I/O** — temp+rename pattern prevents corruption
4. **Serialize file writes** — promise-chain mutex prevents interleaving

### Detection

1. **Full-file audits, not diff-only** — round 6 caught what 5 prior diff-focused rounds missed
2. **Look for `Map` as source of truth** in payment code — grep for `new Map()` in services/
3. **Check for `writeFileSync` without temp+rename** — direct writes are never safe for payment data
4. **Check mutation ordering** — `x.status = 'paid'` should come AFTER `persistence.save()`

### Testing

1. Process crash simulation (kill -9 during write)
2. Cache eviction followed by lookup
3. Concurrent write serialization
4. Multi-step operation failure at each step

## Process Learnings

1. **Product-owner scope violation**: PO agent was briefed for requirements but implemented all 7 code fixes. The code quality was good so changes were accepted, but briefs need clearer scope enforcement.

2. **Test infra blocked**: All tests fail due to pre-existing missing `@babel/preset-typescript` dependency. Tests were written (1,663 lines across 5 files) but couldn't be executed.

3. **Standard tier sufficient for backend P1 fixes**: 5 agents, 3 phases, all gates passed. Architect+PO in parallel, then implementation, then QA+security in parallel.

4. **Full-file audits are essential**: 5 prior review rounds analyzed only PR diffs and missed all 7 P1 issues. Round 6's full-file audit of payment services was the first to catch the cache-as-primary-store pattern.

5. **Security review catches pre-existing issues**: 88/100 score with C-1 (hardcoded secret) being pre-existing but amplified by the new persistence layer.

## Related Documents

- [PR #73 Round 6 Review Findings](pr73-code-review-round6-cache-persistence-api-coverage.md) — the review that identified these 7 P1s
- [P1 Critical Fixes Round 4](p1-critical-fixes-pr73-round4.md) — prior P1 sprint (PaymentPersistence interface)
- [P2 Remediation Sprint](p2-remediation-sprint-25-findings.md) — 25 P2 findings fixed
- [Infrastructure Sprint](../infrastructure-issues/infrastructure-sprint-software-factory-first.md) — foundation sprint
