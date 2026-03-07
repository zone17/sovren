---
title: 'PR #86 P1 Remediation: 12 Critical TOCTOU, Auth & Query Bounds Findings'
date: '2026-02-19'
category: security-issues
module: community, finance, frontend, infrastructure
severity: critical
problem_type: race_conditions_authorization_queries
component: CreatorCircleService, MentorshipService, MarketplaceService, BusinessInvoiceService, ContractService, TaxService, RevenueService, InboxPollingService, InvoiceDashboard, OrderTracker, env-validation
symptoms:
  - 'TOCTOU race: circle join allows over-enrollment via concurrent requests'
  - 'TOCTOU race: mentorship accept exceeds max_mentees under concurrency'
  - 'TOCTOU race: marketplace listing claimed by two buyers simultaneously'
  - 'Missing auth: getCirclePosts returns posts without membership verification'
  - 'Missing status guard: non-draft invoices/contracts deletable'
  - 'Unbounded query: TaxService loads all rows into memory causing OOM risk'
  - 'Silent truncation: RevenueService .limit(1000) drops records beyond 1K'
  - 'Frontend double-submit: financial buttons fire duplicate mutations'
  - 'Missing env validation: BYOK_ENCRYPTION_KEY not validated at startup'
  - 'Stub waste: BullMQ polling worker runs for unimplemented fetchPlatformMessages()'
root_cause:
  - 'read-then-write patterns without atomic guards'
  - 'authorization checks missing at service boundary'
  - 'no status precondition on destructive operations'
  - 'unbounded SELECT without pagination'
  - 'mutation buttons missing isPending disabled state'
  - 'environment secrets not in validation schema'
tags:
  - toctou
  - race-conditions
  - authorization
  - status-guards
  - pagination
  - unbounded-queries
  - double-submit
  - env-validation
  - feature-flags
  - domain-grouped-agents
  - remediation-sprint
related_issues:
  - 'PR #86 Round 4 review todos 359-370'
  - 'Phase 7 TOCTOU pattern (todo 149): docs/solutions/process-issues/phase7-review-gap-analysis-5-p1s-in-90-files.md'
  - 'Payment persistence patterns (02-14): docs/solutions/security-issues/p1-critical-fixes-pr73-round6-payment-persistence.md'
  - 'PR #85 remediation (02-17): docs/solutions/security-issues/pr85-review-remediation-25-findings-20260217.md'
  - 'P2 final remediation (02-18): docs/solutions/code-quality/p2-final-remediation-sprint-22-todos-20260218.md'
---

# PR #86 P1 Remediation: 12 Critical Findings Fixed

## Problem Symptom

Round 4 code review of PR #86 (Wave 2 Epics 009B, 010, 011) identified 12 P1 critical findings across community services, finance services, frontend components, and infrastructure. The findings fell into 5 categories: TOCTOU race conditions (3), missing authorization (1), missing status guards (2), unbounded queries (2), frontend double-submit (1), missing env validation (1), stub resource waste (1), and a data format mismatch (1, already fixed by the case-transform layer).

## Root Cause Analysis

All 12 issues shared a common root cause: **optimistic assumptions about single-user, single-request execution**. Each service was written as if requests arrive one at a time, with no concurrent mutation. Specifically:

1. **TOCTOU races** (3 findings): Services used read-then-write patterns (`SELECT count → INSERT if under cap`) with a race window between the read and write where concurrent requests could both pass the check.
2. **Missing auth** (1 finding): `getCirclePosts()` assumed the route-level auth was sufficient, but didn't verify circle membership at the service layer.
3. **Missing status guards** (2 findings): `deleteInvoice()` and `deleteContract()` had no precondition check, allowing deletion of sent/paid/active records.
4. **Unbounded queries** (2 findings): Tax and revenue aggregation loaded all rows in a single SELECT, assuming the dataset would always be small.
5. **Frontend double-submit** (1 finding): Financial buttons assumed React re-render would disable them before a second click could fire.
6. **Env validation gap** (1 finding): `BYOK_ENCRYPTION_KEY` was used in code but never added to `.env.example` or startup validation.
7. **Stub waste** (1 finding): `InboxPollingService` registered a BullMQ worker for a function that returns `[]`.

## Working Solution

### Pattern 1: Insert-Then-Verify (TOCTOU — Circle Join)

**Problem:** Two concurrent `joinCircle()` calls both read count < max_members, both insert, resulting in over-enrollment.

**Fix:** Insert the member first (unique constraint prevents exact duplicates), then count. If over capacity, delete the just-inserted row.

```typescript
// CreatorCircleService.ts — joinCircle()
const { error: insertError } = await this.db
  .from('circle_members')
  .insert({ circle_id: circleId, creator_id: creatorId, role: 'member' });

if (insertError?.code === '23505') {
  throw new Error('Already a member of this circle');
}

const { count } = await this.db
  .from('circle_members')
  .select('id', { count: 'exact', head: true })
  .eq('circle_id', circleId);

if ((count ?? 0) > circle.max_members) {
  await this.db
    .from('circle_members')
    .delete()
    .eq('circle_id', circleId)
    .eq('creator_id', creatorId);
  throw new ConflictError(`Circle is full (max ${circle.max_members} members)`);
}
```

**When to use:** Any aggregate cap enforcement (member count, slot count, quota) without DB-native transactions.

### Pattern 2: Accept-Then-Verify-or-Revert (TOCTOU — Mentorship)

**Problem:** Two concurrent mentorship accepts both pass capacity check, both update to `active`, exceeding `max_mentees`.

**Fix:** Atomically update status (`.eq('status', 'pending')` guard), then count active mentees. If over cap, revert.

```typescript
// MentorshipService.ts — respondToRequest()
const { error } = await this.db
  .from('mentorships')
  .update(updates)
  .eq('id', mentorshipId)
  .eq('status', 'pending');

if (accept) {
  const { count: activeCount } = await this.db
    .from('mentorships')
    .select('id', { count: 'exact', head: true })
    .eq('mentor_id', creatorId)
    .eq('status', 'active');

  if ((activeCount ?? 0) > mentorProfile.max_mentees) {
    await this.db
      .from('mentorships')
      .update({ status: 'pending', started_at: null })
      .eq('id', mentorshipId)
      .eq('status', 'active');
    throw new ConflictError('Mentor has reached maximum mentee capacity');
  }
}
```

**When to use:** Status transitions with aggregate capacity constraints.

### Pattern 3: Atomic Claim with Rollback (TOCTOU — Marketplace)

**Problem:** Two buyers concurrently order the same listing. Both read `active=true`, both create orders.

**Fix:** `UPDATE SET active=false WHERE active=true` — exactly one concurrent caller wins. Wrap post-claim work in try/catch with rollback.

```typescript
// MarketplaceService.ts — placeOrder()
const { data: claimedRows } = await this.db
  .from('service_listings')
  .update({ active: false })
  .eq('id', listingId)
  .eq('active', true)
  .select('id');

if (!claimedRows || claimedRows.length === 0) {
  throw new ConflictError('Listing is no longer available');
}

try {
  const invoice = await this.lightning.createInvoice(listing.price_sats, memo);
  // ... create order ...
} catch (orderError) {
  await this.db
    .from('service_listings')
    .update({ active: true })
    .eq('id', listingId)
    .eq('active', false);
  throw orderError;
}
```

**When to use:** Claiming scarce resources (tickets, slots, listings). The `.eq('active', true)` is the atomic test-and-set.

### Pattern 4: Status Guards on Destructive Operations

**Problem:** Non-draft invoices/contracts deleted, destroying audit history.

**Fix:** Fetch current status, reject if not in allowed state.

```typescript
// BusinessInvoiceService.ts — deleteInvoice()
const invoice = await this.getInvoice(invoiceId, creatorId);
if (invoice.status !== 'draft') {
  throw new ConflictError(
    `Cannot delete invoice with status '${invoice.status}'. Only draft invoices can be deleted.`
  );
}
```

**When to use:** Any destructive operation (delete, void, cancel) where only a subset of states are valid.

### Pattern 5: Paginated Accumulation

**Problem:** `TaxService.getQuarterlySummary()` loads all revenue/expense rows into memory. `RevenueService` uses `.limit(1000)` silently dropping records.

**Fix:** Page through results in chunks of 500, accumulating totals.

```typescript
// TaxService.ts
const PAGE_SIZE = 500;
let total = 0,
  offset = 0,
  hasMore = true;

while (hasMore) {
  const { data } = await this.db
    .from('revenue_entries')
    .select('amount_sats, usd_at_time')
    .eq('creator_id', creatorId)
    .gte('recorded_at', startDate)
    .lte('recorded_at', endDate)
    .order('recorded_at', { ascending: true })
    .range(offset, offset + PAGE_SIZE - 1);

  const rows = data ?? [];
  for (const r of rows) total += r.amount_sats;
  hasMore = rows.length === PAGE_SIZE;
  offset += PAGE_SIZE;
}
```

**When to use:** Any aggregate over unbounded result sets. `rows.length === PAGE_SIZE` detects last page without extra COUNT.

### Pattern 6: Frontend Double-Submit Prevention

**Problem:** Financial buttons (Mark Paid, Release Escrow) fire duplicate mutations on rapid double-click.

**Fix:** Combine `useRef` synchronous guard with `disabled={isPending}` visual guard.

```tsx
// InvoiceDashboard.tsx
const [pendingId, setPendingId] = useState<string | null>(null);
const inFlightRef = useRef(false);

const handleMarkPaid = (invoiceId: string) => {
  if (inFlightRef.current) return;
  inFlightRef.current = true;
  setPendingId(invoiceId);
  updateStatus.mutate(
    { id: invoiceId, status: 'paid' },
    {
      onSettled: () => {
        inFlightRef.current = false;
        setPendingId(null);
      },
    }
  );
};

<button
  disabled={pendingId !== null || updateStatus.isPending}
  aria-busy={pendingId === invoice.id}
>
  {pendingId === invoice.id ? 'Processing...' : 'Mark Paid'}
</button>;
```

**When to use:** Any mutation button with financial or state consequences. `useRef` fires synchronously (before re-render); `disabled` provides visual feedback.

### Pattern 7: Env Validation with Key-Separation Check

**Problem:** `BYOK_ENCRYPTION_KEY` absent in production or equal to `PLATFORM_TOKEN_ENCRYPTION_KEY`.

**Fix:** Zod schema for format, runtime checks for production presence and cross-key separation.

```typescript
// env-validation.ts
BYOK_ENCRYPTION_KEY: z.string()
  .regex(/^[0-9a-f]{64}$/i, 'Must be a 64-character hex string (32 bytes)')
  .optional(),

// Runtime: production presence + separation check
if (env.NODE_ENV === 'production' && !env.BYOK_ENCRYPTION_KEY) {
  securityIssues.push('BYOK_ENCRYPTION_KEY required (generate: openssl rand -hex 32)');
}
if (env.BYOK_ENCRYPTION_KEY && env.PLATFORM_TOKEN_ENCRYPTION_KEY &&
    env.BYOK_ENCRYPTION_KEY.toLowerCase() === env.PLATFORM_TOKEN_ENCRYPTION_KEY.toLowerCase()) {
  securityIssues.push('Keys must differ (security requirement C-5)');
}
```

**When to use:** Any pair of encryption keys requiring cryptographic isolation. Optional in schema (dev ease), required + distinct at runtime in production.

### Pattern 8: Feature Flag Guard for Stub Infrastructure

**Problem:** BullMQ polling worker consumes Redis connections for an unimplemented `fetchPlatformMessages()`.

**Fix:** Opt-in env flag. Log warning and return early when disabled.

```typescript
// InboxPollingService.ts — startPolling()
if (process.env.ENABLE_INBOX_POLLING !== 'true') {
  this.logger.warn('[InboxPollingService] Polling disabled — stub not yet implemented.');
  return;
}
```

**When to use:** Any service with real resource costs (Redis, external APIs, workers) but stub business logic. Use opt-in (`ENABLE_X=true`) not opt-out.

## Prevention Strategies

### 1. TOCTOU Race Conditions

- **Detection:** Code review checklist item: "Does this read-then-write have a concurrency window?"
- **Prevention:** Default to atomic patterns (insert-then-verify, UPDATE WHERE current_state). Never check-then-act without a guard.
- **Team brief addition:** "All capacity/quota enforcement must use insert-then-verify or atomic UPDATE WHERE patterns."

### 2. Missing Authorization

- **Detection:** Grep for service methods that access data without caller verification. ESLint rule for route handlers missing auth middleware.
- **Prevention:** Service-layer auth checks, not just route-level. Every data-access method should validate the caller has access.
- **Team brief addition:** "Service methods must verify caller authorization independently of route middleware."

### 3. Missing Status Guards

- **Detection:** Grep for `.delete()` and `.update()` calls without a preceding status check.
- **Prevention:** Every destructive operation starts with a status assertion. Use `ConflictError` (409) for invalid state transitions.
- **Team brief addition:** "All delete/cancel/void operations require explicit status precondition checks."

### 4. Unbounded Queries

- **Detection:** Grep for `.select()` without `.limit()` or `.range()`. ESLint rule flagging unbounded selects.
- **Prevention:** PAGE_SIZE=500 as the default. Never use `.limit(N)` for aggregation — use paginated accumulation.
- **Team brief addition:** "All SELECT queries that could return unbounded rows must use paginated accumulation."

### 5. Frontend Double-Submit

- **Detection:** Grep for `onClick` handlers on financial buttons without `disabled={...isPending}`.
- **Prevention:** All financial mutation buttons use `useRef` + `disabled={isPending}` pattern. Add `aria-busy` for accessibility.
- **Team brief addition:** "Financial action buttons require synchronous ref guard + disabled state + aria-busy."

### 6. Environment Validation

- **Detection:** Pre-deploy checklist: every env var used in code must appear in `.env.example` and Zod schema.
- **Prevention:** Add to env-validation.ts immediately when introducing a new env var. Cross-key checks for any key pair.
- **Team brief addition:** "New environment variables must be added to .env.example, Zod schema, and documented in the same PR."

## Process Innovation: Domain-Grouped Parallel Agents

This sprint validated the **domain-grouped agent pattern** for the 4th consecutive time:

| Sprint                 | Agents | Files  | Conflicts | Tests        |
| ---------------------- | ------ | ------ | --------- | ------------ |
| P3 Remediation (02-17) | 8      | 19     | 0         | Pass         |
| P2 Final (02-18)       | 6      | 22     | 0         | 439 pass     |
| Wave 2 P2/P3 (02-19)   | 6      | 38     | 0         | 439 pass     |
| **This sprint**        | **4**  | **17** | **0**     | **439 pass** |

**Key success factors:**

1. Non-overlapping file ownership per agent (community, finance, frontend, infra)
2. Each agent gets scoped brief with only its domain's files listed
3. Test failures fixed in a second pass after all agents complete
4. Mock chain updates are the main post-agent work (Supabase chaining patterns)

## Related Documentation

- [Phase 7 TOCTOU patterns](../process-issues/phase7-review-gap-analysis-5-p1s-in-90-files.md) — `.eq('status', 'pending')` guard origin
- [Payment persistence patterns (02-14)](./p1-critical-fixes-pr73-round6-payment-persistence.md) — atomic-write, persist-then-mutate, compensating transaction
- [PR #85 remediation (02-17)](./pr85-review-remediation-25-findings-20260217.md) — SECURITY DEFINER RPC, composite FK constraints
- [P2 final remediation (02-18)](../code-quality/p2-final-remediation-sprint-22-todos-20260218.md) — TTLCache reuse, domain-grouped agents proof
- [Prevention code patterns](../PREVENTION_CODE_PATTERNS.md) — Zod validation-first, credential rotation
- [Wave 2 systemic gaps (02-19)](../process-issues/wave2-remediation-systemic-gaps-domain-grouped-teams-20260219.md) — useRef guard, mutation rate limiting

## Key Learnings

1. **TOCTOU is the #1 recurring P1 class** — 3 of 12 findings. Every capacity/quota check needs atomic patterns.
2. **Mock chains are the main test fix cost** — Supabase's chainable API means service changes always break mock `.from().select().eq().order().range()` chains. Budget a fix pass.
3. **Todo 364 was a false positive** — Investigation showed `line_items` is JSONB (single-row atomic insert). Not every P1 needs code changes; some need documentation.
4. **Todo 367 was pre-solved** — The case-transform layer committed earlier in this session already fixed the snake_case/camelCase mismatch.
5. **4 agents is the sweet spot** for 12 tightly-scoped P1s. Fewer agents = less coordination overhead, more focus per domain.
6. **Feature flag > full implementation** for stub services. Disabling the BullMQ worker saves compute immediately; the full implementation (Large effort) is deferred without tech debt.
