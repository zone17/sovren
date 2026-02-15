---
status: complete
priority: p1
issue_id: "088"
tags: [code-review, security, authentication, privilege-escalation]
dependencies: []
---

# 088: Client-Controlled Role Privilege Escalation

## Problem Statement

The authentication system accepts a `role` field directly from the client request body and includes it in the JWT without validation against a trusted source. A malicious user can send `role: 'admin'` in their authentication request and receive an admin JWT token, granting unauthorized administrative privileges.

## Findings

**Location**: `packages/backend/src/routes/auth.ts`

- **Line 31**: Zod schema accepts `role: z.enum(['user', 'creator', 'admin']).optional()`
- **Line 81**: Role is passed directly into JWT generation: `nostrAuth.generateJWT(verification.pubkey, validatedData.role)`
- **No server-side validation**: The role assignment is entirely controlled by the client with no database lookup or authorization check

The authentication flow trusts the client to declare their own privilege level, which violates the principle of server-side authorization.

## Proposed Solutions

### Option A: Remove 'admin' from client-selectable roles
- **Pros**: Simple immediate fix, prevents privilege escalation
- **Cons**: Does not solve the root problem of trusting client input for authorization
- **Effort**: Small
- **Risk**: Low

### Option B: Validate role against database/allowlist
- **Pros**: Proper authorization model, scalable, prevents all client-controlled privilege escalation
- **Cons**: Requires database schema for user roles, more implementation work
- **Effort**: Medium
- **Risk**: Low

### Option C: Remove role from authentication payload entirely
- **Pros**: Forces role lookup on every protected route from authoritative source
- **Cons**: Requires refactoring all routes that depend on JWT role claims
- **Effort**: Large
- **Risk**: Medium

## Recommended Action

**Immediate**: Implement Option A to prevent admin privilege escalation
**Long-term**: Implement Option B for proper role-based access control

1. Update Zod schema to `z.enum(['user', 'creator']).optional()`
2. Add database table for user roles with pubkey → role mapping
3. Modify `generateJWT()` to query user role from database instead of accepting parameter
4. Implement role assignment logic via separate admin-protected endpoint

## Technical Details

- **Affected files**:
  - `packages/backend/src/routes/auth.ts` (authentication endpoint)
  - `packages/backend/src/services/nostr-auth.ts` (JWT generation)
  - Database schema (new user_roles table needed)
- **Components**: Authentication, Authorization, JWT generation
- **Root cause**: Trust of client-provided authorization claims without server-side validation

## Acceptance Criteria

- [ ] Client cannot set `role: 'admin'` in authentication request
- [ ] Admin role assignment requires server-side authorization
- [ ] All existing admin tokens are invalidated
- [ ] Role claims in JWT are derived from authoritative server-side source
- [ ] Security test added to verify privilege escalation is blocked

## Work Log

| Date | Action | Result |
|------|--------|--------|
| 2026-02-14 | Identified in PR #73 full code review | Review finding |

## Resources

- PR: https://github.com/zone17/sovren/pull/73
