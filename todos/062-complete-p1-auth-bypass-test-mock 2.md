---
status: pending
priority: p1
issue_id: 062
tags: [code-review, security, authentication]
dependencies: []
---

# Auth Bypass via Test Mock in Production Code

## Problem Statement

`packages/backend/src/routes/auth.ts` (lines 65-84) contains a mock authentication bypass that activates when `NODE_ENV === 'test'`. This code path accepts `'mock'` as a valid signature, grants admin role, and returns a real JWT. If NODE_ENV is accidentally set to 'test' in production (or an attacker discovers this), they gain admin access.

## Findings

- **Security Sentinel P1-01**: Mock auth path in auth.ts creates backdoor. The string `'mock'` as signature + any pubkey = admin JWT.
- **Pattern Recognition P1**: Auth routes send JSON directly instead of throwing AppErrors, inconsistent with error handling pattern.

## Proposed Solutions

### Option A: Remove test mock entirely (Recommended)

Move test authentication to a test helper/fixture that's never bundled with production code.
**Pros:** Eliminates the risk entirely
**Cons:** Test setup becomes slightly more complex
**Effort:** Small
**Risk:** Low

### Option B: Guard with additional environment check

Add `process.env.ALLOW_MOCK_AUTH === 'true'` secondary guard.
**Pros:** Quick fix
**Cons:** Still ships dangerous code to production
**Effort:** Small
**Risk:** Medium - still has the code path

## Technical Details

- **Affected files:** `packages/backend/src/routes/auth.ts:65-84`
- **Components:** Authentication routes
- **Runtime impact:** Security vulnerability - unauthorized admin access

## Acceptance Criteria

- [ ] Mock auth code removed from production routes
- [ ] Test authentication uses dedicated test fixtures
- [ ] No auth bypass exists when NODE_ENV=test
- [ ] Existing tests still pass with new test auth approach

## Work Log

| Date       | Action                          | Learnings                       |
| ---------- | ------------------------------- | ------------------------------- |
| 2026-02-13 | Created from full PR #73 review | Security Sentinel flagged as P1 |

## Resources

- PR #73 full review
- Security Sentinel agent report
