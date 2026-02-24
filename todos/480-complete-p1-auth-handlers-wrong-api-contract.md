---
status: pending
priority: p1
issue_id: "480"
tags:
  - code-review
  - msw
  - auth
  - api-contract
  - phase-9
dependencies: []
---

# Auth handlers use wrong API contract (email/password instead of NOSTR challenge-response)

## Problem Statement

The MSW auth handlers in `handlers/auth.ts` implement email/password login (`POST /api/auth/login` with `{ token, user }`) and email signup (`POST /api/auth/signup`). The real Sovren backend uses NOSTR challenge-response authentication (`POST /api/auth/challenge` + `POST /api/auth/authenticate` with `{ npub, signature }`). Tests using these handlers will pass against fake contracts that don't exist in production.

**Consensus: 5/7 review agents flagged this as P1.**

## Findings

### Evidence

- `handlers/auth.ts` defines `POST /api/auth/login` returning `{ token, user: { id, email } }` — backend has no `/api/auth/login` endpoint
- `handlers/auth.ts` defines `POST /api/auth/signup` returning `{ token, user: { id, email } }` — backend has no `/api/auth/signup` endpoint
- Real auth flow: `POST /api/auth/challenge` → `{ challenge, expiry }` → sign with NOSTR key → `POST /api/auth/authenticate` → `{ token, user: { npub, pubkey } }`
- Handler includes `/api/auth/challenge` and `/api/auth/authenticate` (correct) alongside the fake ones

### Impact

- Tests mocking login/signup will never catch real auth API regressions
- Future test authors will copy the email/password pattern, compounding the divergence
- Auth handlers partially correct (challenge/authenticate exist) but mixed with incorrect endpoints

## Proposed Solutions

### Option A: Remove fake endpoints, keep only real ones (Recommended)

Remove `POST /api/auth/login`, `POST /api/auth/signup`, `POST /api/auth/register`. Keep `POST /api/auth/challenge`, `POST /api/auth/authenticate`, `POST /api/auth/verify`, `POST /api/auth/logout`, `GET /api/auth/user`. Update response shapes to match real backend.
**Pros:** Single source of truth. No phantom endpoints.
**Cons:** Any future test expecting email/password login will correctly fail (this is desired).
**Effort:** Small
**Risk:** Low — no tests consume these handlers yet.

### Option B: Add JSDoc warnings on fake endpoints

Keep endpoints but mark `@deprecated` with explanation of real auth flow.
**Pros:** Backward compatible.
**Cons:** Deprecated code gets copied. Adds confusion.
**Effort:** Small
**Risk:** Medium — fake endpoints persist.

## Recommended Action

Option A. Remove fake auth endpoints. No consumers exist.

## Technical Details

**Affected files:**
- `packages/frontend/src/test-utils/msw/handlers/auth.ts`

**Endpoints to remove:**
- `POST /api/auth/login`
- `POST /api/auth/signup`
- `POST /api/auth/register`

**Endpoints to keep (and fix response shapes):**
- `GET /api/auth/user`
- `POST /api/auth/challenge` — response: `{ success: true, data: { challenge, expiry } }`
- `POST /api/auth/authenticate` — response: `{ success: true, data: { token, user: { npub, pubkey, displayName } } }`
- `POST /api/auth/verify`
- `POST /api/auth/logout`

## Acceptance Criteria

- [ ] Fake auth endpoints removed from handlers/auth.ts
- [ ] Remaining auth endpoints match real backend API contract
- [ ] Response shapes wrapped in `ApiResponse<T>` envelope (`{ success, data }`)
- [ ] Test baseline unchanged

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-24 | Created from Phase 9 MSW review (5/7 agent consensus) | MSW handlers must mirror real API — phantom endpoints compound |

## Resources

- Commit: e0b2cf0 (MSW infrastructure)
- Backend auth routes: `packages/backend/src/routes/auth.ts`
