---
status: pending
priority: p1
issue_id: '137'
tags:
  - code-review
  - round-7
  - security
  - auth
  - jwt
dependencies: []
---

# 137: Role Escalation via JWT Refresh — Stale Permissions Preserved

## Problem Statement

When a JWT token is refreshed, the user's role from the original token is preserved without re-querying the database. If a user's role has been downgraded (e.g., creator demoted to regular user, admin revoked), they retain elevated privileges until the token naturally expires.

**Why it matters**: Revoked privileges persist for the full token lifetime (potentially hours). Combined with todo 135 (auth bypass on payouts), a demoted creator could continue requesting payouts.

## Findings

**Security Sentinel (Round 7)**: Flagged as P1 — role preservation on token refresh enables privilege escalation.

**Location**: `packages/backend/src/services/nostr-auth.ts` — token refresh logic copies role from existing token claims without re-verifying against the user record.

## Proposed Solutions

### Option A: Re-Query Role on Refresh (Recommended)
**Effort**: Small | **Risk**: Low

On token refresh, query the user's current role from Supabase/database instead of copying from the old token.

```typescript
async refreshToken(oldToken: DecodedToken): Promise<string> {
  const currentUser = await this.userService.getById(oldToken.sub);
  return this.signToken({
    sub: oldToken.sub,
    role: currentUser.role, // Fresh from DB, not from old token
    // ...
  });
}
```

**Pros**: Simple fix, authoritative role source
**Cons**: Adds one DB query per refresh (minimal overhead)

### Option B: Short-Lived Tokens + No Refresh
**Effort**: Medium | **Risk**: Medium

Issue tokens with 15-minute lifetime, require full re-authentication after expiry.

**Pros**: Limits stale permission window to 15 minutes
**Cons**: Worse UX (frequent re-auth), higher load on auth system

## Recommended Action

Option A — re-query role on refresh. Simple, effective, no UX impact.

## Technical Details

**Affected Files**:
- `packages/backend/src/services/nostr-auth.ts`

## Acceptance Criteria

- [ ] Token refresh queries current role from database/Supabase
- [ ] Demoted user gets new (lower) role in refreshed token
- [ ] Deleted/suspended user gets 401 on refresh attempt (not a new token)
- [ ] Test: change user role from `creator` to `user`, refresh token, verify `user` role in claims
- [ ] Test: revoked admin gets `user` role token on refresh
- [ ] Test: deleted user attempting refresh gets 401

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-15 | Created from Round 7 security review | JWT refresh must always re-verify permissions from source of truth |
