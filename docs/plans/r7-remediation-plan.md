# Round 7 Remediation Plan

**Sprint**: R7 Remediation | **Todos**: 135-149 | **PR**: #73
**Created**: 2026-02-15 | **Priority Order**: P1 > P2 > P3

## Summary

15 findings from Round 7 code review across 3 priority levels:
- **P1 (Security)**: 3 items (135, 136, 137) — must fix, all auth/payment related
- **P2 (Reliability)**: 7 items (138-144) — should fix, data integrity and performance
- **P3 (Quality)**: 5 items (145-149) — defer most, too large for remediation sprint

**Recommendation**: Fix all P1s, fix all P2s, fix only todo 149 (z.any) from P3. Defer 145-148 (god class decomposition, route fragmentation, circular deps, dead code) as they are large refactors with low immediate risk.

---

## Batch 1: P1 Security Fixes (CRITICAL — Do First)

### Fix 1.1: Auth Bypass on Creator Payout Endpoints (Todo 135)

**Priority**: P1 | **Complexity**: Small | **Risk**: Low
**Why first**: Active exploit vector — any authenticated user can drain creator funds.

**Affected Files**:
- `packages/backend/src/routes/lightning.ts` (lines 167, 191, 208)

**Approach**:
1. Import `requireCreator` from `../middleware/auth`
2. Add `requireCreator` middleware after `authenticate` on 3 routes:
   - `POST /creator/payout` (line 167)
   - `GET /creator/payouts` (line 191)
   - `GET /creator/subscribers` (line 208)
3. Also add service-level validation in `PayoutManagementService` (defense in depth) — check caller role before processing

**Implementation**:
```typescript
// In lightning.ts — add to imports:
import { authenticate, requireCreator } from '../middleware/auth';

// Replace line 167:
router.post('/creator/payout', authenticate, requireCreator, async (req, res) => {
// Replace line 191:
router.get('/creator/payouts', authenticate, requireCreator, async (req, res) => {
// Replace line 208:
router.get('/creator/subscribers', authenticate, requireCreator, async (req, res) => {
```

**Auth middleware already exists**: `requireCreator` is defined at `packages/backend/src/middleware/auth.ts:134` as `authorize(['creator', 'admin'])`. No new middleware needed.

**Dependencies**: None
**Acceptance Criteria**:
- Payout endpoints require `creator` role
- Non-creator users receive 403 Forbidden
- Remove the `// In a real implementation` TODO comments on those routes

---

### Fix 1.2: Duplicate Payout — Idempotency Key (Todo 136)

**Priority**: P1 | **Complexity**: Medium | **Risk**: Low
**Why second**: Double-spend exploit, especially dangerous combined with 135.

**Affected Files**:
- `packages/backend/src/routes/lightning.ts` (payout route handler)
- `packages/backend/src/services/payout-management-service.ts`

**Approach**: Idempotency key pattern (industry standard for payment APIs).

**Implementation**:
1. Extract `Idempotency-Key` header in the payout route handler
2. Require it (return 400 if missing)
3. In `PayoutManagementService`, add a TTL-based Map to track idempotency keys
4. On payout request:
   - If key exists and payout completed/pending: return cached result
   - If key is new: process payout, store key -> result mapping
5. Keys expire after 24 hours (use TTLCache pattern already in codebase)

**Key design decision**: Use in-memory TTLCache (same pattern as `lightning-service.ts` invoice cache). For MVP this is sufficient. When Supabase is fully wired, move to a `payout_idempotency` table.

```typescript
// In payout-management-service.ts:
private idempotencyCache = new TTLCache<string, Payout>({
  maxSize: 10_000,
  ttlMs: 24 * 60 * 60 * 1000, // 24 hours
});

async requestPayout(params: PayoutParams, idempotencyKey: string): Promise<Payout> {
  const existing = this.idempotencyCache.get(idempotencyKey);
  if (existing) return existing;

  const payout = await this.createPayout(params);
  this.idempotencyCache.set(idempotencyKey, payout);
  return payout;
}
```

**Dependencies**: Depends on Fix 1.1 (auth bypass) being done first, since both touch `lightning.ts` payout route.
**Acceptance Criteria**:
- Payout requests require `Idempotency-Key` header
- Duplicate key returns cached result (not re-processed)
- Missing header returns 400 Bad Request

---

### Fix 1.3: Role Escalation via JWT Refresh (Todo 137)

**Priority**: P1 | **Complexity**: Small | **Risk**: Low

**Affected Files**:
- `packages/backend/src/services/nostr-auth.ts` (lines 253-296, `refreshJWT` method)

**Current problem**: Line 278 copies `role: verification.payload.role` from old token without re-querying.

**Approach**: On token refresh, look up the user's current role from Supabase instead of copying from the old token.

**Implementation**:
```typescript
async refreshJWT(token: string): Promise<{...}> {
  const verification = await this.verifyJWT(token);
  if (!verification.valid || !verification.payload) { return {success: false, ...}; }

  // Re-query current role from database instead of using stale token role
  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('nostr_pubkey', verification.payload.nostr_pubkey)
    .single();

  const currentRole = userData?.role || 'supporter';

  const payload: JWTPayload = {
    nostr_pubkey: verification.payload.nostr_pubkey,
    iat: newTimestamp,
    exp: newTimestamp + this.parseJWTExpiration(),
    signature_verified: true,
    role: currentRole, // Fresh from DB
  };
  // ...
}
```

**Note**: This requires importing supabase client into nostr-auth.ts. Currently the file is pure (no DB dependency). Alternative: inject a `getUserRole(pubkey)` callback via constructor to keep the service testable.

**Recommended approach**: Add optional `userRoleFetcher` to constructor:
```typescript
constructor(
  jwtSecret?: string,
  jwtExpiresIn?: string,
  challengeTTL?: number,
  private userRoleFetcher?: (pubkey: string) => Promise<string | undefined>
)
```

For the singleton at line 390, pass a Supabase-based fetcher. In tests, pass a mock.

**Dependencies**: None (independent of 135/136)
**Acceptance Criteria**:
- Token refresh queries current role from database
- Demoted user gets new role in refreshed token

---

## Batch 2: P2 Reliability Fixes

### Fix 2.1: fsync in Atomic Writes (Todo 138)

**Priority**: P2 | **Complexity**: Small | **Risk**: Low

**Affected Files**:
- `packages/backend/src/services/payment-persistence.ts` (lines 163-180, `doWrite`)
- `packages/backend/src/services/lightning/receipt-service.ts` (lines 201-211, `doWrite`)

**Approach**: Replace `writeFileSync` + `renameSync` with `openSync` + `writeSync` + `fsyncSync` + `closeSync` + `renameSync`.

**Implementation** (same for both files):
```typescript
import { openSync, writeSync, fsyncSync, closeSync, renameSync } from 'fs';

private doWrite(type: 'invoices' | 'payments'): Promise<void> {
  const filePath = path.join(this.dataDir, `${type}.json`);
  const tmpPath = `${filePath}.tmp`;
  const data = type === 'invoices'
    ? Array.from(this.invoices.values())
    : Array.from(this.payments.values());
  try {
    const fd = openSync(tmpPath, 'w');
    try {
      writeSync(fd, JSON.stringify(data, null, 2));
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    renameSync(tmpPath, filePath);
    return Promise.resolve();
  } catch (err) {
    // ... error handling
  }
}
```

**IMPORTANT**: This fix is independent of Fix 2.3 (async I/O). Do fsync first since it's a one-line fix. Then when converting to async, use `fs.promises` equivalents with `fs.fdatasync`.

**Dependencies**: Should be done BEFORE Fix 2.3 (sync-to-async conversion), as both touch the same doWrite methods.
**Acceptance Criteria**:
- `fsyncSync()` called on fd before `renameSync()`
- Both persistence files updated

---

### Fix 2.2: Cache Stampede — Request Coalescing (Todo 139)

**Priority**: P2 | **Complexity**: Medium | **Risk**: Low

**Affected Files**:
- `packages/backend/src/services/lightning-service.ts`

**Approach**: Singleflight/request coalescing pattern. Track pending persistence lookups; concurrent requests for the same key share the same Promise.

**Implementation**: Add a `pendingLookups` Map to `LightningService`:
```typescript
private pendingLookups = new Map<string, Promise<LightningInvoice | null>>();

private async getInvoiceWithFallback(id: string): Promise<LightningInvoice | null> {
  let invoice = this.invoiceCache.get(id);
  if (invoice) return invoice;

  const pending = this.pendingLookups.get(id);
  if (pending) return pending;

  const lookup = this.persistence.getInvoiceById(id).then(result => {
    this.pendingLookups.delete(id);
    if (result) {
      this.invoiceCache.set(result.id, result);
      if (result.payment_hash) {
        this.paymentHashIndex.set(result.payment_hash, result.id);
      }
    }
    return result;
  }).catch(err => {
    this.pendingLookups.delete(id);
    throw err;
  });

  this.pendingLookups.set(id, lookup);
  return lookup;
}
```

Then refactor `checkInvoiceStatus` (line 352-354) and `processWebhook` (line 614-621) to use `getInvoiceWithFallback()` instead of inline persistence lookups.

**Dependencies**: None
**Acceptance Criteria**:
- Concurrent cache misses for same key result in single persistence read
- Pending lookup map cleaned up after resolution (including errors)

---

### Fix 2.3: Blocking Sync I/O to Async (Todo 140)

**Priority**: P2 | **Complexity**: Medium | **Risk**: Low

**Affected Files**:
- `packages/backend/src/services/payment-persistence.ts` (`doWrite` method)
- `packages/backend/src/services/lightning/receipt-service.ts` (`doWrite` method)

**Approach**: Convert `doWrite` from sync to async fs operations. The write mutex already serializes writes, so async is safe.

**Implementation**:
```typescript
import { open } from 'fs/promises';
import { renameSync } from 'fs'; // rename stays sync for atomicity guarantee

private async doWrite(type: 'invoices' | 'payments'): Promise<void> {
  const filePath = path.join(this.dataDir, `${type}.json`);
  const tmpPath = `${filePath}.tmp`;
  const data = type === 'invoices'
    ? Array.from(this.invoices.values())
    : Array.from(this.payments.values());

  const handle = await open(tmpPath, 'w');
  try {
    await handle.writeFile(JSON.stringify(data, null, 2), 'utf-8');
    await handle.datasync(); // async equivalent of fsyncSync
  } finally {
    await handle.close();
  }
  renameSync(tmpPath, filePath); // rename is fast and must be atomic
}
```

**Note**: Startup reads (`loadFromDisk`) can remain sync — they only run once at init time.

**Dependencies**: Must do AFTER Fix 2.1 (fsync) since both touch `doWrite`. The async conversion subsumes the sync fsync fix, but doing them in order ensures the fsync logic is correct before converting.
**Acceptance Criteria**:
- All file writes use async APIs
- Write mutex continues to serialize correctly
- Startup reads remain sync

---

### Fix 2.4: Middleware Ordering — Rate Limit Before Body Parse (Todo 141)

**Priority**: P2 | **Complexity**: Small | **Risk**: Low

**Affected Files**:
- `packages/backend/src/app.ts` (lines 112-126)

**Current order** (from app.ts):
1. correlationId (line 49)
2. helmet (line 53)
3. XSS protection (line 74)
4. CORS (line 82)
5. **Rate limiting (line 114)** <-- correct position already!
6. express.json (line 117)
7. express.urlencoded (line 126)

**Wait — re-reading app.ts**: Rate limiting IS already before body parsing (line 114 vs line 117). Let me verify...

Actually, looking at the order:
- Line 114: `app.use(createRateLimiter(...))`
- Line 117: `app.use(express.json(...))`

**The middleware order appears correct already.** Rate limiting IS before body parsing.

However, the body limit is `10mb` (line 119), which is very generous. The todo recommends adding explicit size limits:
- JSON: `100kb` default (or `1mb` for content APIs)
- Multipart: `10mb` for media uploads (handled separately)

**Revised approach**: Since ordering is already correct, focus on tightening body size limits:
1. Change default `express.json({ limit: '100kb' })` for general routes
2. Keep `10mb` only for upload-specific routes via route-level middleware override
3. Add `express.urlencoded({ limit: '100kb' })` matching

Wait — the `10mb` limit serves image uploads via `rawBody`. Need to preserve that for specific routes. Two approaches:
- Option A: Lower global limit, add per-route override for upload routes
- Option B: Keep `10mb` but add `express.json({ limit })` per-route where needed

**Recommended**: Option A. Lower global to `1mb` (covers most JSON payloads including content body). The `rawBody` verify function should still work — it captures the buffer before parsing.

```typescript
// Global body parser — reasonable limit for JSON APIs
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));
```

For routes needing larger payloads (media upload), they should use `multer` or a separate body parser.

**Dependencies**: None
**Acceptance Criteria**:
- Body parser has explicit size limit (1mb for JSON)
- Rate limiter continues to run before body parser
- Verify no existing routes depend on >1mb JSON payloads (content publishing has `max: 1000000` chars in Zod, which is ~1MB, so `1mb` limit is fine)

---

### Fix 2.5: Memory Leak — EventEmitter Listeners (Todo 142)

**Priority**: P2 | **Complexity**: Medium | **Risk**: Low

**Affected Files**: Multiple services extending EventEmitter (~16 services identified):
- `packages/backend/src/services/lightning-service.ts`
- `packages/backend/src/services/subscription-management-service.ts`
- `packages/backend/src/services/payout-management-service.ts`
- `packages/backend/src/services/lightning/receipt-service.ts`
- And 12+ others

**Focus**: The most impactful leaks are in services that register `setInterval` callbacks without cleanup:
1. `SubscriptionManagementService` — 2 setIntervals in `setupRecurringPaymentScheduler()` (line 918) and `setupSubscriptionMonitoring()` (line 928). `shutdown()` clears `recurringPaymentJobs` but NOT these intervals.
2. `PayoutManagementService` — 2 setIntervals in `setupPayoutScheduler()` (line 803) and `setupEarningsCalculation()` (line 813). `shutdown()` doesn't clear these.
3. `process.on()` handlers in `shutdown.ts` and `server.ts` — these are fine (only registered once).

**Approach**: Track setInterval IDs and clear them in shutdown:

```typescript
// In SubscriptionManagementService:
private recurringPaymentInterval?: NodeJS.Timeout;
private subscriptionMonitorInterval?: NodeJS.Timeout;

private async setupRecurringPaymentScheduler(): Promise<void> {
  this.recurringPaymentInterval = setInterval(async () => {
    await this.processRecurringPayments();
  }, 3600000);
  await this.processRecurringPayments();
}

async shutdown(): Promise<void> {
  if (this.recurringPaymentInterval) clearInterval(this.recurringPaymentInterval);
  if (this.subscriptionMonitorInterval) clearInterval(this.subscriptionMonitorInterval);
  // ... existing cleanup
}
```

Same pattern for `PayoutManagementService`.

**Dependencies**: None
**Acceptance Criteria**:
- All setInterval timers tracked and cleared in shutdown
- Verified: no dangling intervals after shutdown

---

### Fix 2.6: NOSTR Signature Replay Protection (Todo 143)

**Priority**: P2 | **Complexity**: Medium | **Risk**: Low

**Affected Files**:
- `packages/backend/src/services/nostr-auth.ts`

**Current state**: `verifySignature()` (line 103) checks timestamp within 5-minute window and deletes the challenge after use. BUT the challenge is per-session — the SIGNATURE itself can be replayed with a different (or no) challenge if the attacker constructs a valid NOSTR event.

Actually, re-reading the code more carefully: the verification flow requires a valid challenge (line 114-121) that was previously generated and stored. The challenge IS deleted after successful use (line 163). So replay of the same challenge is already prevented.

The risk is: if an attacker captures the full (signature, challenge, timestamp) tuple before it's used, they can replay it. But since challenges are one-time-use and server-generated, this is already mitigated.

**However**: The 5-minute timestamp window (line 134-141) is checked independently of challenge validity. If the attacker can forge events within the window without a valid challenge... no, the challenge check at line 114 prevents this.

**Real gap**: The `isValidSignature` standalone function (line 401) has NO challenge/nonce protection. If this function is used anywhere for auth decisions, it's vulnerable. Let me check usage:

The standalone `isValidSignature` is exported but... it doesn't seem to be used internally for auth decisions. It's a utility.

**Revised assessment**: The challenge-based auth flow is already reasonably protected. The todo's recommendation to add a TTL cache for used signatures is defense-in-depth. Worth implementing but lower urgency than stated.

**Implementation**: Add used-signature tracking:
```typescript
private usedSignatures = new TTLCache<string, true>({
  maxSize: 50_000,
  ttlMs: 5 * 60 * 1000, // Match timestamp window
});

async verifySignature(verification: NostrVerification): Promise<...> {
  // ... existing validation ...

  // Replay protection: reject already-used signatures
  const sigHash = createHash('sha256').update(verification.signature).digest('hex');
  if (this.usedSignatures.has(sigHash)) {
    return { valid: false, pubkey, error: 'Signature already used' };
  }

  // ... verify signature ...

  if (isValidSignature) {
    this.usedSignatures.set(sigHash, true);
    this.challenges.delete(challenge);
    return { valid: true, pubkey };
  }
}
```

**Dependencies**: None
**Acceptance Criteria**:
- Used signatures tracked in TTL cache
- Replayed signature returns error
- TTL matches timestamp window (5 min)

---

### Fix 2.7: Compensating Transaction Rollback Retry (Todo 144)

**Priority**: P2 | **Complexity**: Medium | **Risk**: Low

**Affected Files**:
- `packages/backend/src/services/subscription-management-service.ts` (lines 382-481)

**Current state**: Rollback steps (lines 447-480) use `.catch()` to log but don't retry. If rollback fails, orphaned records remain.

**Approach**: Add retry wrapper + alert on final failure:

```typescript
private async retryOperation(
  operation: () => Promise<void>,
  label: string,
  maxRetries = 3
): Promise<boolean> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await operation();
      return true;
    } catch (err) {
      this.logger.warn(`${label} attempt ${attempt}/${maxRetries} failed`, err);
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 100 * attempt)); // backoff
      }
    }
  }
  return false; // All retries exhausted
}
```

Then in the rollback section:
```typescript
if (tierCountIncremented) {
  const ok = await this.retryOperation(
    () => supabase.from('subscription_tiers').update({...}).eq('id', tier.id),
    'Rollback tier count'
  );
  if (!ok) {
    this.logger.error('ALERT: Orphaned tier count increment', {
      tier_id: tier.id, subscription_id: subscription.id
    });
    this.emit('rollback:failed', { step: 'tier_count', tier_id: tier.id });
  }
}
```

Also fix the `var` usage (noted in todo) — replace `var createdInvoice` with `let createdInvoice`. Looking at line 386, it's already `let createdInvoice: unknown;` — this was already fixed in a prior round.

**Dependencies**: None
**Acceptance Criteria**:
- Rollback steps retry up to 3 times with backoff
- Failed rollback after retries emits alert event
- Orphaned record IDs logged for manual reconciliation

---

## Batch 3: P3 Quality Fixes (Selective)

### Fix 3.1: z.any() in Content Validators (Todo 149)

**Priority**: P3 | **Complexity**: Small | **Risk**: Low

**Affected Files**:
- `packages/backend/src/validators/content/index.ts` (lines 33, 141)

**Current state**: Two occurrences of `z.record(z.any())` — in `PublishContentSchema` (line 33) and `UpdateContentSchema` (line 141).

**Approach**: Replace with typed schema:
```typescript
// Define a metadata value schema (supports common JSON types)
const MetadataValueSchema = z.union([
  z.string().max(10000),
  z.number(),
  z.boolean(),
  z.null(),
]);

// Replace z.record(z.any()) with:
metadata: z.record(z.string(), MetadataValueSchema).optional(),
```

This allows `Record<string, string | number | boolean | null>` but prevents nested objects, arrays, or oversized values.

**Dependencies**: None
**Acceptance Criteria**:
- Zero `z.any()` in validator files
- Metadata fields have typed schemas
- Max string length prevents payload abuse

---

### Deferred P3 Items

The following P3 items are deferred to a future sprint. They are large refactors with low immediate risk:

| Todo | Title | Why Defer |
|------|-------|-----------|
| 145 | God class decomposition | Large refactor (~1114 lines), risk of breaking changes, no security impact |
| 146 | v1 API route fragmentation | Feature work (24 new endpoints), not remediation |
| 147 | Circular dependency chains | Known-safe cycles per MEMORY.md, needs `madge` tooling |
| 148 | Dead code removal (~1900 lines) | Large scope, easy to introduce regressions, no security impact |

---

## Implementation Order & Dependencies

```
Batch 1 (P1 — Serial, must be in order):
  1.1 Auth Bypass (135) ──┐
  1.2 Idempotency (136) ──┤ Both touch lightning.ts payout routes
                          │
  1.3 JWT Refresh (137) ──┘ Independent, can parallel with 1.1+1.2

Batch 2 (P2 — Mostly parallel):
  2.1 fsync (138) ────────┐
  2.3 Async I/O (140) ────┘ Same doWrite methods, must be sequential

  2.2 Cache Stampede (139)     }
  2.4 Middleware Order (141)   } All independent,
  2.5 EventEmitter Leak (142)  } can be done in
  2.6 NOSTR Replay (143)      } parallel
  2.7 Rollback Retry (144)    }

Batch 3 (P3 — Only one item):
  3.1 z.any() Validators (149) — Independent, low risk
```

**Recommended execution**:
1. Fix 1.1 + 1.3 in parallel
2. Fix 1.2 after 1.1 (shares lightning.ts)
3. All P2 fixes can start after P1 completes (or in parallel if separate agent)
4. Fix 2.1 before 2.3 (same methods)
5. Fix 3.1 anytime

---

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Fix 1.2 (idempotency) introduces TTLCache dependency | TTLCache already used in lightning-service.ts — proven pattern |
| Fix 1.3 (JWT refresh) adds DB dependency to nostr-auth.ts | Use constructor injection for testability |
| Fix 2.3 (async I/O) changes persistence semantics | Write mutex already serializes; startup reads remain sync |
| Fix 2.4 (body limit) could break large content publishing | Content validator limits to 1M chars (~1MB), well within 1mb limit |
| Multiple P2 fixes touch same services | Each fix targets distinct methods; merge conflicts unlikely |

---

## Files Changed Per Fix (Summary)

| Fix | Files | Lines Changed (est.) |
|-----|-------|---------------------|
| 1.1 Auth Bypass | lightning.ts | ~6 |
| 1.2 Idempotency | lightning.ts, payout-management-service.ts | ~30 |
| 1.3 JWT Refresh | nostr-auth.ts | ~20 |
| 2.1 fsync | payment-persistence.ts, receipt-service.ts | ~15 per file |
| 2.2 Cache Stampede | lightning-service.ts | ~25 |
| 2.3 Async I/O | payment-persistence.ts, receipt-service.ts | ~20 per file |
| 2.4 Middleware | app.ts | ~3 |
| 2.5 EventEmitter | subscription-management-service.ts, payout-management-service.ts | ~15 per file |
| 2.6 NOSTR Replay | nostr-auth.ts | ~15 |
| 2.7 Rollback Retry | subscription-management-service.ts | ~40 |
| 3.1 z.any() | validators/content/index.ts | ~10 |
| **Total** | **~11 files** | **~230 lines** |
