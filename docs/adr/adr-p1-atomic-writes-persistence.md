# ADR: Atomic Writes and Persistence Strategy for Payment Data

**Status**: Accepted
**Date**: 2026-02-14
**Deciders**: Architecture Team (Sprint P1 Critical Fixes R6)
**Context**: Todos 112, 113, 114, 115

## Context

The payment subsystem uses `JsonFilePaymentStore` for MVP persistence. Several P1 findings revealed data integrity gaps:

1. **Non-atomic writes** (112): `writeFileSync` directly to target file. Mid-crash truncation destroys all data. `loadFromDisk` silently reinitializes with empty Maps.
2. **Cache-only lookups** (113): `checkInvoiceStatus` only checks TTLCache. After eviction, invoices are "not found" despite existing in persistence.
3. **In-memory-only receipts** (114): `receiptStorage` is a plain Map. Process restart loses all receipt records.
4. **Premature mutation** (115): Status set to 'paid' before persistence succeeds. Failed persistence leaves inconsistent state.

## Decision

### 1. Atomic Write via Temp+Rename (Todo 112)

**Write to temp file, then `renameSync` to target.** This is atomic on POSIX filesystems (ext4, XFS, APFS). If the process crashes mid-write, only the temp file is corrupted; the original file remains intact.

Add a promise-based write mutex to serialize concurrent writes. This prevents interleaving when multiple `saveInvoice`/`savePayment` calls occur concurrently.

**Rejected alternative**: SQLite — adds a dependency and migration complexity for MVP. The JSON file store with atomic writes is sufficient for single-instance deployment.

### 2. Cache-First, Persistence-Fallback Pattern (Todos 113, 114)

All lookups follow: check in-memory cache first, fall through to persistence on miss, re-warm cache on hit. This ensures:

- Normal-case performance (cache hit = O(1), no I/O)
- Correctness after eviction/restart (persistence always has the data)
- Cache stays warm for repeated lookups

### 3. Extend JsonFilePaymentStore for Receipts (Todo 114)

Add receipt persistence to the existing `PaymentPersistence` interface and `JsonFilePaymentStore` rather than creating a new persistence mechanism. Receipts are stored in `data/payments/receipts.json` alongside `invoices.json` and `payments.json`.

**Rejected alternative**: Supabase `receipts` table — correct long-term solution but requires migration, schema design, and RLS policies. Documented as future migration path.

### 4. Persist-Then-Mutate Ordering (Todo 115)

All state mutations follow: persist the new state first, then update in-memory objects. If persistence fails, in-memory state remains consistent with what's on disk. Events are emitted only after successful persistence.

### 5. Compensating Transaction for Subscription Creation (Todo 116)

Use compensating (rollback) pattern for the 4-step subscription creation rather than Supabase RPC transactions. On failure at any step, previously completed steps are reversed in order.

**Rejected alternative**: Supabase RPC with PostgreSQL transaction — cleaner but requires server-side function deployment. Documented as future migration path.

### 6. Browser Pool for PDF Generation (Todo 117)

Single shared Puppeteer browser instance with lazy initialization. Each receipt gets a new page (not a new browser). The browser auto-reconnects on disconnect.

**Rejected alternative**: Replace Puppeteer with PDFKit — would require rewriting the HTML template system. The browser pool solves the resource problem without architectural changes.

## Consequences

### Positive

- Payment data survives process crashes (atomic writes)
- No silent data loss from cache eviction (persistence fallback)
- Receipt records are durable across restarts
- Consistent in-memory and on-disk state (persist-then-mutate)
- PDF generation memory usage reduced by ~90% under load

### Negative

- JSON file persistence is still single-instance only (no multi-instance safety)
- Receipt JSON file will grow unbounded over time
- Compensating transaction can partially fail (double failure scenario)
- Stale payment_hash index entries after TTL eviction (benign)

### Future Migration Path

When the system needs multi-instance deployment or the JSON files grow large:

1. Implement `SupabasePaymentStore` conforming to `PaymentPersistence` interface
2. Create `receipts` table in Supabase with proper schema
3. Replace `JsonFilePaymentStore` with `SupabasePaymentStore` in DI container
4. Replace compensating transaction with Supabase RPC for subscription creation
5. The `PaymentPersistence` interface ensures all callers work unchanged

## References

- Todo 112: Non-Atomic Payment Writes
- Todo 113: Cache-Only Invoice Lookup
- Todo 114: In-Memory Receipt Storage
- Todo 115: Premature Status Mutation
- Todo 116: Non-Atomic Subscription Creation
- Todo 117: Puppeteer Per Receipt
- Todo 118: O(n) Webhook Scan
