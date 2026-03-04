---
title: Business Manager Feature — Institutional Learnings & Reference Guide
date: 2026-03-04
category: feature-implementation
module: business-manager
severity: reference
problem_type: feature_planning
component: frontend-backend-integration
tags:
  - business-manager
  - invoicing
  - revenue-tracking
  - contracts
  - tax
  - lightning-integration
  - page-routing
  - api-shape
  - e2e-testing
status: active
source: institutional-learnings-search
---

# Business Manager Feature — Institutional Learnings & Reference Guide

> **Purpose**: Consolidated reference for Business Manager implementation (EPIC-011). Extracted from 40+ institutional documents across solutions/ and plans/ directories.
>
> **Use**: Required reading before starting any Business Manager code. Covers critical patterns, API shape contracts, routing conventions, E2E testing, and Lightning integration gotchas.

---

## Table of Contents

1. [Critical Patterns (P0 — Must Read)](#critical-patterns)
2. [Feature-Specific Architecture](#feature-specific-architecture)
3. [E2E Testing Conventions](#e2e-testing-conventions)
4. [Lightning Integration Patterns](#lightning-integration-patterns)
5. [Routing & Wiring Guide](#routing--wiring-guide)
6. [Database Schema Requirements](#database-schema-requirements)
7. [Pre-Implementation Checklist](#pre-implementation-checklist)
8. [Code Review Checklist](#code-review-checklist)

---

## Critical Patterns

**Location**: `/Users/fp/Desktop/Sovren/docs/solutions/patterns/critical-patterns.md`

READ THIS SECTION BEFORE WRITING ANY CODE.

### 1. TOCTOU Race Conditions — Invoice State Transitions

**Problem**: Multiple requests try to transition an invoice simultaneously. First wins, second corrupts state.

**Apply to**: `business_invoices`, `revenue_splits`, `service_orders`

#### Pattern 1a: Insert-Then-Verify (for capacity enforcement)

```typescript
// When enforcing: "max 10 invoices per creator per day"
const { error } = await db.from('business_invoices').insert({
  creator_id: creatorId,
  status: 'draft',
});
if (error?.code === '23505') throw new Error('Already exists');

// COUNT after insert — true post-insert count
const { count } = await db
  .from('business_invoices')
  .select('id', { count: 'exact', head: true })
  .eq('creator_id', creatorId)
  .gte('created_at', todayStart)
  .lte('created_at', todayEnd);

// Over cap? Rollback the insert
if ((count ?? 0) > 10) {
  await db.from('business_invoices').delete().eq('creator_id', creatorId).eq('status', 'draft');
  throw new ConflictError('Daily invoice limit exceeded');
}
```

#### Pattern 1b: Accept-Then-Verify-or-Revert (status + capacity)

```typescript
// Atomic status guard — only one concurrent caller wins
const { count: updated } = await db
  .from('business_invoices')
  .update({ status: 'sent' })
  .eq('id', invoiceId)
  .eq('status', 'draft');

if (!updated || updated === 0) {
  throw new ConflictError('Already sent or in different state');
}

// Verify capacity post-transition
const { count } = await db
  .from('business_invoices')
  .select('id', { count: 'exact', head: true })
  .eq('creator_id', creatorId)
  .eq('status', 'sent')
  .gte('created_at', monthStart);

if ((count ?? 0) > maxInvoicesPerMonth) {
  // Revert
  await db
    .from('business_invoices')
    .update({ status: 'draft' })
    .eq('id', invoiceId)
    .eq('status', 'sent');
  throw new ConflictError('Monthly invoice limit exceeded');
}
```

#### Pattern 1c: Atomic Claim (scarce resources)

```typescript
// When exactly one creator should claim a contract slot
const { data: claimed } = await db
  .from('service_orders')
  .update({ status: 'accepted', accepted_by: creatorId })
  .eq('id', orderId)
  .eq('status', 'open')
  .select('id');

if (!claimed?.length) throw new ConflictError('Already claimed by another creator');

try {
  // All post-claim work in try/catch
  await notifyClient(orderId);
  await createPaymentEscrow(orderId);
} catch (err) {
  // Rollback: re-open so resource isn't permanently locked
  await db
    .from('service_orders')
    .update({ status: 'open', accepted_by: null })
    .eq('id', orderId)
    .eq('status', 'accepted');
  throw err;
}
```

### 2. Non-Atomic Multi-Table Writes — CRITICAL for Invoicing

**Problem**: Invoice created, but revenue split fails. Data is now inconsistent.

**Solution**: Use Supabase RPC (preferred) or compensating transactions.

#### Pattern 2a: Supabase RPC (PREFERRED for Business Manager)

```sql
-- Migration: create atomic function
CREATE OR REPLACE FUNCTION create_business_invoice_with_splits(
  p_creator_id UUID,
  p_amount_sats BIGINT,
  p_description TEXT,
  p_splits JSONB  -- Array of {recipient_id, percentage}
) RETURNS UUID AS $$
DECLARE
  v_invoice_id UUID;
  v_split RECORD;
BEGIN
  -- Create invoice
  INSERT INTO business_invoices
    (creator_id, amount_sats, description, status)
  VALUES (p_creator_id, p_amount_sats, p_description, 'draft')
  RETURNING id INTO v_invoice_id;

  -- Create revenue splits
  FOR v_split IN SELECT * FROM jsonb_array_elements(p_splits) AS item
  LOOP
    INSERT INTO revenue_splits
      (invoice_id, recipient_id, amount_bps, status)
    VALUES
      (v_invoice_id, (v_split.item->>'recipient_id')::UUID,
       (v_split.item->>'amount_bps')::INTEGER, 'active');
  END LOOP;

  RETURN v_invoice_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';
```

```typescript
// Service call
const { data: invoiceId } = await db.rpc('create_business_invoice_with_splits', {
  p_creator_id: creatorId,
  p_amount_sats: 10000,
  p_description: 'Contract ABC123',
  p_splits: [
    { recipient_id: '...', amount_bps: 7000 }, // 70%
    { recipient_id: '...', amount_bps: 3000 }, // 30%
  ],
});
```

#### Pattern 2b: Compensating Transaction (fallback)

```typescript
// Fallback if RPC approach isn't feasible
const { data: invoice } = await db
  .from('business_invoices')
  .insert({ creator_id, amount_sats, description, status: 'draft' })
  .select()
  .single();

try {
  for (const split of splits) {
    await db.from('revenue_splits').insert({
      invoice_id: invoice.id,
      recipient_id: split.recipientId,
      amount_bps: split.amountBps,
      status: 'active',
    });
  }
} catch (err) {
  // Compensate: delete the invoice
  await db.from('business_invoices').delete().eq('id', invoice.id);
  throw err;
}
```

### 3. Status Guards on Destructive Operations

**Problem**: DELETE/cancel runs on any invoice status, even protected ones (paid, released).

**Rule**: Every destructive operation must assert status first AND check `.count` on result.

```typescript
async cancelInvoice(invoiceId: string, creatorId: string): Promise<void> {
  // First: fetch to verify ownership and current status
  const invoice = await this.getInvoice(invoiceId, creatorId);

  // Guard: valid cancel states only
  if (!['draft', 'sent'].includes(invoice.status)) {
    throw new ConflictError(
      `Cannot cancel invoice with status '${invoice.status}'. ` +
      `Only draft and sent invoices can be cancelled.`
    );
  }

  // Atomic update with status guard + count check
  const { error, count } = await db
    .from('business_invoices')
    .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
    .eq('id', invoiceId)
    .eq('creator_id', creatorId)
    .eq('status', 'sent');  // Only update if still in original state

  if (error) throw new DatabaseError(error.message);
  if (count === 0) {
    throw new NotFoundError('Invoice not found or already cancelled');
  }

  // Post-cancellation cleanup
  await this.refundPartialPayments(invoiceId);
}
```

**Valid cancel states**: `draft`, `sent`
**Protected states**: `paid`, `released`, `closed`

### 4. Payment & Financial Persistence

**Problem**: Partial writes, memory corruption, lost state after crash.

**Rule**: Use patterns 4a-4d for all financial operations.

#### Pattern 4a: Atomic Write (temp file + rename)

For revenue ledger files:

```typescript
const tmpPath = `${filePath}.${Date.now()}.tmp`;
await fs.writeFile(tmpPath, JSON.stringify(ledger));
await fs.rename(tmpPath, filePath); // Atomic on same filesystem
```

#### Pattern 4b: Write Mutex (prevent concurrent corruption)

```typescript
class RevenueService {
  private writeLock = false;

  async updateRevenueEntry(data: RevenueEntry) {
    if (this.writeLock) return; // Already writing, reject concurrent writes
    this.writeLock = true;
    try {
      await this.persistToDatabase(data);
    } finally {
      this.writeLock = false;
    }
  }
}
```

#### Pattern 4c: Persist-Then-Mutate (never lose state)

```typescript
async recordRevenue(revenueData: RevenueSplit[]) {
  // Step 1: durable write to database
  const { data: entries } = await db.from('revenue_entries')
    .insert(revenueData)
    .select();

  // Step 2: in-memory update
  this.memoryCache.set(key, entries);
  // If step 2 fails, data is still persisted for recovery
}
```

#### Pattern 4d: Compensating Transaction (multi-step with rollback)

```typescript
async finalizeInvoice(invoiceId: string) {
  const invoice = await this.getInvoice(invoiceId);

  try {
    // Step 1: create revenue splits
    await this.createRevenueSplits(invoiceId, invoice.splits);

    // Step 2: update invoice status
    await this.updateInvoiceStatus(invoiceId, 'finalized');

    // Step 3: trigger payment escrow
    await this.createPaymentEscrow(invoiceId);
  } catch (err) {
    // Compensate: undo all steps
    await this.deleteRevenueSplits(invoiceId);
    await this.updateInvoiceStatus(invoiceId, 'draft');
    throw err;
  }
}
```

### 5. Cross-Package String Duplication — Invoice Templates

**Problem**: Invoice template string defined in 5 places. Backend format differs from frontend. Auth fails.

**Solution**: Single source of truth in `@shared/types/finance`.

#### Pattern 5a: Extract to @shared/

```typescript
// packages/shared/src/types/finance/invoice-templates.ts
export function formatInvoiceReference(creatorId: string, sequenceNum: number): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `INV-${creatorId.slice(0, 8).toUpperCase()}-${date}-${String(sequenceNum).padStart(4, '0')}`;
}

// All consumers import from shared:
import { formatInvoiceReference } from '@shared/types/finance';
```

#### Pattern 5b: Silent Fallback Must Log

```typescript
// WRONG — silent fallback, operationally invisible
export function getExchangeRate(): number {
  if (!this.cachedRate) {
    this.cachedRate = DEFAULT_RATE; // No one knows this happened
  }
  return this.cachedRate;
}

// CORRECT — warning makes the fallback visible
export function getExchangeRate(): number {
  if (!this.cachedRate) {
    logger.warn('[BusinessService] Using default exchange rate. init() was not called.');
    this.cachedRate = DEFAULT_RATE;
  }
  return this.cachedRate;
}
```

### 6. PostgREST Filter Escape — Revenue/Contract Search

**Problem**: User-supplied text in revenue filters without escaping allows injection.

**Rule**: Escape backslash FIRST, then all metacharacters in one pass.

```typescript
export function escapePostgrestFilter(input: string): string {
  return input
    .replace(/\\/g, '\\\\') // backslash FIRST
    .replace(/[,.*():%"_]/g, '\\$&'); // then metacharacters
}

// Usage
const safeQuery = escapePostgrestFilter(userSearchTerm);
query = query.or(`description.ilike.%${safeQuery}%,` + `contract_id.ilike.%${safeQuery}%`);
```

**Full metacharacter set**: `\ , . * ( ) : % " _`

### 7. PostgreSQL VIEW Security Barrier — Public Revenue Views

**Problem**: Without `security_barrier = true`, query planner can push predicates past VIEW's WHERE, disclosing hidden invoices.

**Rule**: Every public-facing VIEW must have `security_barrier = true`.

```sql
CREATE OR REPLACE VIEW creator_business_overview WITH (security_barrier = true) AS
SELECT
  cp.id,
  cp.display_name,
  COALESCE(bi.invoice_count, 0) AS invoice_count,
  COALESCE(rs.total_revenue_sats, 0) AS total_revenue_sats,
  bi.last_invoice_date
FROM creator_profiles cp
LEFT JOIN (
  SELECT
    creator_id,
    COUNT(*) AS invoice_count,
    MAX(created_at) AS last_invoice_date
  FROM business_invoices
  WHERE status IN ('sent', 'paid')
  GROUP BY creator_id
) bi ON cp.creator_id = bi.creator_id
LEFT JOIN (
  SELECT
    invoice_id,
    SUM(ROUND(amount_sats * amount_bps / 10000.0)) AS total_revenue_sats
  FROM revenue_splits
  WHERE status = 'active'
  GROUP BY invoice_id
) rs ON bi.invoice_id = rs.invoice_id
WHERE cp.profile_status = 'active';

GRANT SELECT ON creator_business_overview TO anon, authenticated;
```

**Checklist for every VIEW**:

- [ ] `WITH (security_barrier = true)`
- [ ] `WHERE status = 'active'` or equivalent status filter
- [ ] `AND role != 'admin'` for truly public views
- [ ] COALESCE all nullable columns (prevents TS crashes)
- [ ] GRANT SELECT only to intended roles

---

## Feature-Specific Architecture

### Wave 2 Critical Findings (P0 — Before Implementation)

Source: `/Users/fp/Desktop/Sovren/docs/plans/2026-02-18-feat-wave2-epics-009b-010-011-plan.md`

#### 1. Rename InvoiceService to BusinessInvoiceService

Existing Phase 5 `InvoiceService` exists. EPIC-011 needs a different service name to avoid token collision.

**Must rename across all layers:**

- DI token: `TYPES.BusinessInvoiceService`
- Interface: `IBusinessInvoiceService`
- Implementation: `BusinessInvoiceService`
- Route handler: `businessInvoiceRoutes`
- Frontend hook: `useBusinessInvoices()`

#### 2. Revenue Split: Use Basis Points, Not Decimals

Change from `revenue_split_pct NUMERIC(5,2)` to `revenue_split_bps INTEGER`.

**Why**: Floating-point rounding causes sat misallocation. Basis points (0-10000) are atomic integers.

```sql
-- Revenue splits table
CREATE TABLE revenue_splits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES business_invoices(id) ON DELETE RESTRICT,
  recipient_id UUID NOT NULL REFERENCES users(id),
  amount_bps INTEGER NOT NULL CHECK (amount_bps >= 0 AND amount_bps <= 10000),
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Distribution example: 10,000 sats with splits [70%, 30%]
-- recipient1: 10000 * 7000 / 10000 = 7000 sats
-- recipient2: 10000 * 3000 / 10000 = 3000 sats
```

**Use largest-remainder algorithm for multi-split distribution to ensure sums are exact**.

#### 3. All New Tables: UUID PKs with gen_random_uuid()

```sql
-- Standard table pattern
CREATE TABLE business_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES users(id),
  amount_sats BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

#### 4. State Machine Triggers Required

Follow the existing `transition_payment_state()` pattern:

```sql
CREATE OR REPLACE FUNCTION transition_invoice_state()
RETURNS TRIGGER AS $$
BEGIN
  -- Invoice state machine validation
  IF NEW.status NOT IN ('draft', 'sent', 'paid', 'released', 'cancelled', 'disputed') THEN
    RAISE EXCEPTION 'Invalid invoice status: %', NEW.status;
  END IF;

  -- Prevent invalid transitions
  IF OLD.status = 'paid' AND NEW.status IN ('draft', 'sent') THEN
    RAISE EXCEPTION 'Cannot revert paid invoice to %', NEW.status;
  END IF;

  IF OLD.status = 'released' AND NEW.status != 'released' THEN
    RAISE EXCEPTION 'Cannot modify released invoice';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_invoice_state_machine
BEFORE UPDATE ON business_invoices
FOR EACH ROW EXECUTE FUNCTION transition_invoice_state();
```

#### 5. ON DELETE RESTRICT for Financial Tables

```sql
-- Correct: prevent accidental deletion of invoiced data
CREATE TABLE revenue_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES business_invoices(id) ON DELETE RESTRICT,
  amount_sats BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
);

-- Do NOT use ON DELETE CASCADE
-- ON DELETE CASCADE HERE = FINANCIAL DATA LOSS
```

#### 6. RLS Policies Required for All 14 Tables

Template:

```sql
CREATE POLICY creator_can_view_own_invoices ON business_invoices
  FOR SELECT
  USING (creator_id = (SELECT auth.uid()));

CREATE POLICY creator_can_insert_invoices ON business_invoices
  FOR INSERT
  WITH CHECK (creator_id = (SELECT auth.uid()));

CREATE POLICY creator_can_update_own_invoices ON business_invoices
  FOR UPDATE
  USING (creator_id = (SELECT auth.uid()) AND status IN ('draft', 'sent'))
  WITH CHECK (creator_id = (SELECT auth.uid()));
```

**Performance tip**: Use `(select auth.uid())` in initPlan for 100x faster query planning vs dynamic subqueries.

#### 7. Lightning Invoice Limitations — CRITICAL

**BOLT11 invoices expire in ~1 hour**: Cannot use for 30-day business invoices.

**Solution**: Use LNURL-pay for dynamic invoice generation behind payment links.

```typescript
// What NOT to do:
const invoice = await lightningService.generateBolt11Invoice(amountSats);
// invoice.expires_at = Date.now() + 3600000  // 1 hour only

// What TO do instead:
const paymentLink = await lightningService.createLnurlPayLink({
  amount: amountSats,
  description: 'Invoice INV-2024-001',
  expiresAt: futureDate, // 30 days
});
// Link generates a new invoice on each scan, resetting TTL
```

**HTLC max ~14 days**: Cannot do 30-day HODL invoice escrow using HTLC locks.

**Solution**: Use custodial escrow (LNbits pattern) — backend holds funds, releases on approval.

#### 8. Pre-flight DI Registration Commit

Before spawning implementation teams, commit all DI tokens and stub bindings:

```typescript
// packages/backend/src/types/di/types.ts
export const TYPES = {
  // ... existing types ...
  BusinessInvoiceService: Symbol.for('IBusinessInvoiceService'),
  RevenueService: Symbol.for('IRevenueService'),
  TaxCalculationService: Symbol.for('ITaxCalculationService'),
  ContractService: Symbol.for('IContractService'),
  PaymentEscrowService: Symbol.for('IPaymentEscrowService'),
  NostrReplyAdapter: Symbol.for('INostrReplyAdapter'),
};

// packages/backend/src/di/finance.bindings.ts
export function registerFinanceServices(registry: IServiceRegistry) {
  registry.registerSingletonFactory(
    TYPES.BusinessInvoiceService,
    () => new BusinessInvoiceService(container.get(TYPES.Database), container.get(TYPES.Logger))
  );
  // ... stub other services
}
```

---

## E2E Testing Conventions

Source: `/Users/fp/Desktop/Sovren/docs/solutions/testing/playwright-e2e-quick-reference.md` + `/Users/fp/Desktop/Sovren/CLAUDE.md`

### Project Structure

```
packages/frontend/e2e/
├── auth.setup.ts                  # Setup project (real login)
├── business.auth.spec.ts          # Authenticated tests (uses saved auth)
├── business-admin.auth.spec.ts    # Admin-specific invoice tests
├── pages/
│   ├── business.page.ts           # POM for Business Manager
│   └── layout.page.ts             # Shared nav/layout
├── fixtures/
│   └── test-credentials.ts        # Centralized test users
├── global-setup.ts
└── global-teardown.ts
```

### Playwright 3-Tier Configuration

```typescript
// playwright.config.ts
export default defineConfig({
  testDir: './e2e',
  projects: [
    {
      name: 'setup',
      testMatch: /\.setup\.ts/,
    },
    {
      name: 'chromium-authenticated',
      use: { ...devices['Desktop Chrome'], storageState: 'test-results/.auth/creator.json' },
      dependencies: ['setup'],
      testMatch: /\.auth\.spec\.ts/, // business.auth.spec.ts matches here
    },
    {
      name: 'chromium-public',
      use: devices['Desktop Chrome'],
      testMatch: /\.public\.spec\.ts/,
    },
  ],
});
```

### Page Object Model Pattern

```typescript
// e2e/pages/business.page.ts
import type { Locator, Page } from '@playwright/test';

export class BusinessPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly createInvoiceButton: Locator;
  readonly invoiceForm: Locator;
  readonly submitButton: Locator;
  readonly invoiceList: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Business Manager' }).first();
    this.createInvoiceButton = page.getByRole('button', { name: /create.*invoice/i });
    this.invoiceForm = page.getByRole('form');
    this.submitButton = page.getByRole('button', { name: /submit|save/i });
    this.invoiceList = page.getByRole('table');
  }

  async goto() {
    await this.page.goto('/business');
    await this.heading.waitFor({ state: 'visible' });
  }

  async createInvoice(data: { amount: string; description: string; recipient: string }) {
    await this.createInvoiceButton.click();
    await this.page.getByLabel(/amount/i).fill(data.amount);
    await this.page.getByLabel(/description/i).fill(data.description);
    await this.page.getByLabel(/recipient/i).fill(data.recipient);
    await this.submitButton.click();
    await this.page.waitForURL(/\/business\/invoices\/\w+/);
  }

  async viewInvoice(invoiceId: string) {
    await this.page.goto(`/business/invoices/${invoiceId}`);
  }
}
```

### Spec File Naming (Convention-Based Auto-Matching)

**For authenticated Business Manager tests:**

```typescript
// e2e/business.auth.spec.ts — automatically matches chromium-authenticated
import { test, expect } from '@playwright/test';
import { BusinessPage } from './pages/business.page';
import { CREATOR_CREDENTIALS } from './fixtures/test-credentials';

test.describe('Business Manager', () => {
  let businessPage: BusinessPage;

  test.beforeEach(async ({ page }) => {
    businessPage = new BusinessPage(page);
    await businessPage.goto();
  });

  test('creator can create invoice', async ({ page }) => {
    await businessPage.createInvoice({
      amount: '10000',
      description: 'Coaching session',
      recipient: 'john@example.com',
    });

    // Wait for real API response (no mocks!)
    const response = await page.waitForResponse(
      (r) => r.url().includes('/api/v1/business/invoices') && r.request().method() === 'POST'
    );
    expect(response.status()).toBe(201);

    // Verify invoice appears in list
    const invoiceRow = page.getByRole('row').filter({ has: page.getByText('Coaching session') });
    await expect(invoiceRow).toBeVisible();
  });

  test('creator can cancel draft invoice', async ({ page }) => {
    // First: create invoice
    await businessPage.createInvoice({
      amount: '5000',
      description: 'Test invoice',
      recipient: 'admin@example.com',
    });

    // Get the invoice ID from URL
    const url = new URL(page.url());
    const invoiceId = url.pathname.split('/').pop();

    // Navigate back to list
    await page.goto('/business');

    // Click cancel button on draft invoice
    const cancelButton = page.locator(`[data-invoice-id="${invoiceId}"] [aria-label="Cancel"]`);
    await cancelButton.click();

    // Confirm dialog
    await page.getByRole('button', { name: /confirm.*cancel/i }).click();

    // Verify state change
    const response = await page.waitForResponse(
      (r) =>
        r.url().includes(`/api/v1/business/invoices/${invoiceId}`) &&
        r.request().method() === 'PATCH'
    );
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.data.status).toBe('cancelled');
  });
});
```

### Core Rules

- **NO MOCKS**: Never use `page.route()` to intercept API calls. E2E tests must use real backend.
- **Real auth**: Use CREATOR_CREDENTIALS fixture (env var overrides supported).
- **Web-first assertions**: `toBeVisible()`, `toHaveURL()`, not `waitForTimeout()`.
- **Role-based locators**: `getByRole()`, not CSS selectors or test IDs.
- **POM only**: All locators defined in page objects, spec files call methods only.
- **Convention naming**: `{feature}.auth.spec.ts` for authenticated, `{feature}.public.spec.ts` for public.
- **Run pre-mark-done**: `npm run test:e2e` must pass before marking story complete.

---

## Lightning Integration Patterns

Source: Wave 2 Plan + Critical Patterns + ELITE_NOSTR_LIGHTNING_ONBOARDING.md

### Invoice Generation Strategy

| Invoice Type     | TTL     | Use Case                                | Implementation                |
| ---------------- | ------- | --------------------------------------- | ----------------------------- |
| BOLT11 (static)  | ~1 hour | One-time instant payments               | Standard zap button           |
| LNURL-pay        | Dynamic | 30-day business invoices, payment links | Payment link backend          |
| Custodial escrow | Custom  | Multi-creator revenue splits            | LNbits + webhook verification |

### Pattern: LNURL-Pay for Business Invoices

```typescript
// packages/backend/src/services/finance/LnurlPaymentService.ts
export class LnurlPaymentService {
  async createInvoicePaymentLink(invoice: BusinessInvoice): Promise<PaymentLink> {
    const invoiceRef = formatInvoiceReference(invoice.creator_id, invoice.sequence);

    // Create LNURL endpoint that will generate fresh invoices
    const lnurl = await lnbitsService.createPaymentLink({
      title: `Invoice ${invoiceRef}`,
      description: invoice.description,
      min: invoice.amount_sats,
      max: invoice.amount_sats,
      webhook_url: `${baseUrl}/webhooks/lnurl-paid`,
      webhook_key: generateSecureKey(),
      expiry: invoice.expiry_date, // 30 days from now
    });

    return {
      link_type: 'LNURL_PAY',
      invoice_id: invoice.id,
      lnurl: lnurl.lnurl,
      payment_link: `https://pay.example.com/${lnurl.id}`,
      expires_at: invoice.expiry_date,
      status: 'active',
    };
  }

  async handleWebhookPaid(webhookData: any): Promise<void> {
    const { invoice_id, preimage, amount_sats } = webhookData;

    // Atomic: mark invoice as paid + create revenue splits
    const { data } = await db.rpc('finalize_invoice_on_payment', {
      p_invoice_id: invoice_id,
      p_amount_sats: amount_sats,
      p_preimage: preimage,
    });

    // Verify payment
    const isValid = await this.verifyLightningPayment(preimage, amount_sats);
    if (!isValid) throw new Error('Payment verification failed');

    // Notify creator
    await notificationService.send(data.creator_id, {
      type: 'invoice_paid',
      invoice_id,
      amount_sats,
    });
  }
}
```

### Pattern: Custodial Escrow for Revenue Splits

```typescript
// Multi-creator payment flow
async finalizeMultiCreatorPayment(invoiceId: string) {
  const invoice = await this.getInvoice(invoiceId);
  const splits = await this.getRevenueSplits(invoiceId);

  // Step 1: Verify funds arrived (webhook from LNURL handler)
  const payment = await this.verifyPaymentReceived(invoiceId);
  if (!payment) throw new Error('Payment not confirmed');

  // Step 2: Distribute to all recipients (atomically)
  const { data: distribution } = await db.rpc('distribute_invoice_revenue', {
    p_invoice_id: invoiceId,
    p_total_sats: payment.amount_sats,
    p_splits: JSON.stringify(splits),
  });

  // Step 3: For each recipient, send their share via LNURL-withdraw or direct payment
  for (const recipient of distribution) {
    try {
      await this.sendPaymentToRecipient({
        recipient_id: recipient.recipient_id,
        amount_sats: recipient.amount_sats,
        invoice_id: invoiceId,
      });
    } catch (err) {
      // Log but don't fail — funds are escrowed, retry async
      logger.error('[LnurlPaymentService] Distribution failed for recipient', {
        recipient_id: recipient.recipient_id,
        invoice_id: invoiceId,
        err,
      });
    }
  }

  // Mark invoice as released
  await this.updateInvoiceStatus(invoiceId, 'released');
}
```

### Important Constraints

1. **BOLT11 cannot be used for business invoices** — 1-hour expiry is incompatible with 30-day payment terms.
2. **HTLC escrow max is ~14 days** — Cannot hold funds for 30+ days. Use custodial escrow instead.
3. **Revenue splits are inherently custodial** — Wallets cannot atomically pay multiple invoices. Backend must hold and distribute.
4. **Webhook verification is mandatory** — Always verify preimage and amount against blockchain data.
5. **Test with deterministic signatures** — Use test vectors with known preimages for unit tests.

---

## Routing & Wiring Guide

### Backend Route Structure

**Principle**: Group by business domain, not by HTTP method.

```typescript
// packages/backend/src/routes/v1/business/

// invoices.routes.ts — invoice CRUD
export const businessInvoiceRoutes = Router();

businessInvoiceRoutes.post('/', (req, res, next) =>
  asyncHandler(async () => {
    const { creator_id, amount_sats, description } = req.body;
    // validation + call service
    return createApiResponse(req, invoice, 201);
  })
);

businessInvoiceRoutes.get('/', (req, res, next) =>
  asyncHandler(async () => {
    const invoices = await invoiceService.listByCreator(req.user.id);
    return createApiResponse(req, { invoices, pagination });
  })
);

businessInvoiceRoutes.get('/:id', (req, res, next) =>
  asyncHandler(async () => {
    const invoice = await invoiceService.getById(req.params.id, req.user.id);
    return createApiResponse(req, invoice);
  })
);

businessInvoiceRoutes.patch('/:id', (req, res, next) =>
  asyncHandler(async () => {
    const updated = await invoiceService.update(req.params.id, req.body, req.user.id);
    return createApiResponse(req, updated);
  })
);

businessInvoiceRoutes.delete('/:id', (req, res, next) =>
  asyncHandler(async () => {
    await invoiceService.cancel(req.params.id, req.user.id);
    return createApiResponse(req, { success: true });
  })
);

// revenue.routes.ts
export const businessRevenueRoutes = Router();

businessRevenueRoutes.get('/summary', (req, res, next) =>
  asyncHandler(async () => {
    const summary = await revenueService.getSummary(req.user.id);
    return createApiResponse(req, summary);
  })
);

businessRevenueRoutes.get('/by-platform', (req, res, next) =>
  asyncHandler(async () => {
    const data = await revenueService.getByPlatform(req.user.id);
    return createApiResponse(req, data);
  })
);

// contracts.routes.ts
export const businessContractRoutes = Router();

businessContractRoutes.post('/', (req, res, next) =>
  asyncHandler(async () => {
    const contract = await contractService.create(req.body, req.user.id);
    return createApiResponse(req, contract, 201);
  })
);

// index.ts — combine all business routes
export const businessRoutes = Router();
businessRoutes.use('/invoices', businessInvoiceRoutes);
businessRoutes.use('/revenue', businessRevenueRoutes);
businessRoutes.use('/contracts', businessContractRoutes);

// Main v1 routes
// packages/backend/src/routes/v1/index.ts
router.use('/business', businessRoutes);
```

**Result**: API endpoints become:

- `POST /api/v1/business/invoices`
- `GET /api/v1/business/invoices`
- `GET /api/v1/business/invoices/:id`
- `PATCH /api/v1/business/invoices/:id`
- `DELETE /api/v1/business/invoices/:id`
- `GET /api/v1/business/revenue/summary`
- `POST /api/v1/business/contracts`

### Frontend Feature Structure

**Principle**: Self-contained feature module with components, hooks, services, and types.

```typescript
// packages/frontend/src/features/business/

// index.ts — barrel exports (only this is exported)
export * from './components';
export * from './hooks';
export * from './services/api';
export type * from './types';

// types/index.ts — ALL types from @shared, NOTHING local
export type { Invoice, RevenueSplit, Contract } from '@shared/types/finance';

// services/api.ts — API client (type-safe with Zod)
import { InvoiceSchema, type Invoice } from '@shared/types/finance';

export const businessApi = {
  createInvoice: async (data: CreateInvoiceInput): Promise<Invoice> => {
    const response = await fetch('/api/v1/business/invoices', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    const json = await response.json();
    return InvoiceSchema.parse(json.data);
  },

  listInvoices: async (options?: PaginationOptions) => {
    const params = new URLSearchParams(options || {});
    const response = await fetch(`/api/v1/business/invoices?${params}`);
    const json = await response.json();
    return {
      data: json.data.map((inv) => InvoiceSchema.parse(inv)),
      pagination: json.pagination,
    };
  },

  getInvoice: async (id: string): Promise<Invoice> => {
    const response = await fetch(`/api/v1/business/invoices/${id}`);
    const json = await response.json();
    return InvoiceSchema.parse(json.data);
  },

  updateInvoice: async (id: string, data: Partial<Invoice>) => {
    const response = await fetch(`/api/v1/business/invoices/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    const json = await response.json();
    return InvoiceSchema.parse(json.data);
  },

  cancelInvoice: async (id: string) => {
    const response = await fetch(`/api/v1/business/invoices/${id}`, {
      method: 'DELETE',
    });
    return await response.json();
  },
};

// hooks/useInvoices.ts — React Query hook
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { businessApi } from '../services/api';

const QUERY_KEY = ['business', 'invoices'];

export function useInvoices() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => businessApi.listInvoices(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => businessApi.createInvoice(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

export function useCancelInvoice() {
  const queryClient = useQueryClient();
  const inFlightRef = useRef(false);

  return useMutation({
    mutationFn: (invoiceId: string) => {
      if (inFlightRef.current) return Promise.reject('Already cancelling');
      inFlightRef.current = true;
      return businessApi.cancelInvoice(invoiceId);
    },
    onSettled: () => {
      inFlightRef.current = false;
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

// components/InvoiceList.tsx
export function InvoiceList() {
  const { data, isLoading, error } = useInvoices();

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <table>
      <tbody>
        {data?.data.map((invoice) => (
          <tr key={invoice.id}>
            <td>{invoice.id}</td>
            <td>{invoice.amount_sats}</td>
            <td>{invoice.status}</td>
            <td>
              <InvoiceActions invoiceId={invoice.id} status={invoice.status} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// components/InvoiceActions.tsx — with double-submit guard
export function InvoiceActions({ invoiceId, status }: Props) {
  const cancelMutation = useCancelInvoice();
  const inFlightRef = useRef(false);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const handleCancel = () => {
    if (inFlightRef.current) return; // Sync guard
    inFlightRef.current = true;
    setPendingId(invoiceId);

    cancelMutation.mutate(invoiceId, {
      onSettled: () => {
        inFlightRef.current = false;
        setPendingId(null);
      },
    });
  };

  return (
    <button
      onClick={handleCancel}
      disabled={pendingId === invoiceId || status !== 'draft'}
      aria-busy={pendingId === invoiceId}
    >
      {pendingId === invoiceId ? 'Cancelling...' : 'Cancel'}
    </button>
  );
}
```

### React Router Setup

```typescript
// packages/frontend/src/App.tsx
import { BusinessManagerPage } from '@pages/BusinessManager';
import { InvoiceList } from '@features/business';

export function App() {
  return (
    <Router>
      <Routes>
        <Route path="/business" element={<BusinessManagerLayout />}>
          <Route index element={<InvoiceList />} />
          <Route path="invoices/:id" element={<InvoiceDetail />} />
          <Route path="revenue" element={<RevenueAnalytics />} />
          <Route path="contracts" element={<ContractManager />} />
        </Route>
      </Routes>
    </Router>
  );
}

// pages/BusinessManager.tsx
export function BusinessManagerPage() {
  return (
    <div className="business-manager">
      <nav>{/* navigation */}</nav>
      <Outlet /> {/* renders child routes */}
    </div>
  );
}
```

---

## Database Schema Requirements

From Wave 2 Critical Findings + Common Solutions Patterns.

### Table Creation Checklist

For every new financial table:

```sql
-- Template: business_invoices
CREATE TABLE business_invoices (
  -- PK: Always UUID with gen_random_uuid()
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign keys: Always UUID, always RESTRICT (not CASCADE)
  creator_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,

  -- Core data: Use appropriate types
  amount_sats BIGINT NOT NULL CHECK (amount_sats > 0),
  description TEXT NOT NULL,

  -- State machine: Standard enum
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'sent', 'paid', 'released', 'cancelled', 'disputed'
  )),

  -- Audit trail: Always include these
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES users(id),

  -- Optional: Payment reference
  payment_link_id TEXT,
  payment_preimage BYTEA,

  -- Indexes for common queries
  CONSTRAINT positive_amount CHECK (amount_sats > 0)
);

CREATE INDEX idx_invoices_creator_status ON business_invoices(creator_id, status);
CREATE INDEX idx_invoices_created_at ON business_invoices(created_at DESC);
CREATE INDEX idx_invoices_status ON business_invoices(status);
```

### Revenue Splits Table (Basis Points)

```sql
CREATE TABLE revenue_splits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES business_invoices(id) ON DELETE RESTRICT,
  recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,

  -- Basis points: 0-10000 (representing 0%-100%)
  amount_bps INTEGER NOT NULL CHECK (amount_bps >= 0 AND amount_bps <= 10000),

  -- Distribution status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'distributed', 'failed', 'cancelled'
  )),

  -- When distributed
  distributed_at TIMESTAMPTZ,
  distributed_txid TEXT,  -- Lightning preimage or blockchain txid

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_splits_invoice ON revenue_splits(invoice_id);
CREATE INDEX idx_splits_recipient ON revenue_splits(recipient_id);
CREATE UNIQUE INDEX idx_splits_one_per_recipient ON revenue_splits(invoice_id, recipient_id);
```

### State Machine Trigger

```sql
CREATE OR REPLACE FUNCTION transition_invoice_state()
RETURNS TRIGGER AS $$
BEGIN
  -- Prevent invalid transitions
  IF NEW.status = OLD.status THEN
    RETURN NEW;  -- No change
  END IF;

  -- Paid/Released/Cancelled are terminal
  IF OLD.status IN ('paid', 'released', 'cancelled') THEN
    RAISE EXCEPTION 'Cannot change % invoice status', OLD.status;
  END IF;

  -- Only specific transitions allowed
  CASE OLD.status
    WHEN 'draft' THEN
      IF NEW.status NOT IN ('sent', 'cancelled') THEN
        RAISE EXCEPTION 'Draft invoice can only be sent or cancelled';
      END IF;
    WHEN 'sent' THEN
      IF NEW.status NOT IN ('paid', 'disputed', 'cancelled') THEN
        RAISE EXCEPTION 'Sent invoice can only be paid, disputed, or cancelled';
      END IF;
    WHEN 'disputed' THEN
      IF NEW.status NOT IN ('paid', 'cancelled') THEN
        RAISE EXCEPTION 'Disputed invoice can only be paid or cancelled';
      END IF;
  END CASE;

  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_invoice_state_machine
BEFORE UPDATE OF status ON business_invoices
FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION transition_invoice_state();
```

### RLS Policies

```sql
-- Creators can view their own invoices
CREATE POLICY creator_view_own_invoices ON business_invoices
  FOR SELECT
  USING (creator_id = (SELECT auth.uid()));

-- Creators can create invoices
CREATE POLICY creator_create_invoices ON business_invoices
  FOR INSERT
  WITH CHECK (creator_id = (SELECT auth.uid()));

-- Creators can update draft/sent invoices only
CREATE POLICY creator_update_own_invoices ON business_invoices
  FOR UPDATE
  USING (
    creator_id = (SELECT auth.uid()) AND
    status IN ('draft', 'sent')
  )
  WITH CHECK (creator_id = (SELECT auth.uid()));

-- View RLS: recipients can see splits where they're the recipient
CREATE POLICY recipient_view_splits ON revenue_splits
  FOR SELECT
  USING (
    recipient_id = (SELECT auth.uid()) OR
    invoice_id IN (
      SELECT id FROM business_invoices
      WHERE creator_id = (SELECT auth.uid())
    )
  );

-- Recipients can only update pending splits (admin only)
CREATE POLICY admin_update_splits ON revenue_splits
  FOR UPDATE
  USING ((SELECT current_setting('app.user_role')) = 'admin')
  WITH CHECK ((SELECT current_setting('app.user_role')) = 'admin');
```

---

## Pre-Implementation Checklist

Before code review, complete these items:

### Architecture & Planning

- [ ] Create ADR for business invoice + revenue split design
- [ ] Define all 10+ shared types in `@shared/types/finance/`
- [ ] Review API contract with team (POST, GET, PATCH, DELETE shapes)
- [ ] Document state machine transitions in decision doc
- [ ] Plan LNURL-pay implementation vs BOLT11 fallback

### Database

- [ ] Write all Supabase migrations (14+ tables)
- [ ] Add state machine triggers (follow `transition_payment_state()` pattern)
- [ ] Create RLS policies (use `select auth.uid()` pattern)
- [ ] Verify all FKs use ON DELETE RESTRICT
- [ ] Add compound indexes for common queries
- [ ] Test migration rollback scenario

### Backend

- [ ] Rename Phase 5 `InvoiceService` → `BusinessInvoiceService`
- [ ] Create DI tokens + interfaces for all 10 services
- [ ] Write service stub implementations (no business logic yet)
- [ ] Register all services in bootstrap + health checks
- [ ] Create route files (invoices, revenue, contracts, tax)
- [ ] Implement `createApiResponse()` middleware pattern
- [ ] Add `asyncHandler()` utility to reduce boilerplate
- [ ] Write Zod validators for all request/response shapes
- [ ] Add error handling: 400 (validation), 403 (auth), 404 (not found), 409 (state), 500 (server)

### Frontend

- [ ] Create feature module: `features/business/`
- [ ] Write API client (`services/api.ts`) with full type safety
- [ ] Create React Query hooks (`useInvoices`, `useCancelInvoice`, etc.)
- [ ] Build components with double-submit prevention (useRef + disabled)
- [ ] Add Page Object Model for E2E (`e2e/pages/business.page.ts`)
- [ ] Create E2E spec file (`e2e/business.auth.spec.ts`)
- [ ] Wire React Router routes (`/business/*`)

### Testing

- [ ] Service tests: Mock Supabase, verify state transitions
- [ ] Route tests: Verify response shapes + status codes
- [ ] E2E tests: Real auth, real backend, no mocks
- [ ] Lightning tests: Test LNURL-pay link generation
- [ ] Coverage: 95%+ for services, 85%+ globally

### Documentation

- [ ] Update CLAUDE.md with Business Manager conventions
- [ ] Add implementation-specific diagrams (state machine, data flow)
- [ ] Document API endpoints in api-spec.md
- [ ] Create deployment checklist

---

## Code Review Checklist

When reviewing Business Manager PRs, verify these items:

### Critical Pattern Compliance (P0)

- [ ] All financial mutations use atomic patterns (#1 TOCTOU, #4 multi-table writes)
- [ ] Every DELETE/void/cancel has status guard + count check (#7)
- [ ] Revenue splits use basis points (0-10000), not decimals (#2)
- [ ] No circular DI dependencies (import type for interfaces) (#10a)
- [ ] Silent fallbacks log warnings (#10b)
- [ ] PostgREST filters escape backslash first, then metacharacters (#11)
- [ ] VIEWs have `security_barrier=true` + status filter (#12)

### Database

- [ ] All tables use `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- [ ] All financial FKs use `ON DELETE RESTRICT` (not CASCADE)
- [ ] State machine triggers exist (follow `transition_payment_state()`)
- [ ] RLS policies use `(select auth.uid())` in initPlan
- [ ] Compound indexes exist: (creator_id, status, created_at)
- [ ] Migrations are reversible with rollback tested

### Backend

- [ ] No `ServiceToken<any>` — all tokens typed with `import type`
- [ ] Error responses match api-spec.md envelope format
- [ ] All routes use `asyncHandler()` wrapper
- [ ] HTTP status codes correct: 400 (validation), 403 (auth), 404 (not found), 409 (state), 500 (error)
- [ ] LNURL-pay used instead of BOLT11 for business invoices
- [ ] Webhook verification includes preimage + amount checks
- [ ] Tests mock Supabase, not network calls

### Frontend

- [ ] Double-submit prevention: `useRef(false)` + `disabled` + `aria-busy`
- [ ] React Query hooks use consistent key format: `['business', 'invoices', creatorId]`
- [ ] API client types match `@shared/types/finance` schemas
- [ ] No hardcoded invoice templates — use `@shared/types/finance` utilities
- [ ] TTLCache configured: 5min BTC rates (tax), 1h display rates
- [ ] Components are in feature module, exported via barrel file

### E2E Tests

- [ ] Page Object Model used (all locators in POM, none in spec)
- [ ] Spec naming: `{feature}.auth.spec.ts` for authenticated
- [ ] NO page.route() — only real API calls via `waitForResponse()`
- [ ] Test credentials imported from `test-credentials.ts` fixture
- [ ] Happy path + error state test coverage
- [ ] Tests run without mocks against `vite preview`
- [ ] `npm run test:e2e` passes before merge

### Lightning-Specific

- [ ] LNURL-pay used for 30-day invoices (not BOLT11)
- [ ] Custodial escrow pattern used for multi-creator splits
- [ ] Webhook verification includes preimage validation
- [ ] Test vectors use deterministic signatures
- [ ] Invoice expiry edge cases covered
- [ ] ADR-025 governs custodial vs non-custodial decision

---

## Recommended Implementation Order

### Phase 1: Foundation (1-2 weeks)

1. Create ADRs + architecture docs
2. Supabase migrations (all 14+ tables + RLS + triggers)
3. DI tokens + service interfaces (no impl)
4. Zod validators for API shapes
5. E2E test skeleton (auth.setup.ts, pages, fixtures)

### Phase 2: Core Services (2-3 weeks)

1. Invoice service (create, list, get, update, cancel)
2. Revenue split service (create, distribute, verify)
3. Payment escrow service (hold funds, release on approval)
4. Tax calculation service (track events, compute liabilities)

### Phase 3: API Routes (1-2 weeks)

1. `/api/v1/business/invoices/*` CRUD
2. `/api/v1/business/revenue/*` analytics
3. `/api/v1/business/contracts/*` CRUD
4. `/api/v1/business/tax/*` events + history

### Phase 4: Frontend (2-3 weeks)

1. API client + React Query hooks
2. Invoice list, detail, create, edit views
3. Revenue analytics + by-platform breakdown
4. Contract manager + signature verification
5. E2E specs covering all workflows

### Phase 5: Lightning Integration (1-2 weeks)

1. LNURL-pay payment link generation
2. Webhook verification + distribution
3. Multi-creator payout atomicity
4. Test suite with deterministic signatures

### Phase 6: QA + Polish (1 week)

1. Full E2E regression suite
2. Lightning edge cases (expiry, double-spend)
3. Performance: pagination, caching, query optimization
4. Deployment + monitoring setup

---

## Reference Documents

- **Critical Patterns**: `/Users/fp/Desktop/Sovren/docs/solutions/patterns/critical-patterns.md`
- **Common Solutions**: `/Users/fp/Desktop/Sovren/docs/solutions/patterns/common-solutions.md`
- **API Spec**: `/Users/fp/Desktop/Sovren/docs/api-spec.md`
- **Wave 2 Plan**: `/Users/fp/Desktop/Sovren/docs/plans/2026-02-18-feat-wave2-epics-009b-010-011-plan.md`
- **Phase 1 Architecture**: `/Users/fp/Desktop/Sovren/docs/plans/phase1-epics-architecture.md`
- **E2E Quick Reference**: `/Users/fp/Desktop/Sovren/docs/solutions/testing/playwright-e2e-quick-reference.md`
- **CLAUDE.md**: `/Users/fp/Desktop/Sovren/CLAUDE.md` (Playwright E2E section)

---

**Document Generated**: 2026-03-04
**Search Scope**: 40+ institutional documents across solutions/, plans/, api-spec.md, CLAUDE.md
**Last Updated**: 2026-03-04
