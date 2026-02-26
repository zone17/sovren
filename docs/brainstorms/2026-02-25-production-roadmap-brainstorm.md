# Sovren v2.0 Production Roadmap — 2 Squads, Vertical Slices

**Date**: 2026-02-25 | **Updated**: 2026-02-26 (post-review)
**Status**: Brainstorm — next: `/workflows:plan` per sprint
**Review**: DHH, Kieran TypeScript, Code Simplicity — all 3 applied

---

## What We're Building

Ship Sovren v2.0 via vertical slices across 2 parallel squads. Each sprint delivers a complete feature (database → API → UI → tests). No mock data in production. Testnet Lightning only.

The gap: 40+ backend endpoints exist, polished UI exists, but they're not connected. Most features use hardcoded mock data.

---

## Decisions

1. **Vertical slices** — each sprint ships DB to UI to tests, not layers
2. **Domain-scoped API modules** — `wellnessApi.ts` pattern (already exists). No new methods on shared `apiClient.ts`
3. **Auth on Day 1** — Supabase auth + NOSTR NIP-07 signing must work before anything else ships
4. **Testnet only** — no mainnet Lightning in v2.0
5. **Comments in Supabase** — deletable, moderatable. NOSTR mirroring is v2.1
6. **4-person squads** — Architect/opus, Backend/sonnet, Frontend/sonnet, QA/sonnet. Security review via `/workflows:review` (13+ agents), not a persistent role
7. **1-week sprints** — fast feedback, ship something every week
8. **Query key factories per domain** — `queryOptions()` pattern from React Query v5
9. **Redux audit Sprint 0** — inventory Redux slices, decide keep/migrate/delete per slice. React Query owns server state; Redux owns client-only state (theme, sidebar)
10. **Monitoring starts Sprint 0** — health endpoints, structured logging, error tracking

---

## Sprint 0 Prerequisites (Day 1, Before Vertical Slices)

These 5 code fixes unblock all subsequent work. Kieran's review confirmed each is a real bug:

| #   | Fix                                                                                    | Why                                                                                                                | Files                        |
| --- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ---------------------------- |
| 1   | Expose typed HTTP interface on `apiClient.ts`                                          | 13 domain files use `apiClient['request']` bracket notation to bypass `private`. `apiClient.get()` does not exist. | `apiClient.ts`               |
| 2   | Clean 12 `any` types in `queryClient.ts`                                               | React Query v5 has strong generics. Lines 55, 98, 111, 122, 133, 174, 183                                          | `queryClient.ts`             |
| 3   | Fix `FINANCIAL.gcTime: 0` → `60000`                                                    | gcTime:0 garbage-collects cache on unmount → blank screen on back-navigation                                       | `queryClient.ts:44`          |
| 4   | Remove global `keepPreviousData` default                                               | Causes Creator A data to flash when navigating to Creator B's profile                                              | `queryClient.ts:88`          |
| 5   | Delete `(window as any).queryClient` debug globals + redundant `cleanupCache` interval | Dead debug code                                                                                                    | `queryClient.ts:242,268-272` |

Also Day 1: Both architects decide ADRs (job queue: BullMQ, API protocol: REST+Zod). 2-hour timebox.

---

## Squad Assignments

### Squad A: Creator Safety & Money

**Domains**: Auth, Wellness, Content Shield, Business Manager

| Sprint | Slice                    | Ships                                                                                                                                                                 |
| ------ | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0      | **Auth + Wellness MVP**  | Real Supabase auth (kill `mock-jwt-token`). Validate wellness wiring (wellnessApi.ts + 7 hooks already exist). Add loading/error/empty states to 5 components. Tests. |
| 1      | **Content Shield MVP**   | Wire ShieldDashboard/AlertsFeed/FingerprintCoverage to 11 endpoints (containers already built). Authenticity badges. NIP-07 provenance signing.                       |
| 2      | **Business Manager MVP** | Revenue dashboard wired to real data. Invoice creation with LNURL payment links. Contract template browsing (read-only).                                              |
| 3      | **Advanced**             | Burnout risk scoring (algorithm, not ML). Sustainable scheduling from existing data. Creator Boundaries persistence. Tax export.                                      |
| 4      | **Buffer**               | E2E coverage for all Squad A features. Backend test remediation. Load testing. Overflow from any slipped sprint.                                                      |

**Key facts**: `wellnessApi.ts` already exists with all methods + 7 hooks wired. Sprint 0 is validation + testing, not creation. Shield containers are already built with auth guards and loading states — Sprint 1 is wiring, not building. `supabase/migrations/` has 20+ files — no migration directory setup needed.

### Squad B: Growth & Reach

**Domains**: Discovery, Payments/Lightning, Creator Network, Comments

| Sprint | Slice                   | Ships                                                                                                                                       |
| ------ | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 0      | **Discovery MVP**       | Create `discoveryApi.ts` + v2 routes. Full rewrite of `useDiscovery` from useState to React Query. Kill `MOCK_CREATORS`.                    |
| 1      | **Payments + Profiles** | Rewrite `usePaymentFlow` against real LND (testnet). Wire Post.tsx payment TODO. Wire profiles to real data. Remove `simulatePayment` demo. |
| 2      | **Comments**            | Build comments system in Supabase. Comment UI + backend + moderation. XSS sanitization.                                                     |
| 3      | **Creator Network**     | Creator Circles (create/join/browse). Follow/unfollow persisted. Mentorship directory (browse only). Notifications wired.                   |
| 4      | **Buffer**              | E2E coverage for all Squad B features. Backend test remediation. Load testing. Overflow from any slipped sprint.                            |

**Key facts**: Discovery is a FULL REWRITE (99 lines of mock data, no `discoveryApi.ts`, no v2 routes). Payments is 100% mock (`Math.random()` fake BOLT11 — P1 security finding). Comments backend does not exist — new build from scratch.

---

## Coordination Rules

1. **Each domain creates its own API service file** (`wellnessApi.ts`, `discoveryApi.ts`). Never add domain logic to shared `apiClient.ts`.
2. **Merge to main weekly** at sprint end. Squads pull from main at sprint start.
3. **Shared package changes** require passing tests before merge. Type files are per-domain (no overlap).

---

## Gate Criteria (Per Sprint)

```
[ ] Feature works with real backend data (no mock data in production paths)
[ ] Unit tests for new hooks, E2E spec for the shipped slice
[ ] /workflows:review run, all P1s resolved
[ ] No mock data in production code paths (grep MOCK_, simulatePayment, mock-jwt-token)
[ ] PR merged to main
```

Everything else (coverage thresholds, performance budgets, security scanning) enforced by CI, not manual gates.

---

## Timeline

| Week | Squad A                     | Squad B                         | Shipped          |
| ---- | --------------------------- | ------------------------------- | ---------------- |
| 1    | Auth + Wellness (real data) | Discovery MVP (real data)       | 2                |
| 2    | Content Shield MVP          | Payments + Creator Profiles     | 5                |
| 3    | Business Manager MVP        | Comments                        | 7                |
| 4    | Shield + Business Advanced  | Creator Network + Notifications | 10               |
| 5    | Buffer + Polish             | Buffer + Polish                 | Production-ready |

**Exit criteria**: All features wired to real data. E2E coverage for critical flows. Zero P1 security findings. Testnet Lightning payments verified end-to-end.

---

## Deferred to v2.1

| Feature                     | Reason                                                              |
| --------------------------- | ------------------------------------------------------------------- |
| Income Stabilizer           | Depends on Business Manager + Wellness data                         |
| Multi-Platform Hub          | Untested 3rd party APIs, OAuth approvals take weeks, BYOK undefined |
| Burnout prediction ML model | No ML exists. Algorithm-based scoring ships in v2.0                 |
| AI copy detection           | No AI/ML service. Third-party integration costs                     |
| DM chat                     | Full feature (encryption, relay, delivery, read receipts)           |
| Mainnet Lightning           | Testnet only for v2.0. Mainnet with dedicated security review       |
| Content repurposing AI      | MVP covers manual cross-posting if needed                           |

Marketplace/Escrow components exist (MarketplaceBrowser, EscrowStatus, OrderTracker) but have no backend or roadmap. Either plan them for v2.1 or delete.

---

## Risk Register

| Risk                                            | Likelihood | Impact | Mitigation                                                                 |
| ----------------------------------------------- | ---------- | ------ | -------------------------------------------------------------------------- |
| Discovery rewrite larger than "data swap"       | HIGH       | Medium | Full React Query migration (3 layers). Scoped as standalone Sprint 0 slice |
| Comments has no backend                         | HIGH       | High   | Supabase CRUD (decided). Full build from scratch in Sprint 2               |
| Payment mock BOLT11 in production code          | CRITICAL   | High   | P1 — must be removed Sprint 1 before any real payment flow                 |
| Mock auth returns `mock-jwt-token`              | HIGH       | High   | Auth completion is Sprint 0 Day 1 scope                                    |
| Backend test recovery larger than expected      | HIGH       | High   | Top 3 fixes recover ~272 tests. Rest is per-sprint per-domain              |
| `apiClient['request']` bracket hack in 13 files | HIGH       | Medium | Refactor to typed HTTP interface in Sprint 0 Day 1 prerequisites           |

---

## Open Questions

| #   | Question                         | Default                                                         |
| --- | -------------------------------- | --------------------------------------------------------------- |
| 1   | Deployment target?               | Keep Vercel (frontend) + Docker (backend). Staging by Sprint 3  |
| 2   | NOSTR relay: own or public?      | Public relays for v2.0. Own relay is v2.1 if DM chat needs it   |
| 3   | Guest vs authenticated browsing? | Discovery + profiles are public. All write actions require auth |

---

## Companion Documents

- **Story Map**: `docs/planning/story-map-v2-production-roadmap.md` — 10 vertical slices with dependencies
- **Critical Patterns**: `docs/solutions/patterns/critical-patterns.md` (MANDATORY for all agents)
- **Common Solutions**: `docs/solutions/patterns/common-solutions.md`
- **Dependency Update Learnings**: `docs/solutions/infrastructure-issues/dependency-update-pr99-patterns.md`
