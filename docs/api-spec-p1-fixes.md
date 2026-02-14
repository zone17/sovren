# API Spec — P1 Critical Fixes (Round 6)

**Date**: 2026-02-14

## API Contract Changes

**None.** All 7 P1 fixes are internal implementation changes. No API response formats, endpoints, or request schemas are modified.

### Behavioral Changes (Existing Endpoints)

| Endpoint / Method               | Before                                                        | After                                                                    |
| ------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `checkInvoiceStatus(id)`        | Returns "Invoice not found" after cache eviction              | Falls through to persistence; returns invoice if it exists on disk       |
| `processWebhook(payload)`       | Events emitted before persistence; status mutated pre-persist | Events emitted after successful persistence; status mutated post-persist |
| `getReceiptByPaymentHash(hash)` | Returns null after restart                                    | Returns persisted receipt                                                |
| `getReceiptByNumber(num)`       | Returns null after restart                                    | Returns persisted receipt                                                |
| `verifyReceipt(id)`             | Returns "Receipt not found" after restart                     | Returns valid receipt from persistence                                   |
| `createSubscription(params)`    | Orphaned records on partial failure                           | Compensating rollback cleans up on failure                               |
| `generatePdfReceipt(receipt)`   | 500ms-2s per receipt (new browser)                            | ~50-200ms per receipt (shared browser, new page)                         |

### Error Response Changes

No new error codes. Existing error messages unchanged. The only difference is that some "not found" errors that previously occurred due to cache eviction will now correctly find the resource in persistence.
