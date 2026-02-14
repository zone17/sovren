---
status: pending
priority: p2
issue_id: '103'
tags: [code-review, architecture, authentication, middleware]
dependencies: []
---

# Dual Auth Middleware Patterns Cause Inconsistent Request Augmentation

## Problem Statement

Two competing auth middleware patterns exist: `auth.ts` sets `req.user` (nostr_pubkey, role, signature_verified, iat, exp) used by v1 routes, while `nostr-auth.ts` sets `req.nostr` (pubkey, npub, sessionId, role, session) for unified NOSTR authentication. Routes inconsistently use `req.user` vs `req.nostr`, creating confusion and potential security bugs. Additionally, auth middleware sends direct JSON responses instead of throwing AppErrors, bypassing the global error handler (missing correlation IDs, Sentry integration, structured logging).

## Findings

**Dual Middleware Patterns:**

1. **auth.ts (Legacy Pattern):**

   - Sets `req.user` object:
     ```typescript
     req.user = {
       nostr_pubkey: string;
       role: 'user' | 'admin';
       signature_verified: boolean;
       iat: number;
       exp: number;
     }
     ```
   - Used by v1 API routes
   - Token-based or signature-based auth

2. **nostr-auth.ts (New Pattern):**
   - Sets `req.nostr` object:
     ```typescript
     req.nostr = {
       pubkey: string;
       npub: string;
       sessionId: string;
       role: 'user' | 'admin';
       session: Session;
     }
     ```
   - Unified NOSTR authentication
   - Session-based

**Problems:**

1. **Inconsistent Access Patterns:**

   - Some routes check `req.user.role`, others check `req.nostr.role`
   - Developers must know which middleware runs for each route
   - Risk of missing auth checks (`req.user` undefined when `req.nostr` set)

2. **Duplicate Role/Pubkey Storage:**

   - Both middleware set role and pubkey (different property names)
   - Potential for inconsistency if both run
   - Wasted memory

3. **Migration Burden:**

   - Migrating from `req.user` to `req.nostr` requires updating all routes
   - Risk of missing routes during migration
   - No type safety to catch missing updates

4. **Error Handling Bypass:**
   - Auth middleware sends direct responses:
     ```typescript
     // auth.ts
     if (!token) {
       return res.status(401).json({ error: 'Unauthorized' });
     }
     ```
   - Bypasses global error handler
   - Missing correlation IDs in error responses
   - No Sentry integration for auth failures
   - Inconsistent error format vs rest of API

**Error Handling Issues:**

```typescript
// Current (bypasses error handler)
if (!token) {
  return res.status(401).json({ error: 'Unauthorized' });
}

// Should be
if (!token) {
  throw new UnauthorizedError('Missing authentication token');
}
```

## Proposed Solutions

### Option 1: Unify on req.user with Extended Properties

**Pros:**

- Single source of truth for auth context
- Leverage existing `req.user` TypeScript types
- Minimal migration (routes already use `req.user`)
- Add NOSTR-specific properties to `req.user`:
  ```typescript
  req.user = {
    id: string;           // Generic user ID
    role: string;
    pubkey?: string;      // NOSTR pubkey (if NOSTR auth)
    npub?: string;        // NOSTR npub format
    sessionId?: string;   // Session ID (if session-based)
  }
  ```

**Cons:**

- Mixing concerns (generic auth + NOSTR specifics)
- Optional properties require null checks
- Less clear NOSTR-specific semantics

**Effort:** Medium (4 hours)
**Risk:** Low

### Option 2: Unify on req.nostr with Renamed Properties

**Pros:**

- NOSTR-native API semantics
- Clear separation from legacy JWT auth
- Future-proof for NOSTR-first architecture

**Cons:**

- Requires updating all routes to use `req.nostr`
- Breaking change for v1 routes
- Higher migration risk

**Effort:** High (8 hours)
**Risk:** Medium

### Option 3: Adapter Middleware (Sets Both req.user and req.nostr)

**Pros:**

- Backward compatible (routes can use either)
- Gradual migration path
- No breaking changes

**Cons:**

- Duplicate data in request object
- Doesn't solve long-term inconsistency
- Adds complexity (which is source of truth?)

**Effort:** Low (2 hours)
**Risk:** Low

### Option 4: Unified Auth Context with Namespaces

**Pros:**

- Single `req.auth` object with namespaces:
  ```typescript
  req.auth = {
    user: { id, role },
    nostr?: { pubkey, npub, sessionId },
    token?: { iat, exp },
  }
  ```
- Clear separation of concerns
- Extensible for future auth methods

**Cons:**

- Breaking change (all routes updated)
- New pattern to learn
- Most invasive change

**Effort:** High (12 hours)
**Risk:** High

## Recommended Action

**Option 1: Unify on req.user + Fix Error Handling**

Extend `req.user` with optional NOSTR properties and replace direct responses with AppError throws. This provides immediate consistency with minimal migration risk.

Implementation:

1. **Update TypeScript Types:**

   ```typescript
   // types/express.d.ts
   declare namespace Express {
     interface Request {
       user?: {
         id: string;
         role: 'user' | 'admin' | 'moderator';
         pubkey?: string; // NOSTR pubkey (if NOSTR auth)
         npub?: string; // NOSTR npub format
         sessionId?: string; // Session ID (if session-based)
         iat?: number; // Token issued at
         exp?: number; // Token expiry
       };
       correlationId: string;
     }
   }
   ```

2. **Update nostr-auth.ts:**

   ```typescript
   // Before: sets req.nostr
   req.nostr = { pubkey, npub, sessionId, role, session };

   // After: sets req.user (unified)
   req.user = {
     id: pubkey,
     role: session.role,
     pubkey,
     npub,
     sessionId,
   };
   ```

3. **Replace Direct Responses with AppErrors:**

   ```typescript
   // Before (BYPASSES ERROR HANDLER)
   if (!token) {
     return res.status(401).json({ error: 'Unauthorized' });
   }

   // After (USES ERROR HANDLER)
   import { UnauthorizedError } from '@/middleware/error-handler-middleware';

   if (!token) {
     throw new UnauthorizedError('Missing authentication token');
   }
   ```

4. **Update Routes:**

   ```typescript
   // Before (inconsistent)
   const pubkey = req.user?.nostr_pubkey || req.nostr?.pubkey;
   const role = req.user?.role || req.nostr?.role;

   // After (consistent)
   const pubkey = req.user.pubkey;
   const role = req.user.role;
   ```

5. **Add Backward Compatibility (Temporary):**
   ```typescript
   // nostr-auth.ts (during migration)
   req.user = { id: pubkey, role, pubkey, npub, sessionId };
   req.nostr = req.user; // Alias for old routes (deprecated)
   ```

## Technical Details

**Affected Files:**

- `src/middleware/auth.ts` (legacy auth middleware)
- `src/middleware/nostr-auth.ts` (new auth middleware)
- `src/types/express.d.ts` (TypeScript request augmentation)
- All route handlers using `req.user` or `req.nostr` (find via grep)

**Finding Affected Routes:**

```bash
# Find routes using req.user
grep -r "req\.user" src/routes/ --include="*.ts" -n

# Find routes using req.nostr
grep -r "req\.nostr" src/routes/ --include="*.ts" -n

# Find auth middleware direct responses
grep -r "res\.status.*\.json.*error" src/middleware/auth*.ts
```

**UnauthorizedError Class:**

```typescript
// error-handler-middleware.ts (may already exist)
export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(401, message);
    this.name = 'UnauthorizedError';
  }
}
```

**Migration Checklist:**

- [ ] TypeScript types updated (req.user extended)
- [ ] nostr-auth.ts sets req.user instead of req.nostr
- [ ] auth.ts sets req.user with extended properties
- [ ] All direct `res.status().json()` in auth middleware replaced with `throw`
- [ ] Routes updated to use unified `req.user` pattern
- [ ] Temporary `req.nostr` alias added for backward compatibility (if needed)
- [ ] Tests updated to verify unified auth context

## Acceptance Criteria

**Unified Auth Context:**

- [ ] `req.user` is the single source of truth for auth context
- [ ] NOSTR-specific properties (`pubkey`, `npub`, `sessionId`) added to `req.user`
- [ ] TypeScript types updated for extended `req.user` interface
- [ ] All routes consistently use `req.user` (no `req.nostr` references)
- [ ] Unit tests verify `req.user` set correctly by both auth middlewares

**Error Handling:**

- [ ] Auth middleware throws AppError subclasses (UnauthorizedError, etc.)
- [ ] No direct JSON responses in auth middleware
- [ ] Auth failures include correlation IDs in response
- [ ] Sentry captures auth failures
- [ ] Integration test: 401 response includes correlation ID header

**Migration:**

- [ ] All routes updated to use unified `req.user` pattern
- [ ] No runtime errors from `req.user` vs `req.nostr` confusion
- [ ] Code search confirms no remaining `req.nostr` usage (except alias if needed)
- [ ] Documentation updated with unified auth pattern examples

## Work Log

**2026-02-14**

- Identified in PR #73 full code review
- Found dual auth middleware patterns (auth.ts vs nostr-auth.ts)
- Documented inconsistent `req.user` vs `req.nostr` usage across routes
- Found auth middleware bypasses global error handler

## Resources

- PR #73: https://github.com/user/sovren/pull/73
- Express Request augmentation: https://stackoverflow.com/questions/37377731/extend-express-request-object-using-typescript
- Related: Issue #094 (error handler middleware ordering)
- Related: Issue #100 (AppError hierarchy usage)
