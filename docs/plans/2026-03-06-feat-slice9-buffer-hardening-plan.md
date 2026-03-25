---
title: 'Slice 9: Buffer + Hardening'
type: feat
date: 2026-03-06
squad: squad-a
branch: feat/squad-a/S9-buffer-hardening
deepened: 2026-03-06
---

# Slice 9: Buffer + Hardening

## Enhancement Summary

**Deepened on:** 2026-03-06
**Research agents used:** 7 (E2E specialist, performance engineer, learnings researcher, security sentinel, architecture strategist, simplicity reviewer, TypeScript reviewer)

### Key Changes from Original Plan

1. **Payments E2E removed** — `PaymentHistory` is a sub-component of `/dashboard`, not a standalone page. No payment page route exists. E2E tests should cover it when navigating to dashboard (already partially covered).
2. **Notifications E2E restructured** — `NotificationCenter` is a flyout panel triggered by a bell button in the nav, not a routed page. POM and tests redesigned for panel interaction pattern.
3. **Creator Network E2E refocused** — The feature is a Community hub (Circles, Mentorship, Collaborations, Marketplace) with tab navigation, NOT a creator directory. Follow/unfollow lives in existing `creator-profile.auth.spec.ts`.
4. **Load testing descoped** — Deferred to dedicated sprint. Managed infrastructure (Supabase + Vercel) makes load testing premature without production data volumes and defined SLAs. Load test k6 scripts kept as a small deliverable.
5. **N+1 fix descoped** — Component uses mock data with 5min staleTime. The TODO correctly defers to "when real data is wired." Fixing now = building a batch endpoint for mock data.
6. **SimpleContentEditor TODOs descoped** — All 7 TODOs are "persist via React Query mutation," all blocked on content CRUD API completion.
7. **Payment test harness alignment kept** — Real services, real interfaces, concrete and verifiable.

### New Considerations Discovered

- **Security (Medium)**: Existing `k6/load-test.js` has hardcoded credentials and no production URL guard
- **Architecture**: No `tsconfig.e2e.json` — E2E POMs get zero type checking in CI
- **Performance**: `content-discovery-service.ts` uses `count: 'exact'` (full-table COUNT) and `ILIKE` instead of pg_trgm — not in scope but documented for next sprint

---

## Overview

Harden the Sovren platform for production readiness. Close E2E coverage gaps for features that have real UI, align the payment test harness, and set up load testing infrastructure for future use.

## Definition of Done

- [ ] E2E coverage for all features with existing UI (add Creator Network + Notifications specs)
- [ ] Backend test pass rate >95% (already 99.4% — met)
- [ ] Payment test harness aligned with current service interfaces

## Current State (Research Findings)

### Backend Tests: 99.4% pass rate (DONE)

- 2,544/2,559 pass, 0 failures, 15 skipped
- Already exceeds >95% target — no work needed

### E2E Coverage: 7/10 features covered

- **Covered**: Auth, Home, Navigation, Profile, Settings, Wellness, Content/Discovery
- **Testable but missing**: Creator Network (Community hub), Notifications (flyout panel)
- **Not testable** (no frontend UI): Payments (only `PaymentHistory` sub-component in dashboard, no standalone route)
- 60 tests across 10 spec files, 11 POMs

### Slipped Work (Triaged by Research Agents)

| Item                         | Verdict | Rationale                                                                            |
| ---------------------------- | ------- | ------------------------------------------------------------------------------------ |
| 169 @ts-nocheck files        | DEFER   | Too large for buffer sprint. Add CI ratchet to prevent growth.                       |
| 73 z.any() Zod schemas       | DEFER   | Low risk — mostly internal types. Add size guards on 3-4 API-facing schemas only.    |
| 5 god classes (4,800+ lines) | DEFER   | Backend classes have zero bundle impact. Frontend classes need code-split audit.     |
| SimpleContentEditor 7 TODOs  | DEFER   | All 7 are "persist via mutation" — blocked on content CRUD API                       |
| N+1 AuthenticityBadge        | DEFER   | Mock data, staleTime 5min, only 2 items. Fix when real data is wired (per TODO #620) |
| Payment test harness         | DO      | Real services, concrete alignment needed (emit→publish, ProcessPaymentParams)        |

---

## Plan — 2 Phases

### Phase 1: E2E Coverage (2 new spec files + POMs + tsconfig fix)

#### 1a. Creator Network E2E (`creator-network.auth.spec.ts`)

**What it actually is**: A Community hub with 4 tabs (Circles, Mentorship, Collaborations, Marketplace), NOT a creator directory. Follow/unfollow is in existing `creator-profile.auth.spec.ts`.

**Pre-implementation**: Verify route exists in `App.tsx`. If no route, add `/community` route pointing to `CreatorNetworkDashboard` in the same commit.

POM: `e2e/pages/creator-network.page.ts`

Source components:

- `CreatorNetworkDashboard.tsx` — main container with error boundary
- `CommunityNav.tsx` — tab navigation with `role="tab"` + `aria-selected`
- `CirclesBrowser.tsx` — "Creator Circles" heading, "Join" buttons, "Create Circle" toggle
- `MentorDirectory.tsx` — niche filter (`aria-label="Filter by niche"`), audience filter

Locators (from source code):

```typescript
readonly heading: Locator;           // page.getByRole('heading', { name: /Community/i }).first()
readonly circlesTab: Locator;        // nav tab "Circles" with aria-selected
readonly mentorshipTab: Locator;     // nav tab "Mentorship"
readonly collaborationsTab: Locator; // nav tab "Collaborations"
readonly marketplaceTab: Locator;    // nav tab "Marketplace"
readonly nicheFilter: Locator;       // page.getByRole('textbox', { name: /Filter by niche/i })
readonly audienceFilter: Locator;    // page.getByRole('combobox', { name: /Filter by audience/i })
```

Tests:

- [ ] Community page loads with heading visible
- [ ] Tab navigation — click each tab, verify `aria-selected="true"` changes
- [ ] Collaborations tab shows placeholder text (reliably testable empty state)
- [ ] Mentorship tab shows filter inputs (fill niche filter, verify value accepted)

**Research Insights:**

- Use `Promise.race` pattern from `creator-profile.auth.spec.ts` for "heading or error" disambiguation (component wraps in `CreatorNetworkErrorBoundary`)
- Tab pattern mirrors `business.auth.spec.ts` `switchTab()` — use string literal union type for tab names
- `MentorDirectory` filter may have debounce — use `expect().toPass({ timeout: 3000 })` if asserting results
- Do NOT test circle creation or join (requires backend data)

**Edge Cases:**

- Tab switching with no data — each tab should render its empty/placeholder state
- Error boundary catches — if community service fails, the error UI should be testable

#### 1b. Notifications E2E (`notifications.auth.spec.ts`)

**What it actually is**: A flyout panel triggered by a bell button in the nav, NOT a routed page. No `/notifications` route exists.

**Architecture**: `NotificationCenter` renders as `role="dialog"` with `aria-label="Notification center"`. The bell button has `aria-label="Notifications"` (with dynamic unread count). Panel opens/closes on bell click.

POM: `e2e/pages/notifications.page.ts`

Source components:

- `NotificationCenter.tsx` — panel with filter buttons, settings
- `NotificationBadge.tsx` — `role="status"`, `aria-label="N unread notifications"`
- `NotificationItem.tsx` — uses `window.location.href` (full page reload, NOT SPA nav)
- `NotificationEmpty.tsx` — `role="status"`, `aria-live="polite"`, "No notifications yet"

Locators (from source code):

```typescript
readonly bellButton: Locator;     // page.getByRole('button', { name: /Notifications/i }).first()
readonly panel: Locator;          // page.getByRole('dialog', { name: /Notification center/i })
readonly closeButton: Locator;    // panel.getByRole('button', { name: /Close/i })
readonly emptyState: Locator;     // page.getByRole('status', { name: /No notifications/i })
readonly settingsButton: Locator; // panel.getByRole('button', { name: /Settings/i })
readonly filterAll: Locator;      // panel.getByRole('button', { name: /^All$/i })
readonly filterMentions: Locator; // panel.getByRole('button', { name: /Mentions/i })
```

Tests:

- [ ] Bell button visible in nav
- [ ] Click bell → notification panel dialog opens (`aria-expanded` changes)
- [ ] Close button → panel closes
- [ ] Empty state visible in demo mode ("No notifications yet" with `role="status"`)
- [ ] Filter tabs clickable without error (All, Mentions, Replies, Reactions, Messages, Zaps)

**Research Insights:**

- Do NOT test outside-click to close — fragile with coordinate-based clicks. Use explicit close button.
- Do NOT test real-time notification arrival — requires live NOSTR relay connection
- Do NOT assert specific badge count — in demo mode, count is 0 and badge is conditionally hidden
- NOSTR relay WebSocket connection errors will appear in console — do NOT assert zero console errors
- `NotificationItem` uses `window.location.href` not router — clicking a notification causes full page reload. Only test this with backend data (`test.skip` pattern)
- Filter buttons are `type="button"` without `aria-pressed` — can only verify they're clickable, not active state

**Edge Cases:**

- Badge hidden when count = 0 (conditional render) — test should handle both visible/hidden
- Panel animation timing — use `waitFor({ state: 'visible' })` on dialog element
- Settings sub-panel — verify settings button opens a view change

#### 1c. E2E Infrastructure Fix

**Add `tsconfig.e2e.json`** (from TypeScript reviewer): E2E POMs are outside `src/` and get zero type checking. Must be **standalone** (not extending root tsconfig) to avoid Vite/React type conflicts:

```json
{
  "compilerOptions": {
    "strict": true,
    "lib": ["ES2022", "DOM"],
    "types": ["node"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "noEmit": true
  },
  "include": ["e2e/**/*.ts"]
}
```

**Auth strategy**: Both specs are `.auth.spec.ts` — they use the existing storage state auth pattern. The `chromium-authenticated` project auto-injects saved storage state. No additional auth setup needed.

### Phase 2: Payment Test Harness Alignment

#### 2a. Harness Interface Alignment

The harness at `packages/backend/src/test-utils/payment-test-harness.ts` has two known alignment issues:

1. **`emit()` → `publish()`**: `SubscriptionService` calling convention changed. Update harness EventBus wiring.
2. **`ProcessPaymentParams`**: Payment method signatures changed from `{userId, amount, currency}` to `ProcessPaymentParams` type.

**Research Insights (from learnings researcher):**

- Follow common-solutions #50: real services > vi.fn() for >5-method interfaces
- Follow common-solutions #52: `dispose()` must cover ALL timer services — if any new service was added since PR #102, add to dispose
- Detection: `grep -c 'vi.fn()' path/to/payment-test.ts` — if >5, candidate for harness consolidation
- Runtime guard pattern for `seedRawTransaction` must be preserved (common-solutions #51)

**Security (from security review):**

- Harness uses `InMemoryCacheService` + `TestableEventBus` — no real payment infrastructure exposed. Safe.
- Verify `test-utils/` is excluded from production builds (tree-shaking check)

Tasks:

- [ ] Update EventBus interface (`emit` → `publish`) in harness
- [ ] Update payment method signatures to use `ProcessPaymentParams`
- [ ] Verify `dispose()` covers all 8+ services (check for new timer-based services since PR #102)
- [ ] Run all 317 payment tests — verify pass
- [ ] `grep -rn 'vi.fn()' packages/backend/src/**/*payment*test*` — consolidate any >5-mock files into harness

#### 2b. @ts-nocheck CI Ratchet (if trivial)

Add a single grep + threshold check to existing CI (only if ≤10 lines). Prevents `@ts-nocheck` count from growing beyond 169. If non-trivial, defer.

---

## Commit Strategy

| Commit | Content                                                                                                               |
| ------ | --------------------------------------------------------------------------------------------------------------------- |
| 1      | `tsconfig.e2e.json` (standalone) + Creator Network POM + spec + Notifications POM + spec + route fix (if needed)      |
| 2      | Payment test harness alignment (emit→publish, ProcessPaymentParams, dispose audit) + @ts-nocheck ratchet (if trivial) |

One `/workflows:review` cycle after both commits, before merge.

## Deferred (Not in Scope — Documented with Rationale)

| Item                           | Why Deferred                                                        | Agent Consensus                                                | When                          |
| ------------------------------ | ------------------------------------------------------------------- | -------------------------------------------------------------- | ----------------------------- |
| 169 @ts-nocheck files          | Too large for buffer sprint                                         | 7/7 agree                                                      | Dedicated tech debt sprint    |
| 73 z.any() Zod schemas         | Low risk, mostly internal                                           | 6/7 agree                                                      | Tech debt sprint              |
| 5 god classes                  | No bundle impact (backend)                                          | 7/7 agree                                                      | Dedicated refactor sprint     |
| SimpleContentEditor TODOs      | All blocked on content CRUD API                                     | 7/7 agree (simplicity reviewer: "textbook YAGNI")              | When API ships                |
| N+1 AuthenticityBadge          | Mock data, staleTime 5min, 2 items                                  | 5/7 agree (perf + arch note batch endpoint pattern for future) | When real data wired          |
| Payments E2E                   | No standalone payment page/route exists                             | 6/7 agree                                                      | When payment UI feature ships |
| Load test scaffold + execution | YAGNI — scaffold rots before use, write in an afternoon when needed | 8/10 agree (DHH + Simplicity + 5/7 deepen)                     | When SLAs defined post-launch |
| `count: 'exact'` in discovery  | Performance risk at scale but not blocking now                      | Perf reviewer flagged                                          | Next performance sprint       |

## Verification

1. `npm run test:e2e` — all specs pass (existing 60 + ~9 new)
2. `npm test` — backend pass rate remains >99%
3. `npx tsc -p packages/frontend/tsconfig.e2e.json --noEmit` — E2E type checking passes
4. Payment harness: all 317 tests pass after alignment
5. CI green on PR

## References

### Institutional Learnings Applied

- common-solutions #26: E2E must not mock API — zero `page.route()` calls
- common-solutions #30: Convention-based spec naming — `.auth.spec.ts` / `.public.spec.ts`
- common-solutions #50: Real services > vi.fn() for >5-method interfaces
- common-solutions #52: dispose() must cover all timer services
- common-solutions #82: Loading state must not hide structural UI
- common-solutions #90: Verify navigated routes exist in App.tsx
- critical-patterns #4c: Compensation can fail — destructure error, log, rethrow original

### Key Files

- E2E POMs: `packages/frontend/e2e/pages/`
- Creator Network: `packages/frontend/src/features/creator-network/components/`
- Notifications: `packages/frontend/src/features/nostr/notifications/components/`
- Payment History: `packages/frontend/src/components/lightning/PaymentHistory.tsx`
- Payment Harness: `packages/backend/src/test-utils/payment-test-harness.ts`
- Pattern files: `docs/solutions/patterns/critical-patterns.md`, `common-solutions.md`
- Existing k6 scripts: `packages/backend/performance/k6/load-test.js`
