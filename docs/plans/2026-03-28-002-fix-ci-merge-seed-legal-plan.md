---
title: 'fix: CI fix, merge PRs, resolve 5-wave findings, seed Discover, legal checklist'
type: fix
status: completed
date: 2026-03-28
origin: 5-wave re-review findings (2026-03-28)
---

# CI Fix, Merge PRs, Resolve 5-Wave Findings, Seed Discover, Legal Checklist

## Overview

Ship the remediation work from the prior sprint: fix CI, merge both PRs, resolve the remaining findings from the 5-wave review, seed the Discover page with demo creators, and prepare a legal compliance checklist for the lawyer.

## Problem Frame

PRs #192 and #193 contain all remediation work but CI fails due to a pre-existing `actions/cache` SHA resolution error. The 5-wave review found additional P2/P3 issues. The Discover page is empty (the #1 product blocker across all user personas). Legal review found 5 P0 blockers requiring a lawyer.

## Requirements Trace

- R1. CI passes on both PRs — unblock merge
- R2. PRs #192 and #193 merged to main
- R3. Remaining 5-wave technical findings resolved (route order, createRefund IDOR, onboarding step-skip, remaining duplicates)
- R4. Discover page has 5-10 seed creator profiles with sample content
- R5. Legal compliance checklist document ready for lawyer review

## Scope Boundaries

- **Out of scope:** Fiat on-ramp, email signup implementation, @ts-nocheck Tier 3, full DMCA agent registration (lawyer does this)
- **Out of scope:** Implementing legal changes in code — this plan only prepares the checklist

## Key Technical Decisions

- **CI fix approach:** Update the `actions/cache` SHA in `.github/actions/setup-node/action.yml` to a resolvable version (latest v4 SHA)
- **Seed data approach:** Create a seed script that inserts demo creator profiles via Supabase, not hardcoded in frontend components
- **Legal checklist:** Markdown document in `docs/legal/` — not code changes

## Implementation Units

### Phase 1: Unblock CI + Merge (2 units, sequential)

- [ ] **Unit 1: Fix CI — actions/cache SHA**

**Goal:** Update the unresolvable `actions/cache@d4323d4d...` SHA to a valid version so all CI jobs pass

**Requirements:** R1

**Dependencies:** None

**Files:**

- Modify: `.github/actions/setup-node/action.yml` (update cache SHA)
- Possibly modify: `.github/workflows/ci.yml` (if cache is referenced there too)

**Approach:**

- Find all references to `actions/cache@d4323d4d` across `.github/`
- Replace with `actions/cache@v4` (tag-based) or the latest pinned SHA from the actions/cache releases page
- The prior audit pinned GH Actions to SHA commits for security — maintain that practice by using the latest v4 release SHA, not the tag

**Test scenarios:**

- Happy path: CI pipeline passes lint, typecheck, security, test-gate jobs
- Error path: If SHA is still wrong, CI fails at setup-node step with same error

**Verification:**

- `gh run list --limit 1` shows status: success (or at least passes setup-node)

---

- [ ] **Unit 2: Merge PRs #192 and #193**

**Goal:** Merge both remediation PRs to main via merge queue

**Requirements:** R2

**Dependencies:** Unit 1 (CI must pass)

**Files:**

- No code changes — git operations only

**Approach:**

- After CI passes on both branches, merge via `gh pr merge --auto --squash`
- PR #192 (Squad A) first, then PR #193 (Squad B) — Squad B may have merge conflicts that need resolution after Squad A lands
- If conflicts exist on Squad B, rebase onto updated main and re-push
- Run `/watch-ci` after each merge per hook enforcement

**Test scenarios:**

- Happy path: Both PRs merge cleanly, main CI passes
- Edge case: Squad B conflicts with Squad A changes on shared files (Layout.tsx, Login.tsx, Signup.tsx, Home.tsx)
- Error path: Merge queue rejects — investigate failing check

**Verification:**

- Both PRs show "Merged" status on GitHub
- `git log origin/main --oneline -5` shows both merge commits
- Main branch CI passes

---

### Phase 2: Resolve 5-Wave Findings (3 units, parallel in Squad A)

- [ ] **Unit 3: Fix route order + createRefund IDOR**

**Goal:** Fix lightning-receipts route shadowing and add ownership check to createRefund

**Requirements:** R3

**Dependencies:** Unit 2 (work on main after merge)

**Files:**

- Modify: `packages/backend/src/routes/lightning-receipts.ts` (move `/health` and `/analytics/summary` above `/:identifier`)
- Modify: `packages/backend/src/controllers/payment/PaymentController.ts` (add ownership check to `createRefund`)

**Approach:**

- Route order: Move the two static routes above the parameterized `/:identifier` route. Express matches top-to-bottom.
- createRefund IDOR: Before calling the refund service, verify `refundData.invoiceId` belongs to `req.user` by fetching the invoice and checking ownership (same dual-ID pattern used elsewhere in the controller)

**Test scenarios:**

- Happy path: GET /api/lightning/receipt/health returns health status without auth
- Happy path: GET /api/lightning/receipt/analytics/summary requires admin auth
- Error path: GET /api/lightning/receipt/health no longer hits /:identifier handler
- Happy path: createRefund with own invoice succeeds
- Error path: createRefund with another user's invoice returns 403

**Verification:**

- Route order verified by reading the file — static routes appear before parameterized
- Refund endpoint has ownership check

---

- [ ] **Unit 4: Fix onboarding step-skip + remaining duplicates**

**Goal:** Fix onboarding logic gap (skip before key gen) and delete remaining 47 duplicate files

**Requirements:** R3

**Dependencies:** Unit 2

**Files:**

- Modify: `packages/frontend/src/components/onboarding/SovereignOnboarding.tsx` (guard skip — require key generation before advancing past step 1)
- Delete: Remaining 47 macOS duplicate files (23 source + 24 e2e)

**Approach:**

- Onboarding: Add guard — if `nostrKeys` is null, disable "Skip" and "Continue" buttons on the identity step. Add floor check on back button (`Math.max(0, currentStep - 1)`)
- Duplicates: `find packages/ -name "* 2.*" -o -name "* 3.*"` → verify with `grep -r` → delete

**Test scenarios:**

- Happy path: Onboarding advances through 5 steps sequentially
- Edge case: Back button at step 0 stays at step 0 (no negative index)
- Error path: Skip on identity step without generating keys is disabled
- Happy path: No duplicate files remain after cleanup

**Verification:**

- `find packages/ -name "* 2.*" -o -name "* 3.*"` returns empty
- Onboarding skip button disabled when keys are null

---

- [ ] **Unit 5: Add localStorage validation + missing a11y items**

**Goal:** Validate localStorage profile data, add aria-current to nav, make onboarding cards keyboard-accessible

**Requirements:** R3

**Dependencies:** Unit 2

**Files:**

- Modify: `packages/frontend/src/pages/ProfileDashboard.tsx` (validate JSON.parse output with type guard)
- Modify: `packages/frontend/src/components/ui/Layout.tsx` (add `aria-current="page"` on active nav link)
- Modify: `packages/frontend/src/components/onboarding/SovereignOnboarding.tsx` (add role="button", tabIndex, onKeyDown to Creator/Supporter cards)

**Approach:**

- ProfileDashboard: Wrap `JSON.parse(savedProfile)` in try/catch with type validation before calling `setProfile`
- Layout: Add `aria-current={isActive(item.path) ? 'page' : undefined}` to both sidebar and mobile nav Links
- Onboarding: Add keyboard handlers (Enter/Space) to the selection cards, or change Card to render as button

**Test scenarios:**

- Happy path: Valid profile in localStorage renders correctly
- Error path: Malformed JSON in localStorage doesn't crash the page
- Happy path: Active nav link has aria-current="page"
- Happy path: Creator/Supporter cards activatable via Enter key

**Verification:**

- `localStorage.setItem('sovren_user_profile', 'garbage')` → page doesn't crash
- Active nav link has aria-current attribute in DOM

---

### Phase 3: Seed Discover Page (1 unit)

- [ ] **Unit 6: Create demo creator seed data**

**Goal:** Populate the Discover page with 5-10 realistic demo creator profiles so the platform doesn't feel empty

**Requirements:** R4

**Dependencies:** Unit 2 (main must be up to date)

**Files:**

- Create: `scripts/seed-demo-creators.ts` (TypeScript script using Supabase client to insert demo data)
- Create: `packages/frontend/src/data/demo-creators.ts` (fallback static data if API is down)
- Modify: `packages/frontend/src/features/discovery/components/DiscoveryPage.tsx` (use static fallback when API returns empty/error)

**Approach:**

- Create 8 diverse demo creator profiles spanning categories: Art (digital illustrator), Writing (poet), Music (indie musician), Education (Bitcoin educator), Photography (landscape), Development (open source), Podcast (tech commentary), Bitcoin (Lightning developer)
- Each profile has: displayName, bio, avatar URL (placeholder), category, follower count, content count, sample content titles
- Frontend fallback: when API returns error or empty, show the static demo data with a subtle "Demo profiles" badge
- Seed script uses Supabase JS client to insert into the creators/users table

**Test scenarios:**

- Happy path: /discover shows 8 creator cards with names, bios, categories
- Happy path: Category filter shows only matching creators
- Happy path: Search filters by name/bio text
- Edge case: When API is down, fallback demo data renders
- Edge case: Demo badge visible on fallback profiles

**Verification:**

- Navigate to /discover — 8 creator cards visible
- Click "Art" category — filtered to art creators
- Demo creators span all major categories

---

### Phase 4: Legal Compliance Checklist (1 unit)

- [ ] **Unit 7: Prepare legal compliance checklist for lawyer**

**Goal:** Create a structured document listing all legal/compliance gaps found by the Wave 5 Legal reviewer, with specific actions needed from a lawyer

**Requirements:** R5

**Dependencies:** None — can run in parallel with everything

**Files:**

- Create: `docs/legal/compliance-checklist-2026-03-28.md`

**Approach:**

- Structured document organized by domain (ToS, Privacy, Payments, Content Moderation, Accessibility)
- Each item has: current status, gap description, required action, who acts (lawyer vs dev team), priority
- Based entirely on the Wave 5 Legal/Compliance reviewer's findings
- No code changes — this is a document for the lawyer

**Test scenarios:**

- N/A — document only

**Verification:**

- Document exists at `docs/legal/compliance-checklist-2026-03-28.md`
- Covers all 5 domains from the legal review
- Each gap has a clear action item and owner

---

## Risks & Dependencies

| Risk                                                        | Mitigation                                                       |
| ----------------------------------------------------------- | ---------------------------------------------------------------- |
| CI fix may require multiple SHA attempts                    | Check actions/cache releases page for latest v4 SHA              |
| PR #193 may conflict with #192 on shared files              | Rebase Squad B onto updated main after Squad A merges            |
| Demo creator data may look fake/unconvincing                | Use realistic bios and diverse categories — not "Test Creator 1" |
| Legal checklist may miss jurisdiction-specific requirements | Mark as "initial assessment — lawyer to expand"                  |

## Sources & References

- 5-wave review findings (this conversation, 2026-03-28)
- PR #192: https://github.com/zone17/sovren/pull/192
- PR #193: https://github.com/zone17/sovren/pull/193
- Legal review: Wave 5 Legal/Compliance agent output
- Prior plan: `docs/plans/2026-03-28-001-fix-full-production-readiness-roadmap-plan.md`
