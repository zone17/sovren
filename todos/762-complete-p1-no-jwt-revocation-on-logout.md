---
status: pending
priority: p1
issue_id: 762
tags: [code-review, security, authentication, jwt]
dependencies: []
---

# No JWT Token Revocation on Logout

## Problem Statement

The `/api/auth/logout` endpoint only tells the client to delete its token. A stolen JWT remains valid for 24 hours. `UserAuthenticationService` has blacklist methods (lines 210, 389) but they are not wired into the main auth flow.

## Findings

- **Security Agent**: P1-06 — `auth.ts` lines 207-224

## Proposed Solutions

1. Implement Redis-backed token blacklist in `NostrAuthService`
2. On logout, add token's jti to blacklist with TTL matching token expiry
3. In `verifyJWT()`, check blacklist before returning valid

## Acceptance Criteria

- [ ] Logout invalidates the token server-side
- [ ] Blacklisted tokens are rejected on subsequent requests
- [ ] Blacklist entries expire after token TTL
