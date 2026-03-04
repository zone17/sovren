---
title: 'feat: Business Manager MVP'
type: feat
date: 2026-03-04
squad: A
slice: 5
sprint: S2
branch: feat/squad-a/S2-business-manager-mvp
points: 10
review_round: 1
reviewers: DHH, Kieran (TypeScript), Simplicity
---

# Business Manager MVP — Slice 5

## Overview

Wire the existing Business Manager feature to a routable page. Fix 6 confirmed API contract mismatches. Add one backend endpoint. Write E2E spec.

**~90% of code already exists.** This is a wiring + integration + bug-fix slice.

## Definition of Done (DoD)

| #   | Criterion                                            | Validates                                                                         |
| --- | ---------------------------------------------------- | --------------------------------------------------------------------------------- |
| D1  | Revenue dashboard shows real income breakdown        | RevenueMix renders from `GET /api/v2/business/revenue/breakdown`                  |
| D2  | Invoices can be created with Lightning payment links | InvoiceEditor → create → generate LNURL-pay → QR visible                          |
| D3  | Contract template library browsable                  | ContractLibrary renders templates from `GET /api/v2/business/contracts/templates` |
| D4  | Tax summary shows categorized income                 | TaxSummary renders all 4 quarters from `GET /api/v2/business/tax/summary`         |
| D5  | E2E spec                                             | `business.auth.spec.ts` passes in CI                                              |

## Architecture Decisions (post-review)

| Decision                      | Choice                                                                                 | Rationale                                                                                                                                                                        |
| ----------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tax summary data model        | **Backend returns all 4 quarters** via new `GET /summary?year=2026` (no quarter param) | DHH: "4 parallel queries is the single worst decision." Kieran: BUG-1 field mapping crash, BUG-2 unsound non-null assertion. One endpoint = one `useQuery` = zero orchestration. |
| QR code generation            | Client-side via `qrcode` npm, derived in `useEffect` (not async `onSuccess`)           | Kieran EDGE-1: async `onSuccess` is a race condition on unmount. `useEffect` with cancellation flag is correct.                                                                  |
| Paginated response unwrapping | Fix at hook layer: `select: (res) => res.data.items`                                   | 5 endpoints affected (invoices, expenses, categories, templates, contracts). All return `{ items, total, limit, offset }`.                                                       |
| Tax export download           | `fetch()` + `URL.createObjectURL()` + `URL.revokeObjectURL()`                          | DHH + Kieran BUG-4: Bearer auth not sent by browser `<a href>` navigation. Must use fetch with Authorization header.                                                             |
| Default tab                   | `revenue`                                                                              | Matches DoD #1                                                                                                                                                                   |
| Tab state                     | **`useState`** (not `useSearchParams`)                                                 | Simplicity: YAGNI — deep linking not in DoD. Can upgrade later in 10 minutes.                                                                                                    |
| Editor navigation             | Inline panel replacement                                                               | Components already have `onCancel`/`onSaved` props                                                                                                                               |
| Lazy loading                  | **Static imports** (not `React.lazy`)                                                  | Simplicity: all components in same feature module, same bundle chunk. No perf benefit.                                                                                           |
| Team size                     | **Solo**                                                                               | All 3 reviewers: sequential work in one feature module. "Solo > team for tightly coupled changes."                                                                               |

## Confirmed API Mismatches (6 total)

| #   | Location                                                                   | Bug                                                                          | Fix                                                                    |
| --- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| M1  | `taxApi.getSummary()`                                                      | No year param; returns single quarter; field names don't match frontend type | **New backend endpoint** returns `QuarterlyTaxSummary[]` for full year |
| M2  | `taxApi.getExpenses()`                                                     | Sends `from`/`to`; backend expects `startDate`/`endDate`                     | Rename params + update all call sites                                  |
| M3  | `invoicesApi.generatePaymentLink()`                                        | Frontend expects `{ lnurlPay, qrCode }`; backend returns `{ lnurlPay }` only | Remove `qrCode` from type; generate QR client-side in `useEffect`      |
| M4  | `invoicesApi.getInvoices()`                                                | Backend returns `{ items, total, limit, offset }`; hook expects flat array   | Fix select + update API return type                                    |
| M5  | `taxApi.getCategories()` + `getExpenses()` + `contractsApi.getTemplates()` | Same paginated wrapper issue                                                 | Fix select + update API return types                                   |
| M6  | `taxApi.exportTax()`                                                       | Frontend expects `{ downloadUrl }`; backend streams file                     | fetch + createObjectURL with auth header                               |

---

## Todos (10 items, solo execution)

### Phase 1: Backend Fix + API Client Fixes

---

#### TODO-1: Add `getAnnualSummary` backend endpoint returning all 4 quarters

**Files:**

- `packages/backend/src/services/finance/TaxService.ts` — add `getAnnualSummary(creatorId, year)` method
- `packages/backend/src/interfaces/finance/ITaxService.ts` — add interface method
- `packages/backend/src/routes/v2/business-tax.routes.ts` — update `GET /summary` to accept `year` only (no `quarter`) and return array

**What to do:**

1. Read `TaxService.getQuarterlySummary()` to confirm exact field names returned
2. Add `getAnnualSummary(creatorId: string, year: number)` that calls `getQuarterlySummary` for Q1-Q4 and returns `QuarterlyTaxSummary[]` with field names matching the frontend type:

```typescript
async getAnnualSummary(creatorId: string, year: number): Promise<QuarterlyTaxSummary[]> {
  const quarters = [1, 2, 3, 4] as const;
  const results = await Promise.all(
    quarters.map((q) => this.getQuarterlySummary(creatorId, year, q))
  );
  return results.map((r, i) => ({
    year,
    quarter: `Q${quarters[i]}`,
    totalIncomeSats: r.revenue,
    totalIncomeUsd: r.usdRevenue,
    totalExpensesSats: r.expenses,
    totalExpensesUsd: r.usdExpenses,
    netSats: r.net,
    netUsd: r.usdNet,
  }));
}
```

3. Update route: if no `quarter` param, call `getAnnualSummary`; if `quarter` provided, keep existing behavior (backward compat).

Then update frontend:

**File:** `packages/frontend/src/features/business/services/taxApi.ts:7-10`

```typescript
getSummary(year: number): Promise<ApiResponse<QuarterlyTaxSummary[]>> {
  return apiClient.get(`${BASE}/summary`, { year });
},
```

**File:** `packages/frontend/src/features/business/hooks/useTax.ts:6-13`

```typescript
export function useTaxSummary(year: number) {
  return useQuery({
    queryKey: [...QUERY_KEY, 'summary', year],
    queryFn: () => taxApi.getSummary(year),
    select: (res) => res.data,
    staleTime: 5 * 60 * 1000,
  });
}
```

**File:** `packages/frontend/src/features/business/components/TaxSummary.tsx:11`

```typescript
const { data: summaries, isLoading, isError } = useTaxSummary(selectedYear);
```

Replace `years` derivation (line 15-17) with static range:

```typescript
const currentYear = new Date().getFullYear();
const years = [currentYear, currentYear - 1, currentYear - 2];
```

**DoD mapping:** D4

---

#### TODO-2: Fix expense/category param names + all paginated response unwrapping

**Files (param rename):**

- `packages/frontend/src/features/business/services/taxApi.ts:12-16` — `from`/`to` → `startDate`/`endDate`
- `packages/frontend/src/features/business/hooks/useExpenses.ts:7` — update param type
- Search for all call sites of `useExpenses` that pass date params and update them

**Files (paginated unwrapping — 5 hooks + 4 API return types):**

- `hooks/useBusinessInvoices.ts:11` — `select: (res) => res.data.items`
- `hooks/useExpenses.ts:11` — `select: (res) => res.data.items`
- `hooks/useTax.ts:18` (categories) — `select: (res) => res.data.items`
- `hooks/useContracts.ts:11` (templates) — `select: (res) => res.data.items`
- `hooks/useContracts.ts:29` (contracts list) — verify if also paginated, fix if so

**API return type updates (Kieran BUG-3 — all must be specified):**

- `invoicesApi.ts:8` — `Promise<ApiResponse<{ items: BusinessInvoice[]; total: number }>>`
- `taxApi.ts:12` — `Promise<ApiResponse<{ items: Expense[]; total: number }>>`
- `taxApi.ts:24` — `Promise<ApiResponse<{ items: ExpenseCategory[]; total: number }>>`
- `contractsApi.ts` (getTemplates) — `Promise<ApiResponse<{ items: ContractTemplate[]; total: number }>>`

**DoD mapping:** D1, D2, D3, D4

---

#### TODO-3: Fix invoice payment link type + QR code generation

**Files:**

- `packages/frontend/src/features/business/services/invoicesApi.ts:24` — remove `qrCode` from return type
- `packages/frontend/src/features/business/components/InvoiceEditor.tsx` — QR via `useEffect`

1. `npm install qrcode @types/qrcode --workspace=packages/frontend`
2. Fix return type: `Promise<ApiResponse<{ lnurlPay: string }>>`
3. Update `paymentLink` state type: `{ lnurlPay: string } | null`
4. Generate QR in `useEffect` (Kieran EDGE-1 fix — not async `onSuccess`):

```typescript
import QRCode from 'qrcode';

const [paymentLink, setPaymentLink] = useState<{ lnurlPay: string } | null>(null);
const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

// In onSuccess: just set paymentLink
onSuccess: (res) => {
  setPaymentLink({ lnurlPay: res.data.lnurlPay });
};

// Derive QR from paymentLink — safe on unmount
useEffect(() => {
  if (!paymentLink) {
    setQrDataUrl(null);
    return;
  }
  let cancelled = false;
  QRCode.toDataURL(paymentLink.lnurlPay, { width: 200 })
    .then((url) => {
      if (!cancelled) setQrDataUrl(url);
    })
    .catch(() => {
      if (!cancelled) setQrDataUrl(null);
    });
  return () => {
    cancelled = true;
  };
}, [paymentLink]);
```

5. JSX: replace `{paymentLink.qrCode && <img ... />}` with:

```tsx
{
  qrDataUrl && <img src={qrDataUrl} alt="Lightning payment QR code" className="w-48 h-48" />;
}
```

**DoD mapping:** D2

---

#### TODO-4: Fix tax export to fetch + createObjectURL

**Files:**

- `packages/frontend/src/features/business/services/taxApi.ts:32-37`
- `packages/frontend/src/features/business/hooks/useTax.ts:38-46` — remove `useExportTax`
- `packages/frontend/src/features/business/components/TaxSummary.tsx:2,21-29`

Replace `taxApi.exportTax()`:

```typescript
getExportUrl(format: 'csv' | 'json', year: number): string {
  const params = new URLSearchParams({ format, year: String(year) });
  return `${BASE}/export?${params}`;
},
```

Replace `handleExport` in TaxSummary.tsx (DHH + Kieran BUG-4):

```typescript
const [exportError, setExportError] = useState<string | null>(null);
const [exporting, setExporting] = useState(false);

const handleExport = async (format: 'csv' | 'json') => {
  setExportError(null);
  setExporting(true);
  try {
    const url = taxApi.getExportUrl(format, selectedYear);
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${apiClient.getToken()}` },
    });
    if (!response.ok) throw new Error('Export failed');
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = `tax-report-${selectedYear}.${format}`;
    link.click();
    URL.revokeObjectURL(blobUrl); // Kieran: prevent memory leak
  } catch {
    setExportError('Export failed. Please try again.');
  } finally {
    setExporting(false);
  }
};
```

Remove `useExportTax` import from TaxSummary.tsx line 2. Update `disabled` to use `exporting` state. Keep error display using `exportError` state (Kieran DESIGN-1: replacing mutation error state).

**Note:** Verify `apiClient.getToken()` exists. If not, check how the auth token is accessed in this codebase and use that pattern.

**DoD mapping:** D4

---

### Phase 2: Page Component & Routing

---

#### TODO-5: Create BusinessManagerDashboard.tsx + route + nav link + barrel export

**New file:** `packages/frontend/src/features/business/components/BusinessManagerDashboard.tsx`
**Edit:** `packages/frontend/src/App.tsx`
**Edit:** `packages/frontend/src/components/ui/Layout.tsx`
**Edit:** `packages/frontend/src/features/business/index.ts`

```typescript
import React, { useState } from 'react';
import type { BusinessTab } from '../types';
import BusinessNav from './BusinessNav';
import ContractLibrary from './ContractLibrary';
import ContractEditor from './ContractEditor';
import InvoiceDashboard from './InvoiceDashboard';
import InvoiceEditor from './InvoiceEditor';
import RevenueMix from './RevenueMix';
import TaxSummary from './TaxSummary';
import ExpenseTracker from './ExpenseTracker';
import DiversificationGoals from './DiversificationGoals';

export const BusinessManagerDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<BusinessTab>('revenue');
  const [editingInvoice, setEditingInvoice] = useState(false);
  const [editingContract, setEditingContract] = useState<string | null>(null);

  const handleTabChange = (tab: BusinessTab) => {
    setActiveTab(tab);
    setEditingInvoice(false);
    setEditingContract(null);
  };

  const renderTabPanel = (): React.ReactNode => {
    switch (activeTab) {
      case 'contracts':
        if (editingContract) {
          return (
            <ContractEditor
              templateId={editingContract}
              onCancel={() => setEditingContract(null)}
              onSaved={() => setEditingContract(null)}
            />
          );
        }
        return <ContractLibrary onSelectTemplate={(id) => setEditingContract(id)} />;
      case 'invoices':
        if (editingInvoice) {
          return (
            <InvoiceEditor
              onCancel={() => setEditingInvoice(false)}
              onSaved={() => setEditingInvoice(false)}
            />
          );
        }
        return (
          <InvoiceDashboard
            onCreateNew={() => setEditingInvoice(true)}
            onViewInvoice={() => {/* MVP: no detail view */}}
          />
        );
      case 'revenue':
        return (
          <>
            <RevenueMix />
            <DiversificationGoals />
          </>
        );
      case 'tax':
        return (
          <>
            <TaxSummary />
            <ExpenseTracker />
          </>
        );
      default:
        return null; // Kieran PATTERN-1: exhaustive switch safety
    }
  };

  return (
    <div className="space-y-6 p-6 min-h-screen">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Business Manager</h1>
        <p className="text-sm text-gray-500 mt-1">Contracts, invoices, revenue, and tax tools.</p>
      </div>
      <BusinessNav activeTab={activeTab} onTabChange={handleTabChange} />
      <div id={`panel-${activeTab}`} role="tabpanel" aria-labelledby={activeTab}>
        {renderTabPanel()}
      </div>
    </div>
  );
};
```

**App.tsx** — add lazy import + route after `/shield` block:

```tsx
const BusinessManagerDashboard = React.lazy(() =>
  import('./features/business/components/BusinessManagerDashboard').then((module) => ({
    default: module.BusinessManagerDashboard,
  }))
);

// Route (lazy load at page level is fine — this IS a route-level split)
<Route
  path="/business"
  element={
    <Layout>
      <ProtectedRoute requireRole="creator" showAccessDenied={true}>
        <BusinessErrorBoundary>
          <Suspense fallback={<div className="animate-pulse h-48 rounded bg-gray-100" />}>
            <BusinessManagerDashboard />
          </Suspense>
        </BusinessErrorBoundary>
      </ProtectedRoute>
    </Layout>
  }
/>;
```

Note: `React.lazy` at the route level in App.tsx IS correct (route-level code splitting). We removed it from inside the dashboard component (no benefit for sub-components in the same chunk).

**Layout.tsx** — add Business nav link inside creator block:

```tsx
<Link
  to="/business"
  className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
>
  Business
</Link>
```

**business/index.ts** — add barrel export:

```typescript
export { BusinessManagerDashboard } from './components/BusinessManagerDashboard';
```

**DoD mapping:** D1, D2, D3, D4

---

#### TODO-6: Verify/create contract template seed data

**File:** Check `supabase/migrations/` for existing seed data

If `contract_templates` table is empty, create migration seeding 3 templates:

1. **Sponsorship Agreement** (category: `sponsorship`)
2. **Freelance Service Contract** (category: `freelance`)
3. **Content Licensing Agreement** (category: `licensing`)

All with `created_by = NULL` (global templates).

**Kieran DESIGN-3:** Verify RLS policies on `contract_templates` — if `created_by = auth.uid()` is required, NULL rows may be invisible. The `GET /templates` route does NOT use `authenticate` middleware (confirmed — it's public), so RLS may not apply if the query uses the service role. Verify and adjust accordingly.

**DoD mapping:** D3

---

### Phase 3: E2E Tests

---

#### TODO-7: Create business.page.ts POM

**New file:** `packages/frontend/e2e/pages/business.page.ts`

```typescript
import type { Locator, Page } from '@playwright/test';

export class BusinessPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly contractsTab: Locator;
  readonly invoicesTab: Locator;
  readonly revenueTab: Locator;
  readonly taxTab: Locator;
  readonly createInvoiceButton: Locator;
  readonly taxTable: Locator;
  readonly yearSelector: Locator;
  readonly exportCsvButton: Locator;
  readonly exportJsonButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: /business manager/i }).first();
    this.contractsTab = page.getByRole('tab', { name: /contracts/i }).first();
    this.invoicesTab = page.getByRole('tab', { name: /invoices/i }).first();
    this.revenueTab = page.getByRole('tab', { name: /revenue/i }).first();
    this.taxTab = page.getByRole('tab', { name: /tax/i }).first();
    this.createInvoiceButton = page
      .getByRole('button', { name: /new invoice|create invoice/i })
      .first();
    this.taxTable = page.getByRole('table', { name: /tax summary/i }).first();
    this.yearSelector = page.getByLabel(/select tax year/i).first();
    this.exportCsvButton = page.getByLabel(/export.*csv/i).first();
    this.exportJsonButton = page.getByLabel(/export.*json/i).first();
  }

  async goto() {
    await this.page.goto('/business');
    await this.heading.waitFor({ state: 'visible' }); // DHH: consistent readiness gate
  }

  async switchTab(tab: 'contracts' | 'invoices' | 'revenue' | 'tax') {
    const tabMap = {
      contracts: this.contractsTab,
      invoices: this.invoicesTab,
      revenue: this.revenueTab,
      tax: this.taxTab,
    };
    await tabMap[tab].click();
  }
}
```

**DoD mapping:** D5

---

#### TODO-8: Create business.auth.spec.ts E2E spec

**New file:** `packages/frontend/e2e/business.auth.spec.ts`

```typescript
import { expect, test } from '@playwright/test';
import { BusinessPage } from './pages/business.page';

test.describe('Business Manager Dashboard', () => {
  let businessPage: BusinessPage;

  test.beforeEach(async ({ page }) => {
    businessPage = new BusinessPage(page);
    await businessPage.goto(); // DHH: navigate in beforeEach, consistently
  });

  test('loads dashboard with heading visible', async () => {
    await expect(businessPage.heading).toBeVisible();
  });

  test('defaults to revenue tab', async () => {
    await expect(businessPage.revenueTab).toHaveAttribute('aria-selected', 'true');
  });

  test('all four tabs are visible and clickable', async () => {
    await expect(businessPage.contractsTab).toBeVisible();
    await expect(businessPage.invoicesTab).toBeVisible();
    await expect(businessPage.revenueTab).toBeVisible();
    await expect(businessPage.taxTab).toBeVisible();

    await businessPage.switchTab('contracts');
    await expect(businessPage.contractsTab).toHaveAttribute('aria-selected', 'true');

    await businessPage.switchTab('invoices');
    await expect(businessPage.invoicesTab).toHaveAttribute('aria-selected', 'true');

    await businessPage.switchTab('tax');
    await expect(businessPage.taxTab).toHaveAttribute('aria-selected', 'true');
  });

  test('navigates to /business route', async ({ page }) => {
    await expect(page).toHaveURL(/\/business/);
  });

  test('invoices tab shows create invoice button', async () => {
    await businessPage.switchTab('invoices');
    await expect(businessPage.createInvoiceButton).toBeVisible();
  });

  test('tax tab shows year selector and export buttons', async () => {
    await businessPage.switchTab('tax');
    await expect(businessPage.yearSelector).toBeVisible();
    await expect(businessPage.exportCsvButton).toBeVisible();
    await expect(businessPage.exportJsonButton).toBeVisible();
  });
});
```

**DoD mapping:** D5

---

## Todo Summary

| #   | What                                                                          | Files                                                                                       | DoD   |
| --- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ----- |
| 1   | Backend: add `getAnnualSummary` endpoint + frontend tax hook/api/component    | TaxService.ts, ITaxService.ts, business-tax.routes.ts, taxApi.ts, useTax.ts, TaxSummary.tsx | D4    |
| 2   | Fix expense params + all paginated response unwrapping (5 hooks, 4 API types) | taxApi.ts, useExpenses.ts, 4 hook files, 4 api files                                        | D1-D4 |
| 3   | Fix invoice payment link type + QR code via useEffect                         | invoicesApi.ts, InvoiceEditor.tsx, package.json                                             | D2    |
| 4   | Fix tax export with fetch + createObjectURL + error state                     | taxApi.ts, useTax.ts, TaxSummary.tsx                                                        | D4    |
| 5   | Create dashboard page + route + nav + barrel export                           | BusinessManagerDashboard.tsx (new), App.tsx, Layout.tsx, index.ts                           | D1-D4 |
| 6   | Verify/create contract template seed data                                     | supabase/migrations/                                                                        | D3    |
| 7   | Create business.page.ts POM                                                   | e2e/pages/business.page.ts (new)                                                            | D5    |
| 8   | Create business.auth.spec.ts E2E                                              | e2e/business.auth.spec.ts (new)                                                             | D5    |

**Execution order:** 1 → 2,3,4 (parallel) → 5 → 6 → 7,8

DoD verification goes in the PR description, not as a separate todo.

---

## Scope Boundaries (Squad A Only)

**We own:** `packages/frontend/src/features/business/`, `App.tsx` (business route only), `Layout.tsx` (business link only), `e2e/business.*`, and the backend tax summary endpoint change.

**We do NOT touch:** Squad B files, other feature modules, CI/CD workflows, shared types (already complete).

## Review Findings Applied

| Reviewer   | Finding                                               | Resolution                                                   |
| ---------- | ----------------------------------------------------- | ------------------------------------------------------------ |
| DHH        | 4 parallel queries is worst decision; fix the backend | TODO-1: new `getAnnualSummary` endpoint                      |
| DHH        | Export `<a href>` buries auth problem in footnote     | TODO-4: fetch + createObjectURL as primary approach          |
| DHH        | TODO-11, TODO-16 are process theater                  | Merged into TODO-5; verification moved to PR description     |
| DHH        | E2E beforeEach should include goto()                  | TODO-8: goto() in beforeEach consistently                    |
| Kieran     | BUG-1: select spreads wrong field names → NaN         | TODO-1: field mapping done in backend `getAnnualSummary`     |
| Kieran     | BUG-2: q.data! non-null assertion unsound             | Eliminated — single useQuery, no useQueries                  |
| Kieran     | BUG-3: contractsApi.ts return type missing            | TODO-2: all 4 API return types explicitly listed             |
| Kieran     | BUG-4: `<a href>` returns 401                         | TODO-4: fetch with Authorization header                      |
| Kieran     | EDGE-1: async onSuccess QR is race condition          | TODO-3: useEffect with cancellation flag                     |
| Kieran     | DESIGN-1: removing mutation removes error state       | TODO-4: local error/loading state added                      |
| Kieran     | DESIGN-3: NULL created_by may violate RLS             | TODO-6: explicit RLS verification step                       |
| Kieran     | PATTERN-1: switch needs default:null                  | TODO-5: added                                                |
| Simplicity | useSearchParams is YAGNI                              | TODO-5: useState instead                                     |
| Simplicity | React.lazy on sub-components is premature             | TODO-5: static imports (lazy only at route level in App.tsx) |
| Simplicity | 16 TODOs → 10                                         | Done                                                         |
| Simplicity | 4 agents → solo                                       | Done                                                         |

## References

- Story map: `/Users/fp/Desktop/story-map-v2-production-roadmap.md` (Slice 5)
- Critical patterns: `docs/solutions/patterns/critical-patterns.md`
- E2E conventions: CLAUDE.md Playwright section
- Business feature: `packages/frontend/src/features/business/`
- Backend routes: `packages/backend/src/routes/v2/business-*.routes.ts`
- DB schema: `supabase/migrations/20240201000000_additional_tables.sql` (Section 5)
