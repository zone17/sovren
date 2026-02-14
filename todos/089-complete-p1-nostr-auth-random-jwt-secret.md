---
status: complete
priority: p1
issue_id: "089"
tags: [code-review, security, authentication, jwt]
dependencies: []
---

# 089: NostrAuth Random JWT Secret Generation

## Problem Statement

The `NostrAuthService` singleton generates a random JWT secret on instantiation instead of using a deterministic secret from environment configuration. This causes critical authentication failures: every server restart invalidates all existing JWTs, multi-instance deployments have incompatible secrets across instances, and the secret cannot be rotated in a controlled manner.

## Findings

**Location**: `packages/backend/src/services/nostr-auth.ts:374`

```typescript
private jwtSecret: string = crypto.randomBytes(32).toString('hex');
```

**Impact**:

1. **Session invalidation on restart**: Every server restart generates a new secret, immediately invalidating all existing user sessions
2. **Multi-instance incompatibility**: In load-balanced or horizontally scaled deployments, each instance generates its own secret. JWTs signed by instance A are rejected by instance B
3. **No secret rotation strategy**: Cannot implement controlled secret rotation or key versioning
4. **Non-deterministic**: Impossible to debug JWT verification issues across restarts

## Proposed Solutions

### Option A: Use environment variable JWT_SECRET
- **Pros**: Standard practice, simple, supports multi-instance deployments, enables controlled rotation
- **Cons**: Requires environment configuration, fails if not set
- **Effort**: Small
- **Risk**: Low

### Option B: Use config module with fallback
- **Pros**: Centralized configuration management, can support multiple secrets for rotation
- **Cons**: Adds dependency on config module
- **Effort**: Small
- **Risk**: Low

### Option C: Generate and persist secret to database on first run
- **Pros**: No environment variable needed, auto-initializes
- **Cons**: Still breaks multi-instance deployments, adds database dependency, doesn't solve rotation
- **Effort**: Medium
- **Risk**: Medium

## Recommended Action

Implement Option A with fail-fast behavior:

1. Read `process.env.JWT_SECRET` in NostrAuthService constructor
2. Fail server startup if `JWT_SECRET` is not set or is too weak (< 32 characters)
3. Document required environment variable in README and deployment guides
4. Add migration note warning that existing sessions will be invalidated on first deploy
5. Generate a secure random secret for production and staging environments

```typescript
private jwtSecret: string;

constructor() {
  this.jwtSecret = process.env.JWT_SECRET;
  if (!this.jwtSecret || this.jwtSecret.length < 32) {
    throw new Error('JWT_SECRET environment variable must be set and at least 32 characters');
  }
}
```

## Technical Details

- **Affected files**:
  - `packages/backend/src/services/nostr-auth.ts` (JWT secret initialization)
  - `.env.example` (add JWT_SECRET documentation)
  - Deployment configurations (add JWT_SECRET to environment)
  - README.md (document required environment variable)
- **Components**: Authentication, JWT signing and verification
- **Root cause**: Missing environment configuration, using random secret per instance

## Acceptance Criteria

- [ ] JWT_SECRET is read from environment variable
- [ ] Server fails to start if JWT_SECRET is missing or weak
- [ ] Existing JWTs remain valid across server restarts (same secret)
- [ ] Multi-instance deployments share the same JWT_SECRET
- [ ] Documentation includes JWT_SECRET setup instructions
- [ ] .env.example includes JWT_SECRET with secure example value

## Work Log

| Date | Action | Result |
|------|--------|--------|
| 2026-02-14 | Identified in PR #73 full code review | Review finding |

## Resources

- PR: https://github.com/zone17/sovren/pull/73
