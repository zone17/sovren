# P1 Critical Fixes Architecture Plan — Review Round 6

**Sprint**: P1 Critical Fixes (Todos 112-118)
**Date**: 2026-02-14
**Status**: Plan Phase
**Scope**: 4 files across payment/Lightning services

## Summary

7 P1 findings from code review round 6 of PR #73. All affect payment data integrity or service reliability. Three files are affected: `payment-persistence.ts`, `lightning-service.ts`, `receipt-service.ts`, and `subscription-management-service.ts`.

---

## Batch Ordering

Fixes are grouped into 3 batches based on dependencies.

### Batch 1: Foundation (Do First)

These fixes establish the persistence safety layer that other fixes depend on.

| Todo | Title                     | File                   | Risk               |
| ---- | ------------------------- | ---------------------- | ------------------ |
| 112  | Non-Atomic Payment Writes | payment-persistence.ts | Data loss on crash |
| 118  | O(n) Webhook Scan         | lightning-service.ts   | Performance        |

**Rationale**: Todo 112 (atomic writes) must come first because todos 113 and 114 add more persistence calls — those new calls should use the already-fixed atomic write path. Todo 118 (secondary index) is independent and can be done in parallel.

### Batch 2: Persistence Fallbacks

These fixes add persistence-layer fallbacks to prevent data loss from cache eviction or in-memory-only storage.

| Todo | Title                     | File                 | Depends On |
| ---- | ------------------------- | -------------------- | ---------- |
| 113  | Cache-Only Invoice Lookup | lightning-service.ts | 112        |
| 114  | In-Memory Receipt Storage | receipt-service.ts   | 112        |
| 115  | Premature Status Mutation | lightning-service.ts | 112        |

**Rationale**: 113 and 114 both add new persistence read/write paths that rely on the atomic write guarantees from 112. 115 reorders persistence calls in `processWebhook` and should be done alongside 113's changes to the same method's fallback path to avoid merge conflicts.

### Batch 3: Structural Changes

These are larger changes that don't block other fixes.

| Todo | Title                            | File                               | Depends On |
| ---- | -------------------------------- | ---------------------------------- | ---------- |
| 116  | Non-Atomic Subscription Creation | subscription-management-service.ts | None       |
| 117  | Puppeteer Per Receipt            | receipt-service.ts                 | 114        |

**Rationale**: 116 is a standalone Supabase transaction fix. 117 (browser pool) should wait for 114 because 114 changes the receipt service class, and doing both simultaneously on the same file risks conflicts.

---

## Fix Specifications

### Todo 112: Atomic Writes for Payment Persistence

**File**: `packages/backend/src/services/payment-persistence.ts`

**Current Problem**:

- `writeToDisk()` (line 110-120) writes directly to target file with `writeFileSync`
- Mid-write crash truncates the file, corrupting all data
- `loadFromDisk()` (line 84-108) catches parse errors and silently initializes empty Maps — destroying all records
- No write serialization for concurrent saves

**Implementation**:

1. **Add write mutex** (simple promise-based lock):

```typescript
private writeLock: Promise<void> = Promise.resolve();

private async withWriteLock<T>(fn: () => Promise<T>): Promise<T> {
  let release: () => void;
  const acquired = new Promise<void>(resolve => { release = resolve; });
  const previous = this.writeLock;
  this.writeLock = acquired;
  await previous;
  try {
    return await fn();
  } finally {
    release!();
  }
}
```

2. **Change `writeToDisk` to atomic temp+rename**:

```typescript
private async writeToDiskAtomic(type: 'invoices' | 'payments'): Promise<void> {
  await this.withWriteLock(async () => {
    const filePath = path.join(this.dataDir, `${type}.json`);
    const tmpPath = `${filePath}.tmp`;
    const data = type === 'invoices'
      ? Array.from(this.invoices.values())
      : Array.from(this.payments.values());
    writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
    renameSync(tmpPath, filePath);
  });
}
```

3. **Change `loadFromDisk` to backup corrupted files**:

```typescript
// In the catch block, instead of silently continuing:
const backupPath = `${invoicesPath}.corrupt.${Date.now()}`;
try {
  renameSync(invoicesPath, backupPath);
} catch {}
console.error(`[PaymentPersistence] Corrupted file backed up to: ${backupPath}`);
```

4. **Update `saveInvoice` and `savePayment` to use async atomic write**:

```typescript
async saveInvoice(invoice: LightningInvoice): Promise<void> {
  this.invoices.set(invoice.id, invoice);
  await this.writeToDiskAtomic('invoices');
}
```

5. **Add `renameSync` to imports**:

```typescript
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from 'fs';
```

**New methods on PaymentPersistence interface**: None needed — the interface methods stay the same. The atomicity is an internal implementation detail of `JsonFilePaymentStore`.

**Edge cases**:

- If temp file write fails, original file is untouched (safe)
- If rename fails (cross-device), fall back to write+sync (very rare on same filesystem)
- Mutex ensures concurrent saves are serialized

---

### Todo 113: Cache-Only Invoice Lookup Fix

**File**: `packages/backend/src/services/lightning-service.ts`

**Current Problem**:

- `checkInvoiceStatus()` at lines 338-339 only checks `invoiceCache` (TTLCache, 1hr TTL, 10K max)
- After cache eviction, returns "Invoice not found" even though invoice exists in persistence
- Payments arriving after eviction fail silently

**Implementation**:

Change `checkInvoiceStatus()` (lines 338-344) from:

```typescript
const invoice = this.invoiceCache.get(invoiceId);
if (!invoice) {
  return { success: false, error: 'Invoice not found' };
}
```

To:

```typescript
let invoice = this.invoiceCache.get(invoiceId);
if (!invoice) {
  // Fallback to persistence on cache miss
  const persisted = await this.persistence.getInvoiceById(invoiceId);
  if (!persisted) {
    return { success: false, error: 'Invoice not found' };
  }
  invoice = persisted;
  // Re-populate cache if still active
  if (invoice.status === 'pending' && invoice.expires_at > Date.now()) {
    this.invoiceCache.set(invoiceId, invoice);
  }
}
```

**Pattern**: Cache-first, persistence-fallback, re-warm on hit. This pattern is also used in todo 114.

---

### Todo 114: Receipt Persistence

**File**: `packages/backend/src/services/lightning/receipt-service.ts`

**Current Problem**:

- `receiptStorage` at line 190 is `Map<string, PaymentReceipt>` — purely in-memory
- Process restart loses ALL receipt records
- Financial data with legal/compliance requirements stored only in memory

**Implementation**:

1. **Add receipt collection to `JsonFilePaymentStore`**:

In `payment-persistence.ts`, extend the `PaymentPersistence` interface:

```typescript
export interface PaymentPersistence {
  // ... existing methods ...
  saveReceipt(receipt: any): Promise<void>;
  getReceiptById(id: string): Promise<any | null>;
  getReceiptByField(field: string, value: string): Promise<any | null>;
  getAllReceipts(): Promise<any[]>;
}
```

In `JsonFilePaymentStore`, add:

```typescript
private receipts: Map<string, any> = new Map();

async saveReceipt(receipt: any): Promise<void> {
  this.receipts.set(receipt.id, receipt);
  // Also index by receiptNumber and paymentHash for lookups
  if (receipt.receiptNumber) this.receipts.set(receipt.receiptNumber, receipt);
  if (receipt.paymentHash) this.receipts.set(receipt.paymentHash, receipt);
  await this.writeToDiskAtomic('receipts');
}

async getReceiptById(id: string): Promise<any | null> {
  return this.receipts.get(id) || null;
}

async getReceiptByField(field: string, value: string): Promise<any | null> {
  // Direct lookup first (for indexed fields)
  const direct = this.receipts.get(value);
  if (direct) return direct;
  // Linear scan fallback
  for (const receipt of this.receipts.values()) {
    if (receipt[field] === value) return receipt;
  }
  return null;
}

async getAllReceipts(): Promise<any[]> {
  // Deduplicate (since we store by multiple keys)
  const seen = new Set<string>();
  const result: any[] = [];
  for (const receipt of this.receipts.values()) {
    if (!seen.has(receipt.id)) {
      seen.add(receipt.id);
      result.push(receipt);
    }
  }
  return result;
}
```

Also update `loadFromDisk` and `writeToDiskAtomic` to handle `'receipts'` type, loading from `receipts.json`.

2. **Inject persistence into `LightningReceiptService`**:

Add constructor parameter:

```typescript
constructor(config: ReceiptConfig, private persistence?: PaymentPersistence) {
```

3. **Persist receipts on creation** (after line 299):

```typescript
// After storing in local Map:
if (this.persistence) {
  await this.persistence.saveReceipt(receipt);
}
```

4. **Add persistence fallback to lookups** (`getReceiptByPaymentHash`, `getReceiptByNumber`, `verifyReceipt`):

```typescript
async getReceiptByPaymentHash(paymentHash: string): Promise<PaymentReceipt | null> {
  const cached = this.receiptStorage.get(paymentHash);
  if (cached) return cached;
  if (this.persistence) {
    const persisted = await this.persistence.getReceiptByField('paymentHash', paymentHash);
    if (persisted) {
      // Re-warm cache
      this.receiptStorage.set(persisted.id, persisted);
      this.receiptStorage.set(persisted.receiptNumber, persisted);
      this.receiptStorage.set(persisted.paymentHash, persisted);
      return persisted;
    }
  }
  return null;
}
```

Same pattern for `getReceiptByNumber` and the lookup in `verifyReceipt`.

5. **Hydrate in-memory Map from persistence on startup**: Add an `initialize()` method or hydrate in constructor:

```typescript
async initialize(): Promise<void> {
  if (this.persistence) {
    const receipts = await this.persistence.getAllReceipts();
    for (const receipt of receipts) {
      this.receiptStorage.set(receipt.id, receipt);
      this.receiptStorage.set(receipt.receiptNumber, receipt);
      this.receiptStorage.set(receipt.paymentHash, receipt);
    }
  }
}
```

**Persistence format**: Receipts stored as `data/payments/receipts.json` — consistent with existing invoices.json and payments.json location.

---

### Todo 115: Premature Status Mutation in processWebhook

**File**: `packages/backend/src/services/lightning-service.ts`

**Current Problem**:

- Line 589: `invoice.status = 'paid'` is set BEFORE persistence calls at lines 607-608
- If `savePayment` or `updateInvoiceStatus` throws, in-memory invoice is marked 'paid' but no payment record persisted
- Subsequent checks see 'paid' status without a payment record

**Implementation**:

Reorder the operations in `processWebhook()` method (lines 587-619). Change from:

```typescript
if (invoice && invoice.status === 'pending') {
  invoice.status = 'paid';                    // <-- MUTATION BEFORE PERSISTENCE
  const payment = { ... };
  this.paymentCache.set(payment.id, payment);
  await this.persistence.savePayment(payment);
  await this.persistence.updateInvoiceStatus(invoice.id, 'paid');
  ...
}
```

To:

```typescript
if (invoice && invoice.status === 'pending') {
  const payment: LightningPayment = { ... };

  // Persist FIRST, then mutate in-memory state
  await this.persistence.savePayment(payment);
  await this.persistence.updateInvoiceStatus(invoice.id, 'paid');

  // Only mutate in-memory state after successful persistence
  invoice.status = 'paid';
  this.paymentCache.set(payment.id, payment);

  // Emit events after successful persistence
  this.emit('invoice:paid', payment);
  this.emit('payment:completed', payment);
  ...
}
```

**Also fix the same pattern in `checkInvoiceStatus()`** (lines 358-378):

```typescript
// Before: invoice.status = 'paid' at line 359 BEFORE persistence at lines 377-378
// After: persist first, then mutate
```

**Also fix expired status** (lines 392-394):

```typescript
if (Date.now() > invoice.expires_at && invoice.status === 'pending') {
  await this.persistence.updateInvoiceStatus(invoice.id, 'expired');
  invoice.status = 'expired';
  this.emit('invoice:expired', invoice);
}
```

---

### Todo 116: Non-Atomic Subscription Creation

**File**: `packages/backend/src/services/subscription-management-service.ts`

**Current Problem**:

- `createSubscription()` (lines 380-434) performs 4 sequential DB ops without a transaction:
  1. Insert subscription (line 381)
  2. Create recurring payment (line 399)
  3. Generate invoice (line 409)
  4. Update tier subscriber count (line 427)
- Partial failures leave orphaned records

**Implementation**: Compensating transaction pattern (since Supabase JS client doesn't expose raw SQL transactions directly from the client SDK).

```typescript
async createSubscription(params: { ... }): Promise<{ ... }> {
  // ... validation and checks (unchanged) ...

  let subscriptionCreated = false;
  let recurringPaymentCreated = false;
  let invoiceGenerated = false;

  try {
    // Step 1: Insert subscription
    const { error: subError } = await supabase.from('subscriptions').insert([{ ... }]);
    if (subError) throw subError;
    subscriptionCreated = true;

    // Step 2: Create recurring payment
    await this.createRecurringPayment({ ... });
    recurringPaymentCreated = true;

    // Step 3: Generate initial invoice (if no trial)
    if (!trial_end) {
      initial_invoice = await this.lightningService.generateBOLT11Invoice({ ... });
      invoiceGenerated = true;
      subscription.status = 'pending';
      await this.updateSubscriptionStatus(subscription.id, 'pending');
    }

    // Step 4: Update tier subscriber count
    await supabase
      .from('subscription_tiers')
      .update({ current_subscribers: supabase.raw('current_subscribers + 1') })
      .eq('id', tier.id);

    // ... cache, analytics, return ...

  } catch (error) {
    // Compensating rollback in reverse order
    if (invoiceGenerated) {
      // Invoice is external — log but can't roll back
      this.logger.warn('Invoice generated but subscription failed — manual cleanup needed');
    }
    if (recurringPaymentCreated) {
      await supabase.from('recurring_payments')
        .delete()
        .eq('subscription_id', subscription.id)
        .catch(e => this.logger.error('Rollback recurring payment failed', e));
    }
    if (subscriptionCreated) {
      await supabase.from('subscriptions')
        .delete()
        .eq('id', subscription.id)
        .catch(e => this.logger.error('Rollback subscription failed', e));
    }
    throw new Error(`Subscription creation failed: ${error.message}`);
  }
}
```

**Alternative (Supabase RPC)**: If Supabase has a server-side function available, wrap all 4 ops in a PostgreSQL transaction via `supabase.rpc('create_subscription', { ... })`. This is cleaner but requires a Supabase migration. The compensating pattern above works without server-side changes and is the recommended MVP approach.

**Decision**: Use compensating transaction for now. Document the RPC migration path in the ADR.

---

### Todo 117: Puppeteer Browser Pool

**File**: `packages/backend/src/services/lightning/receipt-service.ts`

**Current Problem**:

- `generatePdfReceipt()` (lines 339-352) launches a new Puppeteer browser for EVERY receipt
- Each launch: 500ms-2s startup + 100-200MB RAM
- No cleanup on error paths
- 10 concurrent receipts = 1-2GB RAM

**Implementation**:

1. **Add browser pool to `LightningReceiptService`**:

```typescript
private browser: puppeteer.Browser | null = null;
private browserLaunchLock: Promise<void> = Promise.resolve();

private async getBrowser(): Promise<puppeteer.Browser> {
  if (this.browser && this.browser.isConnected()) {
    return this.browser;
  }
  // Serialize browser launches to prevent multiple concurrent launches
  let release: () => void;
  const acquired = new Promise<void>(resolve => { release = resolve; });
  const previous = this.browserLaunchLock;
  this.browserLaunchLock = acquired;
  await previous;
  try {
    // Double-check after acquiring lock
    if (this.browser && this.browser.isConnected()) {
      return this.browser;
    }
    this.browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    // Handle unexpected disconnections
    this.browser.on('disconnected', () => {
      this.browser = null;
    });
    return this.browser;
  } finally {
    release!();
  }
}
```

2. **Change `generatePdfReceipt`** to use page from shared browser:

```typescript
async generatePdfReceipt(receipt: PaymentReceipt): Promise<Buffer> {
  const browser = await this.getBrowser();
  const page = await browser.newPage();
  try {
    const htmlTemplate = await this.loadTemplate('receipt-pdf');
    const html = await this.renderTemplate(htmlTemplate, receipt);
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({
      ...this.config.pdfOptions,
      printBackground: true,
    });
    // ... store PDF, update receipt ...
    return pdfBuffer;
  } finally {
    await page.close();  // Always close page, even on error
  }
}
```

3. **Add cleanup in service shutdown**: Add to the module-level or service lifecycle:

```typescript
async shutdown(): Promise<void> {
  if (this.browser) {
    await this.browser.close();
    this.browser = null;
  }
}
```

**Key design decisions**:

- Single browser instance, many pages (Puppeteer's recommended pattern)
- Lazy initialization — browser only launched on first PDF request
- Page always closed in `finally` block to prevent memory leaks
- Reconnect on disconnect event
- `--disable-dev-shm-usage` flag prevents Docker /dev/shm OOM issues

---

### Todo 118: O(n) Webhook Linear Scan Fix

**File**: `packages/backend/src/services/lightning-service.ts`

**Current Problem**:

- Lines 580-582: `this.invoiceCache.values().find(inv => inv.payment_hash === data.payment_hash)`
- Creates full array copy of all cached invoices (up to 10K)
- O(n) linear scan on every webhook callback
- Lightning nodes expect quick webhook acknowledgment

**Implementation**:

1. **Add secondary index Map**:

```typescript
private paymentHashIndex = new Map<string, string>(); // payment_hash -> invoice_id
```

2. **Maintain index when caching invoices** — update all places that call `invoiceCache.set()`:

In `createInvoice()` (after line 305):

```typescript
this.invoiceCache.set(invoiceId, invoice);
this.paymentHashIndex.set(invoice.payment_hash, invoiceId);
```

In `initialize()` hydration loop (after line 198):

```typescript
this.invoiceCache.set(inv.id, inv);
this.paymentHashIndex.set(inv.payment_hash, inv.id);
```

In `checkInvoiceStatus()` when re-populating cache from persistence (new code from todo 113):

```typescript
this.invoiceCache.set(invoiceId, invoice);
this.paymentHashIndex.set(invoice.payment_hash, invoiceId);
```

3. **Replace linear scan in `processWebhook()`** (lines 580-585):

From:

```typescript
let invoice = this.invoiceCache.values().find((inv) => inv.payment_hash === payload.payment_hash);
if (!invoice) {
  invoice = (await this.persistence.getInvoiceByPaymentHash(payload.payment_hash)) ?? undefined;
}
```

To:

```typescript
// O(1) lookup via secondary index
const invoiceId = this.paymentHashIndex.get(payload.payment_hash);
let invoice = invoiceId ? this.invoiceCache.get(invoiceId) : undefined;
if (!invoice) {
  // Fallback to persistence (already O(n) but only on cache miss)
  const persisted = await this.persistence.getInvoiceByPaymentHash(payload.payment_hash);
  if (persisted) {
    invoice = persisted;
    // Re-warm cache and index
    this.invoiceCache.set(persisted.id, persisted);
    this.paymentHashIndex.set(persisted.payment_hash, persisted.id);
  }
}
```

4. **Clean up index entries when cache evicts**: Since TTLCache doesn't expose eviction callbacks, the index may have stale entries. This is acceptable because:
   - Stale entries just point to expired/missing cache entries
   - The fallback to persistence handles the cache miss
   - Index entries are tiny (two strings)
   - The index is bounded by the same lifecycle as invoices

**Complexity change**: O(10,000) -> O(1) on webhook hot path.

---

## Shared Patterns

### Pattern 1: Cache-First, Persistence-Fallback, Re-Warm

Used in: Todo 113, Todo 114, Todo 118

```typescript
let item = cache.get(id);
if (!item) {
  item = await persistence.getById(id);
  if (item && isStillActive(item)) {
    cache.set(item.id, item); // Re-warm cache
  }
}
```

### Pattern 2: Persist-Then-Mutate

Used in: Todo 115

```typescript
// BAD: mutate then persist
item.status = 'newStatus';
await persistence.save(item);

// GOOD: persist then mutate
await persistence.save({ ...item, status: 'newStatus' });
item.status = 'newStatus';
```

### Pattern 3: Atomic Write (Temp + Rename)

Used in: Todo 112

```typescript
writeFileSync(tmpPath, data);
renameSync(tmpPath, targetPath); // Atomic on POSIX
```

### Pattern 4: Promise-Based Mutex

Used in: Todo 112, Todo 117

```typescript
private lock: Promise<void> = Promise.resolve();
async withLock<T>(fn: () => Promise<T>): Promise<T> {
  let release: () => void;
  const acquired = new Promise<void>(r => { release = r; });
  const prev = this.lock;
  this.lock = acquired;
  await prev;
  try { return await fn(); } finally { release!(); }
}
```

---

## Files Changed Summary

| File                                                               | Todos         | Changes                                                                |
| ------------------------------------------------------------------ | ------------- | ---------------------------------------------------------------------- |
| `packages/backend/src/services/payment-persistence.ts`             | 112, 114      | Atomic writes, write mutex, receipt persistence, corrupted file backup |
| `packages/backend/src/services/lightning-service.ts`               | 113, 115, 118 | Persistence fallback, persist-then-mutate, secondary index             |
| `packages/backend/src/services/lightning/receipt-service.ts`       | 114, 117      | Receipt persistence injection, browser pool                            |
| `packages/backend/src/services/subscription-management-service.ts` | 116           | Compensating transaction                                               |

---

## Risk Assessment

| Todo | Risk                                                          | Mitigation                                                                      |
| ---- | ------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 112  | `renameSync` not atomic on Windows                            | We deploy on Linux/Docker — POSIX guarantees apply                              |
| 113  | Persistence lookup adds latency on cache miss                 | Only on cold cache; re-warm minimizes repeat misses                             |
| 114  | Receipt JSON file grows unbounded                             | Acceptable for MVP; document Supabase migration path                            |
| 115  | Reordering might cause events to fire after persistence delay | Events should only fire after successful persistence — this is correct behavior |
| 116  | Compensating transaction can fail (double failure)            | Log rollback failures for manual intervention; better than no rollback          |
| 117  | Shared browser instance is single point of failure            | Auto-reconnect on disconnect; lazy re-launch                                    |
| 118  | Stale index entries after TTL eviction                        | Benign — fallback to persistence handles it                                     |

---

## Testing Requirements

Each fix needs unit tests:

1. **112**: Test atomic write succeeds, test corrupted file backup, test mutex serialization
2. **113**: Test cache miss falls through to persistence, test re-warm on hit
3. **114**: Test receipts survive simulated restart (new store instance loads persisted data)
4. **115**: Test persistence failure doesn't mutate in-memory status, test expired status persisted
5. **116**: Test compensating rollback on step 2/3/4 failure
6. **117**: Test browser reuse across multiple PDF generations, test page cleanup on error
7. **118**: Test O(1) lookup via index, test index populated on create/hydration

---

## Definition of Done

- [ ] All 7 fixes implemented per spec above
- [ ] Unit tests for each fix
- [ ] No regressions in existing tests
- [ ] Payment data survives simulated crash (112)
- [ ] Invoice lookup works after cache eviction (113)
- [ ] Receipt data survives restart (114)
- [ ] Status mutation is post-persistence (115)
- [ ] Subscription creation rolls back on partial failure (116)
- [ ] Single browser instance shared across receipts (117)
- [ ] Webhook lookup is O(1) (118)
