---
title: 'Production Readiness: P0/P1 Remediation Sprint (JWT, NOSTR, Lightning, A11y, UX)'
date: 2026-03-28
category: remediation
tags:
  - security
  - auth
  - jwt
  - cookies
  - nostr
  - lightning
  - a11y
  - ux
  - p0
  - p1
  - multi-agent
  - ce-review
  - re-audit
severity: P0
recurrence_risk: high
squads: [squad-a, squad-b]
---

# Production Readiness: P0/P1 Remediation Sprint

## Problem Statement

Sovren had 8 P0/Critical findings blocking production launch, discovered by a 12-agent parallel audit:

| # | Finding | Severity | User Impact |
|---|---------|----------|-------------|
| 1 | JWT stored in localStorage — XSS = full account takeover | P0 | Auth compromise |
| 2 | `Buffer.from()` used in browser — crashes on signup | P0 | Signup broken |
| 3 | Wrong NOSTR event kind (used 1 instead of 22242 for auth) | P0 | Auth handshake fails |
| 4 | Environment variables pointing to localhost in production | P0 | All API calls fail |
| 5 | Lightning payment receipts lack auth — IDOR possible | P0 | Revenue bypass |
| 6 | 170 files with `@ts-nocheck` — type safety gutted | P1 | Hidden runtime errors |
| 7 | 175 duplicate macOS `._*` files checked in | P1 | Build pollution |
| 8 | No legal pages (Terms, Privacy) | P1 | GDPR non-compliant |

User experience scores before remediation:

- Product Manager: 5.8/10
- Creator persona (Maya): 4/10
- New User persona (Sarah): 3/10
- Troll resilience: 7.5/10

---

## Symptoms

- No user journey completable end-to-end
- NOSTR key generation silently fails (Buffer not in browser context)
- Email signup shows form but rejects on submit
- Content detail page shows only comments, no content body
- Mobile nav hidden at 375px with no hamburger menu
- "12,500 creators" stat on landing — fake, destroys trust
- NOSTR never explained in plain English to new users

---

## What Didn't Work (Investigation Detours)

### 1. NOSTR content hash mismatch — first pass missed it

The first remediation pass fixed the NOSTR event kind (1 → 22242) but missed a second mismatch: `Signup.tsx` was signing the raw challenge string, while the backend expected a SHA-256 hash of the challenge as the event content. This caused auth to pass client-side but fail backend verification. CE Review caught it as a P0 in the first PR.

### 2. CSRF middleware regressed after cookie migration

Moving JWT from localStorage to httpOnly cookies required updating CSRF middleware. The Bearer-header skip logic (`if Authorization header present, skip CSRF`) no longer applied — browsers send cookies automatically, not Authorization headers. The middleware was silently accepting all requests as CSRF-exempt. Fixed by removing the stale skip condition and enforcing double-submit cookie pattern.

### 3. PaymentController ownership check was always false

The Lightning receipt auth check compared `payment.nostr_pubkey` (hex string) against `req.user.userId` (UUID). These types never match. The fix required fetching the user's NOSTR pubkey from the users table and comparing like-for-like.

### 4. Security re-audit reviewed only Squad A's worktree

The mid-sprint re-audit agent was spawned from the Squad A worktree context and reviewed Squad A's changes. Squad B's fixes (mobile nav, content page, legal pages) were invisible to it. Post-sprint re-audit had to be run from main after both PRs merged.

### 5. Linear hook extracted wrong field name

The Linear task-sync hook was extracting `title` from the TaskCreate payload, but the actual field is `subject`. All task titles were syncing as `undefined`. Fixed by reading the Linear webhook schema directly.

---

## Solution

14 implementation units across 6 phases, executed by 5 parallel agents across 2 worktrees.

### Phase 1 — P0 Security (Squad A)

**JWT → httpOnly cookies**

```typescript
// Before: localStorage.setItem('token', jwt)
// After:
res.cookie('sovren_session', token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000,
});
```

Key: audit ALL downstream effects — CSRF middleware, WebSocket auth headers, analytics beacon calls all needed updating.

**Buffer → hex utils (browser-safe NOSTR key generation)**

```typescript
// Before: Buffer.from(privateKeyBytes).toString('hex')  // Node-only
// After:
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
```

**NOSTR event kind 22242 + SHA-256 content**

```typescript
const challenge = generateChallenge(); // random nonce
const contentHash = await crypto.subtle.digest(
  'SHA-256',
  new TextEncoder().encode(challenge)
);
const event = {
  kind: 22242,
  content: bytesToHex(new Uint8Array(contentHash)),
  created_at: Math.floor(Date.now() / 1000),
  tags: [['relay', relayUrl], ['challenge', challenge]],
};
```

Backend verifier must SHA-256 the stored challenge and compare against event content.

**Environment variable audit**

Replaced all hardcoded `localhost:*` defaults with explicit production values and added startup validation that throws if required vars are absent.

**Lightning receipt auth + IDOR fix**

```typescript
// Before: payment.nostr_pubkey === req.user.userId  // always false
// After:
const user = await db.users.findById(req.user.userId);
if (payment.nostr_pubkey !== user.nostr_pubkey) {
  throw new ForbiddenError('Payment does not belong to this user');
}
```

### Phase 2 — P1 Quality (Squad A)

- Rate limiting on auth endpoints (10 req/min per IP)
- Token revocation table for logout invalidation
- `@ts-nocheck` Tier 1 removal (highest-risk 40 files)
- Duplicate `._*` macOS files purged via `.gitignore` + git rm

### Phase 3 — Accessibility P0/P1 (Squad B)

- WCAG contrast fixes on primary buttons and text (was 2.1:1, now 4.6:1)
- Form labels connected to inputs with `htmlFor`/`id` pairs
- Focus ring restored (was removed by `outline: none` in global CSS)
- Skip-to-content link added at page top

### Phase 4 — Product Completeness (Squad B)

- Mobile hamburger nav at 375px breakpoint
- Content detail page: fetch and render content body (was only fetching comments)
- Terms of Service, Privacy Policy, Help pages added
- Landing page: replaced "12,500 creators" with "Join early access" CTA
- NOSTR explainer: plain-English "What is NOSTR?" section in onboarding
- Onboarding simplified: 5 steps → 3 steps

### Phase 5 — Performance

- React route-level code splitting (14 chunks → lazy-loaded)
- Source maps enabled for production error tracing
- Memoized expensive creator list renders

### Phase 6 — Validation (4-agent re-audit)

Post-merge re-audit ran against main with all fixes. Results:
- Maya persona: 4 → 6/10
- Sarah persona: 3 → 6/10
- Remaining: 1 P1 (token revocation not enforced on WebSocket upgrade) + 9 P2 — all tracked in backlog

---

## CE Review Findings (Before Merge)

Running `/workflows:review` after implementation, before merging either PR, caught:

| # | Finding | Severity | Agent Consensus |
|---|---------|----------|-----------------|
| 1 | NOSTR content must be SHA-256 of challenge, not raw challenge | P0 | 8/13 agents |
| 2 | CSRF middleware still skips on Authorization header (stale) | P1 | 7/13 |
| 3 | PaymentController pubkey comparison is type mismatch | P1 | 9/13 |
| 4 | WebSocket auth not updated to send cookie | P1 | 6/13 |
| 5 | Token revocation table not checked on refresh | P1 | 7/13 |
| 6+ | 9 P2 findings (error messages, rate limit headers, ...) | P2 | — |

**All P0/P1 findings were remediated before either PR was merged.**

---

## Why This Works

### Domain-grouped agents with non-overlapping file ownership = zero merge conflicts

Squad A owned: `packages/backend/`, `packages/shared/`, `packages/frontend/src/features/auth/`
Squad B owned: `packages/frontend/src/` (excluding auth feature), `docs/`

8 parallel agents, 2 worktrees, zero conflict resolutions needed.

### CE Review after implementation catches bugs the implementers miss

The NOSTR hash mismatch, CSRF regression, and type mismatch in PaymentController were all introduced or left unfixed during the implementation phase. CE Review with 13 parallel agents caught all three before merge. Without this gate, 3 P0/P1s would have shipped.

### Post-remediation re-audit validates from the user's perspective

The re-audit runs as personas (Maya the creator, Sarah the new user) rather than as a code auditor. This catches UX regressions and incomplete flows that code review misses. Pattern confirmed across 3 consecutive sprints: always run the persona re-audit after bulk fixes.

### Worktrees keep main clean

Both squads worked in isolated worktrees. Main was never in a broken state. This is critical for a trunk-based development model where staging deploys from main.

---

## Prevention Rules (New and Confirmed)

### RULE: Always run CE Review before merging auth migrations

When migrating auth storage (localStorage → cookies, or any auth mechanism change), the blast radius is non-obvious. CE Review with 13 agents surfaces the downstream effects that the implementer cannot enumerate alone.

### RULE: NOSTR event construction must be verified against backend expectations

NOSTR auth events have three fields that must match exactly between client and server: `kind`, `content` (format and encoding), and timestamp units (seconds, not ms). Any mismatch fails silently on the client. Write a shared `buildAuthEvent()` util used by both sides.

### RULE: Post-remediation re-audit is mandatory (not optional)

3 consecutive sprints confirmed: bulk fixes introduce new P1s. The post-remediation re-audit has caught at least 1 new P0 or P1 in every sprint it has run.

### RULE: Security auditors must list which worktrees they reviewed

Add to the re-audit brief: "List every worktree path you have read from." If a worktree is not listed, explicitly fetch and review it. Invisible worktrees = invisible bugs.

### RULE: Verify Linear webhook field names against the actual schema

`title` vs `subject`, `assigneeId` vs `assignee.id` — these differ by webhook version. Always test with a real webhook payload in staging before relying on field extraction in production hooks.

### RULE: When comparing identifiers, verify they are the same type

Don't compare a NOSTR pubkey (hex string) against a Supabase userId (UUID). Fetch the user record and extract the same field type. Add TypeScript nominal typing or a branded type to make cross-type comparisons a compile error.

---

## Patterns Added / Updated

### New pattern: Browser-safe crypto utilities (added to common-solutions.md #XX)

```typescript
// packages/shared/src/utils/crypto.ts
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return bytesToHex(new Uint8Array(buf));
}
```

Never use `Buffer` in browser code. `crypto.subtle` is available in all modern browsers and in Node 18+.

### New pattern: Auth migration audit checklist (added to critical-patterns.md)

When changing auth storage/mechanism, audit:
1. CSRF middleware — does the skip condition still apply?
2. WebSocket upgrade — does it send the auth credential the new way?
3. Analytics/beacon calls — do they include auth?
4. Token revocation — is revocation checked at every auth verification point?
5. Logout — does it clear the new storage location?

### Updated pattern: NOSTR auth event construction (#XX in critical-patterns.md)

`kind: 22242`, `content: sha256Hex(challenge)`, `created_at: Math.floor(Date.now() / 1000)`.
Both client and server must use the same shared utility. Divergence fails silently.

---

## Metrics

| Metric | Before | After |
|--------|--------|-------|
| P0 findings | 8 | 0 |
| P1 findings | 12 | 1 (WebSocket revocation) |
| Maya score | 4/10 | 6/10 |
| Sarah score | 3/10 | 6/10 |
| WCAG contrast ratio (buttons) | 2.1:1 | 4.6:1 |
| @ts-nocheck files | 170 | 130 |
| Legal pages | 0 | 3 |
| Mobile nav at 375px | broken | hamburger working |

---

## Remaining Work (Tracked in Backlog)

- Token revocation not enforced on WebSocket upgrade (P1)
- @ts-nocheck Tier 2 removal — remaining 130 files (P2, 3 sprints)
- NOSTR key encryption at rest — `npm run production:encrypt` (manual step)
- RLS policies — apply manually in Supabase dashboard
- WCAG P2 — keyboard nav on creator cards, aria-live for real-time updates
