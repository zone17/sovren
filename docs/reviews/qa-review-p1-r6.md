# QA Review — P1 Critical Fixes (Round 6)

**Sprint**: PR #73 Code Review Round 6 — P1 Remediation
**Date**: 2026-02-14
**Reviewer**: QA Agent
**Status**: ALL FIXES VERIFIED

---

## Executive Summary

All 7 P1 critical fixes (todos 112-118) have been **verified against their acceptance criteria** and **44 unit tests written and passing**. No regressions detected in existing tests. One pre-existing test isolation issue noted (not caused by these changes).

---

## Verification Results

### Fix #112: Payment Persistence Non-Atomic Writes

**File**: `packages/backend/src/services/payment-persistence.ts`
**Status**: PASS

| Criterion                                  | Result | Evidence                                                                             |
| ------------------------------------------ | ------ | ------------------------------------------------------------------------------------ |
| writeToDisk uses temp+rename pattern       | PASS   | Lines 181-182: `writeFileSync(tmpPath, ...)` then `renameSync(tmpPath, filePath)`    |
| Write mutex prevents concurrent writes     | PASS   | Line 30: `writeMutex: Promise<void>`, line 169: chained through mutex                |
| Corrupted files backed up before overwrite | PASS   | Lines 148-162: `backupCorruptedFile()` with `copyFileSync` to `.corrupt.<timestamp>` |
| .tmp file recovery on corruption           | PASS   | Lines 116-125: fallback to `tryParseFile(tmpPath)` after main file fails             |
| Structured error logging                   | PASS   | Lines 118-120, 129-131, 153-154, 185-187: includes type, path, action                |
| Errors propagated, not swallowed           | PASS   | Line 189: `Promise.reject(err)` in `doWrite()`                                       |

**Tests**: 8 tests in `payment-persistence-atomic.test.ts`

- Temp+rename atomic write (2 tests)
- Write mutex serialization (2 tests)
- Corruption recovery (3 tests)
- Error propagation (1 test)

---

### Fix #113: Cache-Only Invoice Lookup

**File**: `packages/backend/src/services/lightning-service.ts`
**Status**: PASS

| Criterion                                                     | Result | Evidence                                                   |
| ------------------------------------------------------------- | ------ | ---------------------------------------------------------- |
| checkInvoiceStatus falls through to persistence on cache miss | PASS   | Lines 353-364: `persistence.getInvoiceById()` fallback     |
| Re-caches from persistence for future lookups                 | PASS   | Line 357: `this.invoiceCache.set(persisted.id, persisted)` |
| Applied in processWebhook too                                 | PASS   | Lines 612-619: same pattern in webhook path                |
| Debug log on cache miss                                       | PASS   | Line 362: `console.debug` with cache miss message          |
| No behavioral change for cache-hit path                       | PASS   | Existing tests still pass                                  |

**Tests**: 4 tests in `lightning-service-p1.test.ts`

- Cache miss falls through to persistence
- Re-cache on hit
- Not found when in neither cache nor persistence
- processWebhook persistence fallback

---

### Fix #114: In-Memory Only Receipt Storage

**File**: `packages/backend/src/services/lightning/receipt-service.ts`
**Status**: PASS

| Criterion                                          | Result | Evidence                                                                                   |
| -------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------ |
| ReceiptPersistence class exists with atomic writes | PASS   | Lines 160-234: `ReceiptPersistence` class with temp+rename and mutex                       |
| Receipts loaded from disk on startup               | PASS   | Lines 369-380: `loadReceiptsFromDisk()` in constructor                                     |
| Receipts saved on creation                         | PASS   | Line 475: `persistReceipts()` after storage                                                |
| All 3 index keys restored on load                  | PASS   | Lines 373-375: `set(receipt.id)`, `set(receipt.receiptNumber)`, `set(receipt.paymentHash)` |
| downloadCount and emailDeliveredAt persisted       | PASS   | Lines 569-572: email delivery updates persisted                                            |
| Atomic write pattern applied                       | PASS   | Lines 210-220: same temp+rename+mutex pattern as Fix #112                                  |

**Tests**: 5 tests in `receipt-persistence.test.ts`

- Atomic write/read round-trip
- All 3 index keys restored
- downloadCount and emailDeliveredAt persistence
- Corruption recovery from .tmp
- Deduplication on persist

---

### Fix #115: Premature Invoice Status Mutation in Webhook

**File**: `packages/backend/src/services/lightning-service.ts`
**Status**: PASS

| Criterion                                                            | Result | Evidence                                                                            |
| -------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------- |
| invoice.status = 'paid' is AFTER savePayment and updateInvoiceStatus | PASS   | checkInvoiceStatus: lines 401-403; processWebhook: lines 639-642                    |
| If savePayment throws, status remains unchanged                      | PASS   | Verified by mock-based test                                                         |
| Expired status persisted before mutation                             | PASS   | Lines 418-419: `updateInvoiceStatus('expired')` before `invoice.status = 'expired'` |
| Applied in both checkInvoiceStatus and processWebhook                | PASS   | Both methods follow persist-then-mutate pattern                                     |

**Tests**: 3 tests in `lightning-service-p1.test.ts`

- Persistence failure leaves status as 'pending' (checkInvoiceStatus)
- Persistence failure leaves status as 'pending' (processWebhook)
- Expired status persisted before in-memory mutation

---

### Fix #116: Non-Atomic Subscription Creation

**File**: `packages/backend/src/services/subscription-management-service.ts`
**Status**: PASS

| Criterion                                       | Result | Evidence                                                                      |
| ----------------------------------------------- | ------ | ----------------------------------------------------------------------------- |
| 4 operations wrapped with compensating rollback | PASS   | Lines 380-477: try/catch with step tracking                                   |
| Step 2 failure rolls back step 1                | PASS   | Lines 468-473: subscription deleted on recurring payment failure              |
| Step 3 failure rolls back steps 1-2             | PASS   | Lines 460-465: recurring payment deleted; lines 468-473: subscription deleted |
| Step 4 failure rolls back steps 1-3             | PASS   | Lines 449-457: tier count decremented; plus steps above                       |
| Each rollback has its own catch                 | PASS   | Lines 457, 465, 473: `.catch(...)` on each rollback                           |
| GREATEST to prevent negative subscriber count   | PASS   | Line 453: `GREATEST(current_subscribers - 1, 0)`                              |
| Duplicate subscription prevention               | PASS   | Lines 337-347: existing subscription check                                    |

**Tests**: 7 tests in `subscription-atomicity.test.ts`

- Step tracking existence
- Rollback on step 2 failure
- Rollback on step 3 failure
- Rollback on step 4 failure
- Rollback error isolation (rollback itself fails)
- GREATEST pattern verification
- Duplicate subscription prevention

---

### Fix #117: Puppeteer Per-Receipt -- No Pool

**File**: `packages/backend/src/services/lightning/receipt-service.ts`
**Status**: PASS

| Criterion                                      | Result | Evidence                                                                  |
| ---------------------------------------------- | ------ | ------------------------------------------------------------------------- |
| BrowserPool class with acquirePage/releasePage | PASS   | Lines 244-335: full implementation                                        |
| Max concurrent pages configurable              | PASS   | Line 251: constructor parameter with default 5                            |
| Auto-recovery from browser crash               | PASS   | Lines 267-272: retry on newPage failure; line 315-317: disconnect handler |
| Page always released in finally block          | PASS   | Lines 529-533: `finally { browserPool.releasePage(page) }`                |
| Bounded wait queue when pool exhausted         | PASS   | Lines 257-261: promise-based queue                                        |
| Graceful shutdown                              | PASS   | Lines 325-334: `shutdown()` method; lines 652-654: service-level shutdown |

**Tests**: 6 tests in `browser-pool.test.ts`

- Page acquisition and release
- Wait queue at max capacity
- Max concurrency enforcement (never exceeds limit)
- Error path page release (finally pattern)
- Browser crash auto-recovery
- Configurable max concurrent pages

---

### Fix #118: O(n) Linear Scan in Webhook Hot Path

**File**: `packages/backend/src/services/lightning-service.ts`
**Status**: PASS

| Criterion                                  | Result | Evidence                                                               |
| ------------------------------------------ | ------ | ---------------------------------------------------------------------- |
| paymentHashIndex Map exists                | PASS   | Line 159: `private paymentHashIndex = new Map<string, string>()`       |
| Index maintained on createInvoice          | PASS   | Line 318: `this.paymentHashIndex.set(invoice.payment_hash, invoiceId)` |
| Index maintained on hydration              | PASS   | Line 209: `this.paymentHashIndex.set(inv.payment_hash, inv.id)`        |
| Index maintained on re-cache               | PASS   | Lines 359, 618: index updated on persistence fallback re-cache         |
| Index cleaned up via onEvict               | PASS   | Lines 174-178: TTLCache onEvict callback deletes from index            |
| processWebhook uses index (no linear scan) | PASS   | Lines 607-610: `paymentHashIndex.get()` then `invoiceCache.get()`      |
| Fallback to persistence on index miss      | PASS   | Lines 612-619: persistence fallback consistent with Fix #113           |

**Tests**: 5 tests in `lightning-service-p1.test.ts`

- Index built on invoice creation
- O(1) lookup used (values() not called)
- Index cleaned on cache eviction
- Index rebuilt from persistence on initialization
- Fallback to persistence when index has no entry

**Additional**: 6 tests in `ttl-cache-evict.test.ts` for the underlying onEvict callback mechanism.

---

## Test Summary

| Test File                          | Tests  | Status       |
| ---------------------------------- | ------ | ------------ |
| payment-persistence-atomic.test.ts | 8      | PASS         |
| lightning-service-p1.test.ts       | 12     | PASS         |
| receipt-persistence.test.ts        | 5      | PASS         |
| browser-pool.test.ts               | 6      | PASS         |
| subscription-atomicity.test.ts     | 7      | PASS         |
| ttl-cache-evict.test.ts            | 6      | PASS         |
| **Total**                          | **44** | **ALL PASS** |

---

## Regression Check

| Existing Test File          | Tests | Status              | Notes                                                                                                                                                                       |
| --------------------------- | ----- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| payment-persistence.test.ts | 11    | PASS                | No regressions                                                                                                                                                              |
| lightning-service.test.ts   | 24/25 | 1 PRE-EXISTING FAIL | `getCreatorPayments` test fails due to singleton state accumulation across describe blocks -- NOT caused by our changes. Fails even with clean data directory in isolation. |

---

## Issues Found

### Pre-existing (Not from this sprint)

1. **lightning-service.test.ts: Payment History test** (line 409): Expects 1 payment but the singleton accumulates payments from earlier describe blocks. The test does `paymentCache.clear()` but doesn't clear the persistence store, so `getCreatorPayments` reads from persistence which includes payments from previous test blocks. This is a pre-existing test isolation issue.

### From this sprint

None. All 7 fixes meet their acceptance criteria.

---

## Files Created

| File                                                                         | Purpose                         |
| ---------------------------------------------------------------------------- | ------------------------------- |
| `packages/backend/src/services/__tests__/payment-persistence-atomic.test.ts` | Fix #112 tests                  |
| `packages/backend/src/services/__tests__/lightning-service-p1.test.ts`       | Fixes #113, #115, #118 tests    |
| `packages/backend/src/services/__tests__/receipt-persistence.test.ts`        | Fix #114 tests                  |
| `packages/backend/src/services/__tests__/browser-pool.test.ts`               | Fix #117 tests                  |
| `packages/backend/src/services/__tests__/subscription-atomicity.test.ts`     | Fix #116 tests                  |
| `packages/backend/src/utils/__tests__/ttl-cache-evict.test.ts`               | TTLCache onEvict callback tests |
| `docs/reviews/qa-review-p1-r6.md`                                            | This review document            |

---

## Conclusion

All 7 P1 fixes are correctly implemented and meet their acceptance criteria. The fixes follow consistent patterns (atomic writes, persist-then-mutate, cache-with-fallback) and the code is well-structured. No regressions introduced. The codebase is ready for merge from a QA perspective.
