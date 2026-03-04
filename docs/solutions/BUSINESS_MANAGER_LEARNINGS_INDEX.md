# Business Manager Feature — Institutional Learnings Index

> **Quick Start**: Read this file first, then jump to detailed sections below.

---

## What You'll Find

A consolidated reference for Business Manager implementation (EPIC-011) based on 40+ institutional documents across solutions/, plans/, CLAUDE.md, and api-spec.md.

Covers:

- Critical financial patterns (TOCTOU, atomic writes, state guards)
- Architecture decisions from Wave 2 plan
- API shape & DI registration patterns
- E2E testing conventions
- Lightning integration gotchas
- Database schema requirements
- Pre-implementation checklist

---

## Documents in This Series

### 1. Main Reference

**File**: `/Users/fp/Desktop/Sovren/docs/solutions/feature-implementation/business-manager-institutional-learnings-20260304.md`

Complete guide with:

- 7 critical patterns (with code examples)
- Wave 2 P0/P1 findings
- E2E testing setup (3-tier Playwright config, Page Object Model)
- Lightning integration patterns (LNURL-pay, custodial escrow)
- Routing/wiring (backend routes, frontend hooks, React Router)
- Database schema checklist
- Pre-implementation & code review checklists

**Length**: ~2,500 lines
**Read first**: Yes
**When**: Before starting any Business Manager code

---

## 7 Critical Patterns (Must-Know)

| Pattern           | Problem                        | Solution                                                        | File                     |
| ----------------- | ------------------------------ | --------------------------------------------------------------- | ------------------------ |
| #1 TOCTOU         | State transitions race         | Insert-Then-Verify, Accept-Then-Verify-or-Revert, Atomic Claim  | critical-patterns.md #1  |
| #4 Multi-Table    | Partial writes = inconsistency | Supabase RPC (preferred), Compensating transaction              | critical-patterns.md #4  |
| #7 Status Guards  | DELETE on protected state      | Assert status before write, check count on result               | critical-patterns.md #7  |
| #5 Persistence    | Partial writes, corruption     | Atomic Write, Write Mutex, Persist-Then-Mutate, Compensating Tx | critical-patterns.md #5  |
| #10 Duplication   | String defined in 5 places     | Extract to @shared/, log silent fallbacks                       | critical-patterns.md #10 |
| #11 Filter Escape | PostgREST injection            | Escape backslash FIRST, then metacharacters                     | critical-patterns.md #11 |
| #12 VIEW Security | Query planner bypasses WHERE   | `security_barrier=true` + status filter on all public VIEWs     | critical-patterns.md #12 |

---

## Wave 2 Critical Findings (P0 — Before Code)

1. **Rename InvoiceService → BusinessInvoiceService** (token collision with Phase 5)
2. **Use basis points for revenue splits** (0-10000, not decimals)
3. **UUID PKs everywhere** with `DEFAULT gen_random_uuid()`
4. **State machine triggers required** (follow `transition_payment_state()`)
5. **ON DELETE RESTRICT** for financial tables
6. **RLS policies** on all 14 tables
7. **BOLT11 cannot be used** for business invoices (1-hour expiry)
   → **Use LNURL-pay** instead (dynamic invoice generation)
8. **Custodial escrow required** for multi-creator revenue splits

---

## API Response Shape (MUST Match)

```json
{
  "success": true,
  "data": { ... },
  "error": null,
  "code": null,
  "timestamp": "ISO 8601"
}
```

**Paginated**:

```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 98,
    "hasNext": true
  }
}
```

**Error codes**: 400 (validation), 403 (auth), 404 (not found), 409 (state), 500 (error)

---

## E2E Testing Structure (Convention-Based)

```
e2e/
├── auth.setup.ts              # Setup: real login
├── business.auth.spec.ts      # Authenticated tests (auto-matched)
├── pages/
│   └── business.page.ts       # Page Object Model
└── fixtures/
    └── test-credentials.ts    # Test users with env overrides
```

**3-tier Playwright config:**

1. `setup` project — auth.setup.ts (creates storage state)
2. `chromium-authenticated` — uses saved auth, runs \*.auth.spec.ts
3. `chromium-public` — no auth, runs \*.public.spec.ts

**Rules:**

- NO MOCKS (`page.route()` forbidden)
- Use real API, `waitForResponse()` for verification
- Page Object Model only (all locators in POM)
- Role-based locators: `getByRole()`, not CSS
- Test runs: `npm run test:e2e` before mark-done

---

## Routing Quick Reference

**Backend**: Group by domain, not HTTP method

```
/api/v1/business/
├── invoices/{id}     (CREATE, READ, UPDATE, DELETE)
├── revenue/summary   (aggregates)
└── contracts/{id}    (CRUD)
```

**Frontend**: Self-contained feature module

```
features/business/
├── index.ts          (barrel exports)
├── types/            (import from @shared/types/finance)
├── services/api.ts   (type-safe client)
├── hooks/            (useInvoices, useCancelInvoice)
└── components/       (with double-submit guards)
```

---

## Database Schema Essentials

Every financial table MUST have:

- [ ] `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- [ ] `created_at`, `updated_at` timestamps
- [ ] Foreign keys with `ON DELETE RESTRICT`
- [ ] Status column with CHECK constraint
- [ ] State machine trigger
- [ ] RLS policies (use `select auth.uid()`)
- [ ] Compound indexes for queries

---

## Lightning Integration Gotchas

| Type             | TTL     | Use For              | Tool                              |
| ---------------- | ------- | -------------------- | --------------------------------- |
| BOLT11           | ~1 hour | One-time zaps        | Standard                          |
| LNURL-pay        | Dynamic | 30-day invoices      | **Use this for Business Manager** |
| Custodial escrow | Custom  | Multi-creator splits | LNbits webhook pattern            |

**Why not BOLT11?** Expires in ~1 hour. Business invoices need 30 days.
**Why custodial?** Wallets can't atomically pay multiple invoices. Backend must hold and distribute.

---

## Double-Submit Prevention (Frontend)

```typescript
const inFlightRef = useRef(false);
const [pendingId, setPendingId] = useState<string | null>(null);

const handleAction = () => {
  if (inFlightRef.current) return; // Sync guard
  inFlightRef.current = true;
  setPendingId(id);

  mutation.mutate(
    { id },
    {
      onSettled: () => {
        inFlightRef.current = false;
        setPendingId(null);
      },
    }
  );
};

// JSX: disabled={pendingId !== null} aria-busy={pendingId === id}
```

**Why both useRef AND disabled?**

- `useRef` catches clicks before re-render (synchronous)
- `disabled` provides visual feedback
- Either alone has a race window

---

## Pre-Implementation Steps

### 1. Architecture (Done First)

- [ ] Create ADR for business invoice design
- [ ] Define all 10+ shared types in @shared/types/finance/
- [ ] Document API contracts
- [ ] Plan state machine transitions
- [ ] Review LNURL-pay vs custodial escrow

### 2. Database (Migrations)

- [ ] Write all 14+ table migrations
- [ ] Add state machine triggers
- [ ] Create RLS policies
- [ ] Verify ON DELETE RESTRICT everywhere
- [ ] Add compound indexes

### 3. Backend (Services → Routes → Controllers)

- [ ] Rename Phase 5 InvoiceService → BusinessInvoiceService
- [ ] Create DI tokens + interfaces for 10 services
- [ ] Write service stubs
- [ ] Register in bootstrap + health checks
- [ ] Create route files
- [ ] Add Zod validators

### 4. Frontend (API Client → Hooks → Components)

- [ ] Create feature module
- [ ] Write type-safe API client
- [ ] Create React Query hooks
- [ ] Build components with double-submit guards
- [ ] Wire React Router

### 5. E2E Tests

- [ ] Create Page Object Model
- [ ] Write spec file (no mocks, real backend)
- [ ] Run `npm run test:e2e`

### 6. Integration

- [ ] Add LNURL-pay service
- [ ] Test webhook verification
- [ ] Verify custodial distribution

---

## Code Review Checklist

### Critical (P0 — Block if Failed)

- [ ] All financial mutations use atomic patterns
- [ ] Every DELETE/void has status guard + count check
- [ ] Revenue splits use basis points (0-10000)
- [ ] No ServiceToken<any> — all typed
- [ ] VIEWs have security_barrier=true
- [ ] LNURL-pay used, not BOLT11

### Important (P1 — Defer unless systemic)

- [ ] Compound indexes exist
- [ ] RLS policies complete
- [ ] E2E tests no mocks
- [ ] Double-submit prevention on all buttons
- [ ] Error codes match api-spec.md

---

## Where to Go Next

**To implement from scratch:**

1. Read `/Users/fp/Desktop/Sovren/docs/solutions/feature-implementation/business-manager-institutional-learnings-20260304.md` (main reference)
2. Read critical patterns: `/Users/fp/Desktop/Sovren/docs/solutions/patterns/critical-patterns.md` (sections #1, #4, #7)
3. For E2E setup: Check CLAUDE.md "Playwright E2E Testing" section
4. Follow Pre-Implementation Checklist above

**To review a PR:**

1. Use Code Review Checklist above
2. Cross-check against critical patterns
3. Verify API response shapes match api-spec.md
4. Run `npm run test:e2e` locally

**If stuck on a specific area:**

- Database design → See Critical Patterns #1, #4, #7
- API contracts → See api-spec.md + Wave 2 findings
- E2E testing → See CLAUDE.md + playwright-e2e-quick-reference.md
- Lightning → See Wave 2 findings + Critical Patterns #5d

---

**Generated**: 2026-03-04
**Source**: 40+ institutional documents
**Status**: Canonical reference for EPIC-011 Business Manager
