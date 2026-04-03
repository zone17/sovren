---
title: 'PRA2: JWT Cookie Migration, Buffer Polyfill, WCAG, Product/UX — 14-Unit Remediation'
date: '2026-03-28'
category: security-issues
module: sovren/auth-security
problem_type: security_issue
component: authentication
severity: critical
last_updated: '2026-03-28'
symptoms:
  - 'JWT tokens stored in localStorage — accessible to XSS, full account takeover'
  - 'Buffer.from() crashes signup in browsers — Node.js API unavailable in Vite builds'
  - 'NOSTR event kind 1 used for auth instead of kind 22242 — backend verification always fails'
  - 'CSRF exclusions missing after cookie migration — all POST requests return 403'
  - 'PaymentController IDOR: hex pubkey compared against UUID — check always false'
  - 'process.env.REACT_APP_* in production Vite build — resolves to undefined'
  - 'WCAG AA compliance ~56% — no skip nav, no page titles, spinners invisible to screen readers'
  - 'No Settings, Terms, Privacy, or Help pages — legal compliance gap'
root_cause: wrong_api
resolution_type: code_fix
related_components:
  - payments
  - frontend_stimulus
  - service_object
tags:
  - jwt
  - httponly-cookies
  - csrf
  - nostr
  - lightning
  - idor
  - buffer-polyfill
  - wcag
  - accessibility
  - production-readiness
  - sovren
---

# PRA2: JWT Cookie Migration, Buffer Polyfill, WCAG, Product/UX — 14-Unit Remediation

## Problem

Sovren's second production readiness audit (3-wave, 12-agent, 2026-03-28) found 8 P0/Critical, 12 P1, 36+ P2, and 17+ P3 findings across security, frontend, backend, accessibility, performance, and product/UX. No user journey was completable end-to-end. User testing showed Product Manager 5.8/10, Creator (Maya) 4/10, New User (Sarah) 3/10.

## Symptoms

- **JWT in localStorage**: Any XSS vulnerability = full account takeover (steal token from `localStorage.getItem('auth_token')`)
- **Buffer.from() in browser**: `ReferenceError: Buffer is not defined` crashes NOSTR key generation on signup/login in all browsers
- **Wrong NOSTR event kind**: Signup signs `kind: 1` (text note) but backend expects `kind: 22242` (NIP-42 auth) — signature verification always fails
- **Env var convention**: 6 files use `process.env.REACT_APP_*` / `process.env.NEXT_PUBLIC_*` — always `undefined` in Vite production builds, falling back to `localhost:3001`
- **No mobile navigation**: At 375px viewport, public nav links (Features, How It Works, Discover) completely hidden with no hamburger menu
- **Content detail empty**: `/content/:id` shows only comments section, no actual content display
- **WCAG ~56%**: No skip navigation, no page titles, spinners invisible to screen readers, low contrast on interactive elements

## What Didn't Work

1. **First remediation pass missed NOSTR content hash mismatch**: Signup.tsx signed the raw challenge string as `content`, but the backend reconstructs `content` as `createSignatureMessage(challenge, timestamp)` — a SHA-256 hash of a formatted message. CE Review caught this as a P0 blocker that would have broken ALL signups.

2. **CSRF regression from cookie migration**: After moving JWT from Bearer header to HttpOnly cookies, the CSRF middleware's Bearer-skip logic no longer applied. All POST/PUT/DELETE requests from cookie-authenticated users would get 403 `CSRF token missing`. CE Review caught this before merge.

3. **PaymentController type mismatch**: Ownership checks compared `req.user.nostr_pubkey` (64-char hex) against `invoice.userId` (UUID). These are structurally different types — the check always evaluates to `false`, silently blocking legitimate users from their own invoices. CE Review caught this.

4. **Security re-auditor reviewed wrong worktree**: Squad A worktree didn't have Squad B's fixes (Lightning receipt auth, token revocation). The auditor reported 2 FAILs that were actually fixed — just in the other worktree.

5. **Linear task-sync hook wrong field name**: Hook extracted `tool_input.title` but `TaskCreate` sends `tool_input.subject`. All task→Linear syncs silently failed for the entire sprint until manually debugged.

## Solution

14 implementation units across 6 phases, executed by domain-grouped parallel agents in 2 worktrees (Squad A + Squad B), with CE Review between implementation and merge.

### Phase 1: P0 Critical (Units 1-2, parallel)

- **JWT → HttpOnly cookies**: Backend sets `Set-Cookie: sovren_token=<jwt>; HttpOnly; Secure; SameSite=Strict; Path=/api; Max-Age=86400`. Frontend sends `credentials: 'include'`. Auth middleware reads `req.cookies.sovren_token` with Bearer fallback.
- **Buffer.from → browser-native hex**: Created `shared/utils/hex.ts` with `bytesToHex()` and `hexToBytes()`. Replaced all 7 frontend files.
- **NOSTR kind fix**: Changed `kind: 1` → `kind: 22242`, timestamp `Date.now()` → `Math.floor(Date.now() / 1000)`. Called `createSignatureMessage()` for event content.
- **Email tab removed**: "Email signup coming soon" note replaces deceptive form.
- **Env vars fixed**: All 6 files converted to `import.meta.env.VITE_*`.
- **WCAG P0**: Skip navigation, `useDocumentTitle()` hook, spinner `role="status"`, contrast fixes (`text-white/40` → `/60+`), mobile menu Escape + focus management.

### Phase 2: P1 Hardening (Units 3-5, parallel)

- **Lightning receipt auth**: `authenticate` middleware on all 6 handlers + IDOR ownership checks (creator/supporter/admin).
- **Token refresh revocation**: `refreshJWT()` calls `revokeToken(oldToken)` after issuing new token. Re-reads role from database.
- **Admin role**: Added `'admin'` to JWT Zod enum and `VALID_JWT_ROLES` set.
- **Challenge store → Redis**: 5-minute TTL, in-memory fallback (same pattern as token revocation).
- **Rate limiting**: Subscription tiers router-level `60 req/min`.
- **Idempotency key validation**: UUID v4 format, 64-char max.
- **Mobile hamburger menu**: Public nav links accessible at `<768px`.
- **Content detail page**: Full content display (title, author, body, media) + proper 404 state.
- **NOSTR key validation**: bech32 `npub1`/`nsec1` prefix check on Login + Signup.
- **Code hygiene**: 28 macOS duplicate files deleted, @ts-nocheck removed from 8 security-critical files (108 type errors fixed), CI ratchet baseline set.

### Phase 3-4: Accessibility + Product/UX (Units 6-10)

- **WCAG P1**: `aria-required`, `role="tablist"` pattern, `aria-hidden` on decorative SVGs, `role="alert"` on access denied.
- **Settings page**: Profile edit (name, bio), wallet config, notification preferences.
- **Terms of Service**: 10 sections covering content ownership, payments, liability.
- **Privacy Policy**: 9 sections, explicitly lists what is NOT collected.
- **Help/FAQ**: 13 questions covering NOSTR, Bitcoin, sats, key loss, fees, wallets.
- **NOSTR explainer**: One-sentence plain English on first mention per page.
- **Onboarding simplification**: 7→5 steps, Lightning wallet optional, time estimates per step.
- **Landing page**: Honest stats, "Why Sovren" comparison table, dual CTAs, proper footer.

### Phase 5: Performance + Polish (Units 11-13)

- **React chunking**: Function-based `manualChunks` separating React from router.
- **Source maps**: `sourcemap: false` in production (was `'hidden'`).
- **CreatorCard memoized**: `React.memo()` wrapper.
- **Per-route Suspense**: Layout shell stays visible during navigation.
- **@ts-nocheck Tier 2**: 21 more files cleaned, baseline 170→78.

### CE Review Findings (caught before merge)

- **P0**: NOSTR content hash mismatch — Signup/Onboarding signed raw challenge, backend expected formatted message
- **P1**: `verifyAuth()` early-exits for all cookie users (getToken returns null)
- **P1**: `secure` cookie flag missing in staging
- **P1**: 3 IDOR gaps on Lightning receipt email/verify endpoints
- **P1**: PaymentController hex pubkey vs UUID comparison
- **P2**: CSRF broken for cookie-auth users (auth endpoints not excluded)
- **P2**: `dangerouslySetInnerHTML` without DOMPurify on ContentDetail
- **P2**: WebSocket auth broken after token-in-URL removal
- **P2**: `getCurrentUser()` returns hardcoded dummy
- **P2**: `hexToBytes()` non-null assertion throws on empty input

All findings remediated before re-audit.

## Why This Works

The core failure pattern was **wrong API primitives at every layer**:

- `localStorage` instead of HttpOnly cookies for JWT storage
- `Buffer.from()` (Node.js) instead of `Uint8Array` manipulation (browser-native)
- `kind: 1` (text note) instead of `kind: 22242` (NIP-42 auth)
- `process.env.REACT_APP_*` (CRA/Next.js) instead of `import.meta.env.VITE_*` (Vite)
- Bearer header CSRF skip assumed when auth moved to cookies

Each fix replaced the wrong primitive with the correct one for the platform context. The CE Review step caught cascading effects the implementers missed — CSRF regression, content hash mismatch, type system gaps — validating the "~80% plan+review, ~20% coding" philosophy.

## Prevention

### Process

- **CE Review is mandatory before merge** — this sprint proved it catches P0 blockers (NOSTR hash mismatch would have broken all signups)
- **Post-remediation re-audit is mandatory** — confirmed for the 3rd consecutive sprint. Last sprint found 1 P0 + 18 P1 in the fixes themselves
- **When migrating auth transport (Bearer → cookies), audit ALL downstream effects**: CSRF middleware, WebSocket auth, analytics user identity, session validation, CORS credentials

### Technical

- **NOSTR event construction must match backend verification**: `kind: 22242`, `content: createSignatureMessage(challenge, timestamp)`, timestamp in seconds (not milliseconds)
- **Never use Node.js-only APIs in browser code**: `Buffer`, `crypto.createHash`, `process.env`. Use browser-native alternatives: `Uint8Array`, `crypto.subtle`, `import.meta.env`
- **Cross-worktree security audits**: When using persistent worktrees (Squad A/B), security reviewers must examine ALL worktrees, not just the one they're assigned to. A fix in Squad B is invisible to an auditor reviewing Squad A
- **Linear hook field names must match tool schema**: Claude Code's `TaskCreate` sends `subject` (not `title`). Verify against actual tool parameters, not assumed conventions

### Code

- **JWT cookie attributes**: `httpOnly: true`, `secure: NODE_ENV === 'production' || NODE_ENV === 'staging'`, `sameSite: 'strict'`, `path: '/api'`
- **CSRF exclusions for auth endpoints**: `/api/auth/verify`, `/api/auth/refresh`, `/api/auth/logout` must be excluded when using cookie-based auth
- **Hex conversion without Buffer**: `Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('')`
- **Ownership checks must use dual-ID pattern**: Compare against both `req.user.nostr_pubkey` (hex) AND `req.user.id` (UUID) since storage may use either format

## Related Issues

- **Prior cycle**: `docs/solutions/infrastructure-issues/production-readiness-full-cycle-red-to-green-20260326.md` — Wave 1-4 (PRs #171-186), 157 findings
- **Wave 1-2 record**: `docs/solutions/infrastructure-issues/production-readiness-audit-remediation-5pr-43fixes-20260325.md`
- **JWT prior fix**: `docs/solutions/security-issues/p1-critical-fixes-pr73-round4.md` — JWT secret regeneration bug
- **NOSTR verifyEvent**: `docs/solutions/security-issues/nostr-verifyevent-requires-computed-id-20260224.md`
- **CE Review pattern**: `docs/solutions/workflow-issues/structural-gates-miss-behavioral-p1s-team-builder-20260215.md`
- **Dead code cleanup**: `docs/solutions/code-quality/p3-sprint1-cleanup-dead-code-architecture.md`
- PRs: #192 (P0 fixes), #193 (P1 hardening)
- Plan: `docs/plans/2026-03-28-001-fix-full-production-readiness-roadmap-plan.md`

## Results

| Metric                 | Before             | After                              |
| ---------------------- | ------------------ | ---------------------------------- |
| Security findings      | 3 CRITICAL, 6 HIGH | 8/10 PASS (2 in separate worktree) |
| WCAG AA compliance     | ~56%               | ~78% estimated                     |
| Product Manager score  | 5.8/10             | 7.8/10                             |
| Creator (Maya) score   | 4/10               | 6.5/10                             |
| New User (Sarah) score | 3/10               | 7/10                               |
| @ts-nocheck files      | 170                | 78                                 |
| Duplicate files        | 175                | 47 remaining                       |
| Files changed          | —                  | 49 across 14 units                 |
| PRs                    | —                  | #192 + #193                        |
