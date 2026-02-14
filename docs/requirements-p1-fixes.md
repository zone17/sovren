# P1 Critical Fixes — Requirements Document

**Sprint**: PR #73 Code Review Round 6 — P1 Remediation
**Date**: 2026-02-14
**Author**: Product Owner Agent
**Status**: Approved for implementation

---

## Executive Summary

Seven P1 critical findings have been identified in the payment and Lightning service layer. All relate to **data integrity**, **performance**, or **reliability** of the payment pipeline. These issues can cause **silent payment data loss**, **inconsistent state**, and **degraded performance under load**. Fixing them is mandatory before any production deployment.

---

## Business Rules

1. **Payment data must survive any single point of failure.** A process crash, disk error, or OOM event must never destroy payment records.
2. **No payment may be silently lost.** If a payment cannot be processed or persisted, the system must log an error and leave state consistent for retry.
3. **In-memory state must never diverge from persisted state.** Cache is an optimization, not a source of truth. Persistence is authoritative.
4. **Financial records (invoices, payments, receipts) are legal documents.** They must be durably stored and recoverable after restart.
5. **Multi-step state changes must be atomic.** Either all steps succeed, or none take effect.
6. **Webhook processing must complete within Lightning node timeout.** Linear scans and heavy allocations on the webhook hot path are unacceptable.
7. **Resource-heavy processes must be pooled.** Launching browsers, database connections, or external processes per-request is a denial-of-service vector.

---

## Success Metrics

| Metric                                                        | Target                        |
| ------------------------------------------------------------- | ----------------------------- |
| Payment data loss across all test scenarios                   | **Zero**                      |
| Receipt data survives process restart                         | **100%**                      |
| In-memory/persisted state consistency after failure injection | **100%**                      |
| Webhook invoice lookup time with 10K cached invoices          | **< 10ms** (O(1))             |
| Concurrent receipt generation (10 simultaneous) memory delta  | **< 200MB total** (not 1-2GB) |
| Receipt generation time per receipt (warm pool)               | **< 500ms**                   |
| Subscription creation atomicity on failure at any step        | **No orphaned records**       |
| All 7 fixes have at least 2 unit/integration tests each       | **Yes**                       |

---

## Fix #112: Payment Persistence Non-Atomic Writes

### User Story

> As a **creator receiving Lightning payments**, I want my payment records to be written atomically to disk, so that a process crash mid-write does not destroy all my payment history.

### Files Affected

- `/packages/backend/src/services/payment-persistence.ts` (lines 84-120)

### Enhanced Acceptance Criteria

- [ ] `writeToDisk` uses write-to-temp-then-rename pattern (`writeFileSync` to `<target>.tmp`, then `renameSync` to `<target>`)
- [ ] A write mutex (or equivalent serialization) prevents concurrent writes from interleaving
- [ ] On `loadFromDisk`, if JSON parse fails, the corrupted file is backed up to `<filename>.corrupt.<timestamp>` before any recovery action
- [ ] On `loadFromDisk`, if JSON parse fails but a `.tmp` file exists, attempt to recover from the `.tmp` file before falling back to empty state
- [ ] `console.error` replaced with structured error logging that includes file path, error type, and recovery action taken
- [ ] After a simulated mid-write crash (truncated file on disk), `loadFromDisk` recovers data from the last good write or `.tmp` file
- [ ] Write errors (e.g., disk full) are propagated to the caller, not silently swallowed

### Edge Cases

1. **Concurrent writes**: Two `saveInvoice` calls arrive simultaneously. Only one write happens at a time; both invoices are persisted.
2. **Mid-write crash**: Process killed after `writeFileSync` to `.tmp` but before `renameSync`. On restart, `.tmp` file is detected and used for recovery.
3. **Corrupted file recovery**: `invoices.json` contains truncated JSON. System backs up corrupted file and recovers from `.tmp` if available, or starts fresh with explicit log warning.
4. **Disk full**: `writeFileSync` to `.tmp` fails with `ENOSPC`. Error is logged and propagated. In-memory state remains correct. Next write retried on space availability.
5. **Permission denied**: Target directory becomes read-only. Write fails, error propagated, in-memory state preserved.
6. **Empty file on disk**: `invoices.json` exists but is 0 bytes. Treated as corruption, backed up, recovery attempted.

---

## Fix #113: Cache-Only Invoice Lookup

### User Story

> As a **supporter making a Lightning payment**, I want my payment to be matched to the correct invoice even if the invoice has been evicted from cache, so that my payment is never silently lost.

### Files Affected

- `/packages/backend/src/services/lightning-service.ts` (lines 338-339, `checkInvoiceStatus` method)

### Enhanced Acceptance Criteria

- [ ] `checkInvoiceStatus` first checks `invoiceCache`; on cache miss, falls through to `this.persistence.getInvoiceById(id)`
- [ ] If found in persistence but not cache, the invoice is re-added to cache for future lookups
- [ ] Cache miss fallback tested with: (a) entry expired by TTL, (b) entry evicted by LRU, (c) entry never cached
- [ ] Performance: persistence fallback adds < 50ms latency in the worst case (measured by test)
- [ ] No behavioral change for cache-hit path (existing tests still pass)
- [ ] Log a debug-level message on cache miss with persistence fallback (for monitoring cache hit rate)

### Edge Cases

1. **TTL expiry**: Invoice created 2 hours ago, TTL is 1 hour. Cache miss triggers persistence lookup, invoice found and returned.
2. **LRU eviction**: Cache at 10,000 entries, 10,001st invoice eviction the oldest. Evicted invoice lookup falls through to persistence.
3. **Persistence also empty**: Invoice not in cache AND not in persistence (e.g., invalid ID). Returns `{ success: false, error: 'Invoice not found' }` as before.
4. **Concurrent cache miss**: Two requests for the same evicted invoice arrive simultaneously. Both fall through to persistence. No double-insert errors.
5. **Persistence read failure**: Database/file read throws. Error logged, returns failure response (does not crash).

---

## Fix #114: In-Memory Only Receipt Storage

### User Story

> As a **supporter who purchased content**, I want my payment receipt to be available for download even after the server restarts, so that I have a permanent proof of my transaction for legal and personal records.

### Files Affected

- `/packages/backend/src/services/lightning/receipt-service.ts` (line 190, lines 297-299, lines 461-517)

### Enhanced Acceptance Criteria

- [ ] `receiptStorage` Map is backed by durable persistence (JSON file store extending `PaymentPersistence` pattern, or equivalent)
- [ ] On receipt creation, receipt is written to both Map and persistence
- [ ] On service initialization, existing receipts are loaded from persistence into the Map
- [ ] `downloadCount` and `emailDeliveredAt` fields are persisted and survive restart
- [ ] Receipt verification (`verifyReceipt`) works correctly after a restart (loaded from persistence)
- [ ] All 3 index keys (receipt ID, payment_hash, invoice_id) are restored on load
- [ ] Atomic write pattern (from Fix #112) applied to receipt persistence as well

### Edge Cases

1. **Restart with existing receipts**: 50 receipts exist on disk. After restart, all 50 are loaded and verifiable by any of the 3 lookup keys.
2. **Receipt verification after restart**: Receipt created before restart, verification attempted after restart. Verification succeeds with correct data.
3. **Concurrent receipt creation**: Two receipts created simultaneously. Both persisted without data loss or corruption.
4. **Receipt with high download count**: Receipt downloaded 100 times (downloadCount=100). After restart, downloadCount is still 100.
5. **Orphaned receipt data**: Receipt exists on disk but referenced invoice was deleted. Receipt still loads and verifies (receipt is self-contained proof).
6. **Large receipt volume**: 10,000 receipts on disk. Load time is acceptable (< 5 seconds). Memory usage is bounded.

---

## Fix #115: Premature Invoice Status Mutation in Webhook

### User Story

> As the **system processing a Lightning webhook**, I want invoice status to only change in memory after successful persistence, so that a persistence failure never leaves the system in an inconsistent state where an invoice appears paid but no payment record exists.

### Files Affected

- `/packages/backend/src/services/lightning-service.ts` (lines 587-608, `processWebhook` method)

### Enhanced Acceptance Criteria

- [ ] `invoice.status = 'paid'` is moved AFTER `savePayment()` and `updateInvoiceStatus()` both succeed
- [ ] If `savePayment()` throws, invoice status remains unchanged in memory
- [ ] If `updateInvoiceStatus()` throws after `savePayment()` succeeds, the system handles the partial state (payment saved, status not updated) — either retry status update or log for manual reconciliation
- [ ] Expired status transitions are also persisted to disk (not just in-memory mutation)
- [ ] A test simulates persistence failure and verifies invoice status remains 'pending' in memory
- [ ] Concurrent webhooks for the same invoice are handled safely (idempotent processing)

### Edge Cases

1. **Persistence failure on savePayment**: `savePayment()` throws. Invoice status stays 'pending' in memory. Webhook returns error. Lightning node retries.
2. **Persistence failure on updateInvoiceStatus**: `savePayment()` succeeds, `updateInvoiceStatus()` throws. System must handle this partial state — either retry or log warning. Invoice should not appear as 'paid' in memory.
3. **Concurrent webhook for same invoice**: Two webhook callbacks for the same payment_hash arrive within milliseconds. Only one processes; the second sees 'paid' status and skips (idempotent).
4. **Invoice already expired**: Webhook arrives for an invoice that was already marked 'expired' in memory. System should still process the payment if the Lightning node reports it as paid (the node is authoritative).
5. **Persistence slow but succeeds**: `savePayment()` takes 5 seconds due to disk I/O. Status mutation waits. No timeout-induced inconsistency.

---

## Fix #116: Non-Atomic Subscription Creation

### User Story

> As a **subscriber signing up for a creator's tier**, I want my subscription to be created atomically, so that a failure at any step does not leave me with a partial subscription (e.g., charged but no invoice, or subscription without correct tier count).

### Files Affected

- `/packages/backend/src/services/subscription-management-service.ts` (lines 380-434)

### Enhanced Acceptance Criteria

- [ ] All 4 operations (insert subscription, create recurring payment, generate invoice, update tier subscriber count) are wrapped in a transaction or compensating transaction pattern
- [ ] If step 2 (recurring payment) fails, step 1 (subscription) is rolled back
- [ ] If step 3 (invoice) fails, steps 1 and 2 are rolled back
- [ ] If step 4 (subscriber count) fails, steps 1-3 are rolled back
- [ ] No partial state is visible to other requests during the creation process (isolation)
- [ ] Subscriber count is always consistent with actual active subscription count
- [ ] Duplicate subscription creation for the same user+tier is prevented (idempotency guard)

### Edge Cases

1. **Failure at step 1** (insert subscription): No side effects. User sees error, can retry.
2. **Failure at step 2** (recurring payment): Subscription record rolled back. No orphaned subscription without payment schedule.
3. **Failure at step 3** (generate invoice): Subscription and recurring payment rolled back. No subscription without initial invoice.
4. **Failure at step 4** (update tier count): Subscription, payment, and invoice rolled back. Tier count stays accurate.
5. **Concurrent subscription creation**: Two users subscribe to same tier simultaneously. Both succeed if tier has capacity. Subscriber count incremented correctly for both (no lost updates).
6. **Duplicate subscription**: Same user tries to subscribe to same tier twice. Second attempt rejected with clear error message.
7. **Tier at max capacity**: Tier has `max_subscribers` limit. Subscription creation fails gracefully if limit reached, no side effects.

---

## Fix #117: Puppeteer Per-Receipt — No Pool

### User Story

> As a **platform operator**, I want receipt PDF generation to use a browser pool instead of launching a new browser per receipt, so that the server remains stable under concurrent receipt requests and does not run out of memory.

### Files Affected

- `/packages/backend/src/services/lightning/receipt-service.ts` (lines 339-352)

### Enhanced Acceptance Criteria

- [ ] A browser pool is created at service initialization (single browser instance, reuse pages)
- [ ] Each receipt generation acquires a page from the pool, uses it, and releases it back
- [ ] Pool has a configurable max concurrency (e.g., max 5 simultaneous pages)
- [ ] If pool is exhausted, additional requests queue and wait (bounded wait, not unbounded)
- [ ] Browser process is properly cleaned up on service shutdown (graceful close)
- [ ] If the browser crashes, the pool detects this and relaunches a fresh browser
- [ ] Memory usage for 10 concurrent receipt generations is < 300MB total (vs 1-2GB without pooling)
- [ ] Error paths properly release pages back to the pool (no page leak on error)

### Edge Cases

1. **Concurrent receipt generation (10 simultaneous)**: All 10 get pages (or queue if pool < 10). All succeed. Memory stays bounded.
2. **Browser crash mid-generation**: Puppeteer browser process dies. Pool detects disconnection, launches new browser, retries the failed receipt.
3. **Memory pressure**: System has limited RAM. Pool limits concurrency so total memory stays within budget. Excess requests queue rather than OOM.
4. **Service shutdown during generation**: Server shutting down while receipts are being generated. In-flight receipts complete (or timeout), then browser closed cleanly.
5. **Page navigation error**: HTML rendering fails for one receipt (bad template data). Page is still released to pool. Error returned to caller. Other receipts unaffected.
6. **Long-running receipt**: One receipt takes 10 seconds (complex content). Pool timeout triggers, page forcefully released, error returned. Other pages unaffected.

---

## Fix #118: O(n) Linear Scan in Webhook Hot Path

### User Story

> As the **system processing Lightning webhooks**, I want invoice lookup by `payment_hash` to be O(1), so that webhook processing is fast even with thousands of cached invoices and the Lightning node receives timely acknowledgment.

### Files Affected

- `/packages/backend/src/services/lightning-service.ts` (lines 580-582, `processWebhook` method)

### Enhanced Acceptance Criteria

- [ ] A secondary index `paymentHashIndex: Map<string, string>` maps `payment_hash` to `invoice_id`
- [ ] Webhook lookup uses `paymentHashIndex.get(data.payment_hash)` then `invoiceCache.get(invoiceId)` — O(1)
- [ ] No array copy (`[...this.invoiceCache.values()]`) on the webhook path
- [ ] `paymentHashIndex` is updated on every `invoiceCache.set()` and `invoiceCache.delete()` operation
- [ ] On cache miss in `paymentHashIndex`, fall through to persistence (`getInvoiceByPaymentHash`) — consistent with Fix #113
- [ ] Orphaned index entries are cleaned up when invoices are evicted from cache (TTL/LRU eviction callback)
- [ ] Webhook response time < 100ms with 10,000 cached invoices (benchmarked in test)

### Edge Cases

1. **Empty cache**: `paymentHashIndex` is empty. Lookup falls through to persistence. No error.
2. **Single entry**: One invoice in cache. Index lookup works correctly.
3. **10,000 entries**: Full cache. Index lookup is O(1), not O(n). Response time measurably constant.
4. **Missing payment_hash**: Webhook arrives with `payment_hash` not in index or persistence. Returns appropriate error, no crash.
5. **Index stale after eviction**: Invoice evicted from cache by TTL. Index entry also removed (via eviction callback). No stale pointer.
6. **Duplicate payment_hash**: Two invoices with same `payment_hash` (shouldn't happen, but defensive). Index stores the latest. Log warning about duplicate.
7. **Index rebuild on startup**: After loading from persistence, `paymentHashIndex` is rebuilt from all loaded invoices.

---

## Cross-Cutting Requirements

### Error Handling

- All persistence operations must have explicit error handling (no silent swallow).
- Errors in payment paths must be logged with structured context: operation, file path, invoice/payment ID, error type.
- Payment-critical errors should emit events for monitoring/alerting (via the existing `EventEmitter` pattern).

### Testing Requirements

- Each fix must have at least **2 unit tests** covering the happy path and the primary failure scenario.
- Each fix must have at least **1 integration test** that exercises the full path (e.g., create invoice, simulate crash, verify recovery).
- Failure injection tests must verify state consistency, not just that errors are caught.
- Performance tests for fixes #117 and #118 must include benchmarks with measurable thresholds.

### Backward Compatibility

- No breaking changes to the `PaymentPersistence` interface.
- Existing JSON data files on disk must be loadable by the new code without migration.
- API responses must not change shape or semantics.
- The `invoiceCache` and `receiptStorage` APIs remain the same to callers.

### Deployment Considerations

- Fix #112 (atomic writes) and Fix #114 (receipt persistence) may create new files on disk (`.tmp`, `.corrupt.*`, `receipts.json`). Ensure the data directory is writable.
- Fix #117 (browser pool) changes service initialization. Ensure Puppeteer dependencies are available in the production Docker image.
- Fix #116 (transaction) may require Supabase RPC or a compensating transaction utility. Verify Supabase client supports the chosen approach.

---

## Implementation Priority Order

| Priority | Fix                              | Rationale                                                     |
| -------- | -------------------------------- | ------------------------------------------------------------- |
| 1        | #112 — Atomic writes             | Foundation: all other persistence fixes depend on safe writes |
| 2        | #113 — Cache fallback            | Unblocks #118 (both touch invoice lookup)                     |
| 3        | #118 — O(1) webhook lookup       | Pairs with #113 (both in lightning-service.ts invoice lookup) |
| 4        | #115 — Premature status mutation | Depends on reliable persistence (#112)                        |
| 5        | #114 — Receipt persistence       | Uses atomic write pattern from #112                           |
| 6        | #116 — Atomic subscription       | Independent but medium complexity                             |
| 7        | #117 — Browser pool              | Independent performance fix, lowest data-loss risk            |

---

## Appendix: Source File References

| Fix  | File                                                               | Key Lines                            |
| ---- | ------------------------------------------------------------------ | ------------------------------------ |
| #112 | `packages/backend/src/services/payment-persistence.ts`             | 84-120 (loadFromDisk, writeToDisk)   |
| #113 | `packages/backend/src/services/lightning-service.ts`               | 338-339 (checkInvoiceStatus)         |
| #114 | `packages/backend/src/services/lightning/receipt-service.ts`       | 190, 297-299, 461-517                |
| #115 | `packages/backend/src/services/lightning-service.ts`               | 587-608 (processWebhook)             |
| #116 | `packages/backend/src/services/subscription-management-service.ts` | 380-434 (createSubscription)         |
| #117 | `packages/backend/src/services/lightning/receipt-service.ts`       | 339-352 (puppeteer.launch)           |
| #118 | `packages/backend/src/services/lightning-service.ts`               | 580-582 (invoiceCache.values().find) |
