# Story Map: Sovren v2.0 — 10 Vertical Slices

**Source**: `docs/brainstorms/2026-02-25-production-roadmap-brainstorm.md`
**Updated**: 2026-02-26 (post-review: collapsed 62 stories → 10 slices)
**Squads**: A (Creator Safety & Money), B (Growth & Reach)
**Sprint cadence**: 1 week, 4-person teams (Architect/opus, Backend/sonnet, Frontend/sonnet, QA/sonnet)

---

## Vertical Slices Overview

| #   | Sprint | Squad  | Slice                           | Points | Status |
| --- | ------ | ------ | ------------------------------- | ------ | ------ |
| 0   | S0     | Shared | Sprint 0 Prerequisites          | 4      | —      |
| 1   | S0     | A      | Auth + Wellness MVP             | 10     | —      |
| 2   | S0     | B      | Discovery MVP                   | 10     | —      |
| 3   | S1     | A      | Content Shield MVP              | 10     | —      |
| 4   | S1     | B      | Payments + Creator Profiles     | 10     | —      |
| 5   | S2     | A      | Business Manager MVP            | 10     | —      |
| 6   | S2     | B      | Comments                        | 10     | —      |
| 7   | S3     | A      | Shield + Business Advanced      | 10     | —      |
| 8   | S3     | B      | Creator Network + Notifications | 10     | —      |
| 9   | S4     | Both   | Buffer + Hardening              | 8 each | —      |

---

## Sprint 0 Prerequisites (Day 1, Both Squads)

**Not a slice — a foundation block. Must complete before vertical slices start.**

### P0: apiClient + queryClient Cleanup (4 points)

Owner: Frontend dev from either squad

| Task                                                                                   | Why                                                                                                               |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Expose typed HTTP interface on `apiClient.ts` (`get`/`post`/`put`/`delete` methods)    | 13 domain files use bracket notation `apiClient['request']` to bypass `private`. `apiClient.get()` doesn't exist. |
| Clean 12 `any` types in `queryClient.ts`                                               | React Query v5 has strong generics for all of these                                                               |
| Fix `FINANCIAL.gcTime: 0` → `60000`                                                    | gcTime:0 causes blank screen on back-navigation                                                                   |
| Remove global `keepPreviousData` default                                               | Causes Creator A data flash on Creator B's profile                                                                |
| Delete `(window as any).queryClient` debug globals + redundant `cleanupCache` interval | Dead debug code                                                                                                   |
| Redux audit: inventory slices, decide per-slice keep/migrate/delete                    | Redux + React Query coexist — React Query owns server state, Redux owns client-only state                         |

### P1: ADR Decisions (1 point)

Owner: Both architects, 2-hour timebox Day 1

- ADR-003: Job queue → BullMQ (only option with existing setup)
- ADR-005: API protocol → REST + Zod (already the pattern for 40+ endpoints)
- Produce written ADRs to `docs/decisions/`. Every subsequent backend story depends on these.

### P2: Fix PaymentProcessingService Mock Regression (1 point)

Owner: Squad B backend dev

- Recovers ~120 backend tests. Single mock interface fix.
- Each squad then adopts `createMockChain` in their own domain tests during their Sprint 0 slice.

### P3: Monitoring Baseline (1 point)

Owner: Either squad's QA

- Health endpoints, structured logging, Sentry error tracking. Must exist before slices ship.

---

## Slice 1: Auth + Wellness MVP (Squad A, Sprint 0)

**Definition of done**: Real auth works (Supabase, kill `mock-jwt-token`). Wellness Dashboard renders real data from 14 backend endpoints. All 8 components have loading/error/empty states. Unit tests for hooks. 1 E2E spec.

### What already exists

- `wellnessApi.ts` with all API methods
- 7 React Query hooks wired to wellnessApi
- 8 UI components using the hooks
- 14 backend endpoints at `/api/v2/wellness/*`
- Auth service (currently returns `mock-jwt-token` — must be replaced)

### What needs building

| Layer               | Work                                                                                                                                                     | Owner              |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| Auth                | Replace `mock-jwt-token` with real Supabase auth. Wire NIP-07 for NOSTR signing if `window.nostr` exists, graceful fallback if not                       | Backend + Frontend |
| Wellness types      | Extend `packages/shared/src/types/wellness.ts` — typed request/response for all 14 endpoints                                                             | Backend            |
| Wellness validation | Verify each of 7 hooks fires correct endpoint. Fix any mismatches. `WellnessResources` endpoint is commented out — either build it or show "coming soon" | Frontend           |
| Loading/error/empty | Add to 5 components that lack them (only BurnoutRiskGauge has explicit error handling)                                                                   | Frontend           |
| createMockChain     | Adopt in Squad A domain tests (wellness, auth, shield)                                                                                                   | Backend            |
| Tests               | Unit tests for all 7 hooks (MSW v2 pattern: `setupServer`, `http.get`, `HttpResponse.json`, `retryDelay: 0`). E2E: `wellness.auth.spec.ts`               | QA                 |

### Parallel work diagram

```
Day 1: [Backend] PaymentProcessingService fix → wellness shared types
        [Architect] ADR decisions (with Squad B architect)
        [Frontend] apiClient refactor + queryClient cleanup (P0)

Day 2: [Backend] createMockChain in Squad A tests
        [Frontend] auth wiring (kill mock-jwt-token)
        [QA] set up wellness.page.ts POM

Day 3-4: [Frontend] validate 7 hooks + add loading/error/empty states
          [QA] unit tests for hooks

Day 5: [QA] E2E spec — gate story
        [All] /workflows:review on PR
```

---

## Slice 2: Discovery MVP (Squad B, Sprint 0)

**Definition of done**: Discovery page shows real creators from backend via React Query. Search/filter/sort work with 300ms debounce. Creator cards do NOT link to profiles yet (links broken until Sprint 1). E2E test verifies real data loads.

### What already exists

- v1 routes (`content-discovery.ts`) wrapping existing discovery service
- Discovery page UI with creator cards
- `useDiscovery.ts` — but it's 99 lines of hardcoded `MOCK_CREATORS` with `useState`/`useEffect`

### What needs building

| Layer           | Work                                                                                                                          | Owner    |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------- | -------- |
| Backend routes  | Create `v2/discovery.routes.ts` wrapping existing discovery service                                                           | Backend  |
| Shared types    | Create `packages/shared/src/types/discovery.ts` (CreatorSearchResult, DiscoveryFilters, TrendingCreator)                      | Backend  |
| API service     | Create `discoveryApi.ts` following `wellnessApi.ts` pattern (domain-scoped, not in shared apiClient)                          | Frontend |
| Hook rewrite    | Full rewrite `useDiscovery` from useState/useEffect to `useQuery`. Add 300ms search debounce, pagination, loading/error/empty | Frontend |
| createMockChain | Adopt in Squad B domain tests (discovery, payments, network)                                                                  | Backend  |
| Tests           | Unit tests for discovery hook. E2E: `discovery.public.spec.ts`                                                                | QA       |

### Key risk

This is a FULL REWRITE, not a data swap. Three layers to build (backend routes, API service, React Query hook). Discovery-to-profile navigation will be broken until Sprint 1 — disable card links.

---

## Slice 3: Content Shield MVP (Squad A, Sprint 1)

**Definition of done**: ShieldDashboard, AlertsFeed, FingerprintCoverage render real data from 11 endpoints. Authenticity badges on published content. Content provenance signing via NIP-07. 1 E2E spec.

### What needs building

| Layer              | Work                                                                                                       | Owner              |
| ------------------ | ---------------------------------------------------------------------------------------------------------- | ------------------ |
| Shared types       | `provenance.ts` — ProvenanceRecord, ContentFingerprint, ShieldAlert, AuthenticityBadge                     | Backend            |
| API service        | `shieldApi.ts` with shield endpoint methods                                                                | Frontend           |
| UI wiring          | Wire existing Shield containers (already built with auth guards + loading states) to hooks                 | Frontend           |
| Provenance signing | Sign content at publish via `window.nostr.signEvent()` (NIP-07). Graceful degradation if extension missing | Backend            |
| Fingerprinting     | Perceptual hash at publish (SimHash for text, pHash for images). Video skipped                             | Backend            |
| Manual DMCA        | Create report form + backend endpoint                                                                      | Backend + Frontend |
| Tests              | Unit tests for shield hooks. Integration test for sign-and-publish flow. E2E: `shield.auth.spec.ts`        | QA                 |

### Key risk

Provenance signing touches content publishing critical path. Must not break existing publish flow. Split: add provenance tags first, then insert `provenance_records` row separately.

---

## Slice 4: Payments + Creator Profiles (Squad B, Sprint 1)

**Definition of done**: Clicking "Pay" on a post creates a real testnet Lightning invoice (QR code). Creator profiles show real data. `simulatePayment` and `Math.random()` BOLT11 are deleted. E2E spec for payment flow.

### What needs building

| Layer                | Work                                                                                                                                                          | Owner    |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Shared types         | `lightning.ts` — LightningInvoice, PaymentRequest, PaymentStatus                                                                                              | Backend  |
| API service          | `paymentApi.ts` — createInvoice, getPaymentStatus, verifyPayment                                                                                              | Frontend |
| Payment rewrite      | Full rewrite `usePaymentFlow` against real LND backend (testnet). Remove `simulatePayment`, fake BOLT11. Discriminated union return type (not `as` assertion) | Frontend |
| Post.tsx             | Wire `// TODO: Implement payment` — inline payment modal with amount selection                                                                                | Frontend |
| Creator profiles     | Wire `useCreatorProfile` to real backend. Replace mock profile data                                                                                           | Frontend |
| Webhook verification | HMAC-verified payment webhook. No replay attacks                                                                                                              | Backend  |
| Tests                | Unit tests for payment + profile hooks. E2E: `payment.auth.spec.ts`, `profile.auth.spec.ts`                                                                   | QA       |

### Key risk

P1 security: mock BOLT11 generation (`lightning-payment-service.ts:592-596`) must be removed. Payment amount must be server-validated (no client-side manipulation). Testnet only.

---

## Slice 5: Business Manager MVP (Squad A, Sprint 2)

**Definition of done**: Revenue dashboard shows real income breakdown. Invoices can be created with Lightning payment links. Contract template library browsable. Tax summary shows categorized income. E2E spec.

### What needs building

| Layer              | Work                                                                              | Owner              |
| ------------------ | --------------------------------------------------------------------------------- | ------------------ |
| Shared types       | `finance.ts` — Invoice, ContractTemplate, RevenueBreakdown, TaxSummary            | Backend            |
| API service        | `businessApi.ts` — invoices, revenue, contracts, tax                              | Frontend           |
| Revenue dashboard  | Wire RevenueAnalytics to real data. Concentration risk warning if any source >50% | Frontend           |
| Invoice creation   | Create/list/status with embedded Lightning payment link                           | Backend + Frontend |
| Contract templates | Seed 3 templates. Read-only browse. Red-flag analyzer is v2.1                     | Frontend + Backend |
| Tax summary        | Categorize Lightning payments by type. BTC/USD conversion (1-hour granularity)    | Backend            |
| Tests              | Unit tests for business hooks. E2E: `business.auth.spec.ts`                       | QA                 |

---

## Slice 6: Comments (Squad B, Sprint 2)

**Definition of done**: Users can read and post comments on content. Comments stored in Supabase. Server-side XSS sanitization. Moderation (creator can delete). E2E spec.

### What needs building

This is a NEW BUILD from scratch — no comments backend, types, API service, hooks, or components exist.

| Layer              | Work                                                             | Owner              |
| ------------------ | ---------------------------------------------------------------- | ------------------ |
| Database           | `comments` table, indexes, RLS policies                          | Backend            |
| Shared types       | `community.ts` — Comment, CommentThread                          | Backend            |
| Backend routes     | CRUD endpoints: GET/POST/DELETE `/api/v2/comments/:contentId`    | Backend            |
| XSS sanitization   | Server-side DOMPurify before storage + client-side before render | Backend + Frontend |
| API service        | `commentsApi.ts`                                                 | Frontend           |
| UI components      | Comment thread, comment form, empty state, delete confirmation   | Frontend           |
| Optimistic updates | `useMutation` with optimistic insert on post, rollback on error  | Frontend           |
| Tests              | Unit + integration tests. E2E: `comments.auth.spec.ts`           | QA                 |

---

## Slice 7: Shield + Business Advanced (Squad A, Sprint 3)

**Definition of done**: Burnout risk score calculated from real data. Scheduling recommendations based on posting history. Creator Boundaries persist across sessions. Tax export improvements.

| Layer                      | Work                                                                                                                                   | Owner              |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| Burnout scoring            | Algorithm-based (spike in posts + engagement drop + irregular hours = elevated risk). Score 0-100. "Not enough data" state for <7 days | Backend            |
| BullMQ batch job           | Daily burnout score refresh for all active creators                                                                                    | Backend            |
| Scheduling recommendations | Analyze post frequency vs engagement. Suggest optimal cadence                                                                          | Backend + Frontend |
| Creator Boundaries         | Focus hours, auto-replies, DND mode — persist via `/api/v2/wellness/boundaries`                                                        | Backend + Frontend |
| Wellness Pulse             | Weekly check-in (energy/motivation/stress 1-5) stored and trended                                                                      | Frontend + Backend |
| Tests + E2E                | Integration tests for burnout scoring. E2E: update `wellness.auth.spec.ts`                                                             | QA                 |

---

## Slice 8: Creator Network + Notifications (Squad B, Sprint 3)

**Definition of done**: Creator Circles (create/join/browse). Follow/unfollow persisted. Mentorship directory (browse + request only). Notification center wired to real events.

| Layer           | Work                                                                                               | Owner              |
| --------------- | -------------------------------------------------------------------------------------------------- | ------------------ |
| Shared types    | Extend `community.ts` — Circle, CircleMember, FollowRelationship, MentorProfile, NotificationEvent | Backend            |
| API service     | `networkApi.ts` — circles, follow, mentors. `notificationsApi.ts` — notifications                  | Frontend           |
| Creator Circles | Create, join, browse. Max capacity with waitlist. Circle messaging deferred to v2.1                | Backend + Frontend |
| Follow/Unfollow | POST/DELETE `/api/v2/network/follow`. Button state persists                                        | Backend + Frontend |
| Mentorship      | Browse mentors by niche. Request mentorship (pending status). Structured program is v2.1           | Backend + Frontend |
| Notifications   | Wire NotificationCenter to real events via Supabase Realtime. New comments, follows, payments      | Frontend + Backend |
| Tests + E2E     | E2E: `network.auth.spec.ts`                                                                        | QA                 |

---

## Slice 9: Buffer + Hardening (Both Squads, Sprint 4)

**Definition of done**: Full E2E coverage for all shipped slices. Backend test pass rate >95% in owned domains. Load testing results documented. Any slipped Sprint 3 work completed.

This is the buffer sprint. If all prior sprints land on time, this is pure hardening:

| Work                                                                                     | Owner          |
| ---------------------------------------------------------------------------------------- | -------------- |
| Extend all E2E specs (wellness, shield, business, discovery, payment, comments, network) | QA (both)      |
| Backend test remediation in owned domains                                                | Backend (both) |
| Load testing: 100 concurrent creators on key endpoints                                   | QA (both)      |
| Production monitoring dashboards per squad's endpoints                                   | Backend (both) |
| `/workflows:review` final pass on all merged code                                        | Both squads    |
| Overflow from any Sprint 3 work that slipped                                             | As needed      |

---

## Cross-Squad Dependencies

```
Sprint 0 Day 1 (shared):
  PaymentProcessingService fix ─── Squad B executes, Squad A reviews (one fix, not two)
  ADR decisions ────────────────── Both architects attend, written output Day 1
  apiClient/queryClient cleanup ── One frontend dev, benefits both squads

Sprint 0-1:
  packages/shared/src/types/ ──── Both squads add domain-specific type files (no overlap)
  BullMQ infrastructure ────────── Squad B backend sets up in Sprint 0; Squad A needs it Sprint 3

Sprint 2-3:
  Creator profiles (Squad B S1) ── Squad A S3 burnout benchmarking needs real profile data (soft dependency)
```

No hard cross-squad blockers after Day 1 ADRs and PaymentProcessingService fix. Types files are per-domain (wellness.ts, discovery.ts, etc.) — no merge conflicts.

---

## Points Summary

| Sprint            | Squad A | Squad B | Ceiling | Verdict                    |
| ----------------- | ------- | ------- | ------- | -------------------------- |
| 0 (prerequisites) | 2       | 2       | —       | Shared Day 1               |
| 0 (slice)         | 10      | 10      | 12      | OK                         |
| 1                 | 10      | 10      | 12      | OK                         |
| 2                 | 10      | 10      | 12      | OK                         |
| 3                 | 10      | 10      | 12      | OK                         |
| 4 (buffer)        | 8       | 8       | 12      | Intentionally under-scoped |

Ceiling = 12 points per sprint for a 4-person team including review + gate verification.

---

## Pre-Sprint Checklist

Before Sprint 0 Day 1:

- [ ] Both architects have prepared ADR-003 (BullMQ) and ADR-005 (REST+Zod) recommendations
- [ ] Squad B backend dev has located PaymentProcessingService mock regression
- [ ] Testnet Lightning confirmed (Open Question resolved)
- [ ] Frontend dev has read `queryClient.ts` and `apiClient.ts` for Day 1 prerequisites
- [ ] All agents have read `docs/solutions/patterns/critical-patterns.md` (MANDATORY)
- [ ] P1 security prerequisites from prior reviews resolved or explicitly scoped into Sprint 0
