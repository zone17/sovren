---
status: pending
priority: p3
issue_id: 108
tags: [code-review, typescript, type-safety]
dependencies: []
---

# ServiceToken<any> and Type Safety Issues in DI Container

## Problem Statement

Type safety in the dependency injection container is severely compromised by widespread use of `any`:

1. **ServiceToken<any>**: Used 32 times in `packages/backend/src/container/types.ts`, eliminating type-safe DI resolution
2. **~15 `as any` casts**: Scattered across production code in bootstrap.ts, CacheService.ts, unified-nostr-auth.ts, validation-middleware.ts, social-media-integration-service.ts, email-integration-service.ts
3. **Lazy controller resolution**: `content.routes.ts:17` and `user.routes.ts:21` type controller as `any` (payment.routes.ts correctly types as `PaymentController | null`)

**Impact**:

- No compile-time validation of service dependencies
- IDE autocomplete broken for injected services
- Runtime errors from missing/mistyped services not caught until production
- Refactoring safety eliminated (rename service → silent breakage)

## Findings

- **Primary file**: `packages/backend/src/container/types.ts` (32 `ServiceToken<any>` instances)
- **Secondary files**: bootstrap.ts, CacheService.ts, unified-nostr-auth.ts, validation-middleware.ts, social-media-integration-service.ts, email-integration-service.ts
- **Pattern**: Lazy resolution typed as `any` instead of proper union types
- **Good example**: `payment.routes.ts` types lazy controller as `PaymentController | null`
- **Bad examples**: `content.routes.ts:17`, `user.routes.ts:21` type as `any`

**Example of the issue**:

```typescript
// types.ts - 32 instances like this
export const USER_SERVICE: ServiceToken<any> = Symbol('UserService');

// Later in code
const userService = container.resolve(USER_SERVICE);
userService.createUser({ ... }); // NO type checking, NO autocomplete
```

## Proposed Solutions

### Option 1: Strongly Type All Service Tokens

**Description**: Replace `ServiceToken<any>` with actual service types:

```typescript
// types.ts
import type { UserService } from '@/services/UserService';
import type { AuthService } from '@/services/AuthService';
// ...

export const USER_SERVICE: ServiceToken<UserService> = Symbol('UserService');
export const AUTH_SERVICE: ServiceToken<AuthService> = Symbol('AuthService');
// Repeat for all 32 tokens
```

**Lazy controller resolution**:

```typescript
// content.routes.ts (BEFORE)
const controller = container.tryResolve(CONTENT_CONTROLLER) as any;

// content.routes.ts (AFTER)
const controller = container.tryResolve(CONTENT_CONTROLLER) as ContentController | null;
```

**Pros**:

- Full type safety for DI resolution
- IDE autocomplete works correctly
- Compile-time validation of service usage
- Refactoring safety (renames caught at compile time)
- No runtime behavior changes

**Cons**:

- Requires importing 32 service types into types.ts (circular import risk)
- May need to restructure imports to avoid cycles
- Moderate effort to fix all 32 tokens + ~15 `as any` casts

**Effort**: Medium (4-6 hours)
**Risk**: Low-Medium (circular import risk, but solvable with forward declarations)

### Option 2: Type-Safe DI Wrapper

**Description**: Create a type-safe wrapper around container with generic resolution:

```typescript
// container/typed-container.ts
class TypedContainer {
  resolve<T>(token: ServiceToken<T>): T {
    return this.container.resolve(token);
  }

  tryResolve<T>(token: ServiceToken<T>): T | null {
    return this.container.tryResolve(token) ?? null;
  }
}

// Usage - types inferred automatically
const userService = typedContainer.resolve(USER_SERVICE); // Type: UserService
```

**Pros**:

- Type safety without modifying 32 token definitions
- Avoids circular import issues
- Generic inference "just works"
- Can migrate incrementally (old container still works)

**Cons**:

- Adds wrapper layer (indirection)
- Requires migrating all resolve() calls to new wrapper
- Doesn't fix `as any` casts in services themselves

**Effort**: Medium-High (6-8 hours, more callsites to update)
**Risk**: Low (wrapper is additive, no breaking changes)

### Option 3: Hybrid Approach

**Description**: Fix critical services first, leave non-critical as `any`:

1. Identify top 10 most-used services (UserService, AuthService, PaymentService, etc.)
2. Strongly type those tokens + fix their `as any` casts
3. Leave rarely-used services as `ServiceToken<any>` for now
4. Add linter rule to prevent new `ServiceToken<any>` additions

**Pros**:

- Pragmatic: fixes biggest pain points first
- Lower initial effort
- Incremental migration path
- Prevents regression via linter

**Cons**:

- Partial solution (inconsistent type safety)
- Still allows some `any` to slip through
- May give false sense of security

**Effort**: Low-Medium (2-4 hours for top 10 services)
**Risk**: Low (incremental, can expand over time)

## Recommended Action

**Option 1** - Strongly type all service tokens.

**Rationale**: Type safety is fundamental to TypeScript's value proposition. The current `any` usage eliminates the primary benefit of using TypeScript for the DI container. While there's some circular import risk, this is solvable with proper module structure (interfaces in types.ts, implementations import types). The effort is justified by long-term maintainability and developer experience improvements.

**Implementation approach**:

1. **Audit circular imports**: Run `madge --circular packages/backend/src` to identify existing cycles
2. **Extract service interfaces**: If circular imports exist, extract interfaces to separate files:

   ```typescript
   // services/interfaces/IUserService.ts
   export interface IUserService {
     createUser(data: CreateUserDTO): Promise<User>;
     // ...
   }

   // container/types.ts
   import type { IUserService } from '@/services/interfaces/IUserService';
   export const USER_SERVICE: ServiceToken<IUserService> = Symbol('UserService');
   ```

3. **Update all 32 service tokens** in types.ts with proper types
4. **Fix `as any` casts** in:
   - bootstrap.ts
   - CacheService.ts
   - unified-nostr-auth.ts
   - validation-middleware.ts
   - social-media-integration-service.ts
   - email-integration-service.ts
5. **Fix lazy controller resolution** in content.routes.ts, user.routes.ts (follow payment.routes.ts pattern)
6. **Add linter rule**: `@typescript-eslint/no-explicit-any` to prevent regression
7. **Test**: Compile with `tsc --noEmit` to catch any new type errors

## Technical Details

**Current pattern** (32 instances):

```typescript
// packages/backend/src/container/types.ts
export const USER_SERVICE: ServiceToken<any> = Symbol('UserService');
export const AUTH_SERVICE: ServiceToken<any> = Symbol('AuthService');
export const PAYMENT_SERVICE: ServiceToken<any> = Symbol('PaymentService');
// ... 29 more
```

**Usage with no type safety**:

```typescript
// Somewhere in code
const userService = container.resolve(USER_SERVICE);
userService.craeteUser({ ... }); // Typo: "craete" - NO compile error!
```

**Proposed strongly-typed pattern**:

```typescript
// packages/backend/src/container/types.ts
import type { UserService } from '@/services/UserService';
import type { AuthService } from '@/services/AuthService';
import type { PaymentService } from '@/services/PaymentService';

export const USER_SERVICE: ServiceToken<UserService> = Symbol('UserService');
export const AUTH_SERVICE: ServiceToken<AuthService> = Symbol('AuthService');
export const PAYMENT_SERVICE: ServiceToken<PaymentService> = Symbol('PaymentService');
```

**Usage with type safety**:

```typescript
const userService = container.resolve(USER_SERVICE); // Type: UserService
userService.createUser({ ... }); // Autocomplete works, typos caught
userService.invalidMethod(); // Compile error: "invalidMethod does not exist"
```

**Lazy controller resolution fix**:

```typescript
// BEFORE (content.routes.ts:17)
const controller = container.tryResolve(CONTENT_CONTROLLER) as any;
if (controller) {
  router.get('/', controller.getContent); // NO type checking
}

// AFTER
const controller = container.tryResolve(CONTENT_CONTROLLER) as ContentController | null;
if (controller) {
  router.get('/', controller.getContent); // Type-safe: getContent must exist on ContentController
}
```

**Circular import avoidance** (if needed):

```typescript
// services/interfaces/index.ts
export interface IUserService { ... }
export interface IAuthService { ... }

// services/UserService.ts
import type { IUserService } from './interfaces';
export class UserService implements IUserService { ... }

// container/types.ts
import type { IUserService, IAuthService } from '@/services/interfaces';
export const USER_SERVICE: ServiceToken<IUserService> = Symbol('UserService');
```

**Files to fix**:

- `packages/backend/src/container/types.ts` (32 `ServiceToken<any>`)
- `packages/backend/src/bootstrap.ts` (~3 `as any` casts)
- `packages/backend/src/services/CacheService.ts` (~2 `as any` casts)
- `packages/backend/src/auth/unified-nostr-auth.ts` (~2 `as any` casts)
- `packages/backend/src/middleware/validation-middleware.ts` (~3 `as any` casts)
- `packages/backend/src/services/social-media-integration-service.ts` (~2 `as any` casts)
- `packages/backend/src/services/email-integration-service.ts` (~3 `as any` casts)
- `packages/backend/src/routes/content.routes.ts:17` (lazy controller)
- `packages/backend/src/routes/user.routes.ts:21` (lazy controller)

## Acceptance Criteria

- [ ] All 32 `ServiceToken<any>` replaced with proper types
- [ ] No circular import errors (run `madge --circular packages/backend/src`)
- [ ] All ~15 `as any` casts in listed files replaced with proper types
- [ ] Lazy controller resolution in content.routes.ts, user.routes.ts typed correctly
- [ ] `tsc --noEmit` passes with no new errors
- [ ] IDE autocomplete works for all resolved services (manual test)
- [ ] Add `@typescript-eslint/no-explicit-any` rule to prevent regression
- [ ] Documentation updated explaining service token type patterns

## Work Log

### 2026-02-14

- Identified in PR #73 full code review

## Resources

- PR #73: https://github.com/zone17/sovren/pull/73
- Primary file: `packages/backend/src/container/types.ts` (32 instances)
- Files with `as any`: bootstrap.ts, CacheService.ts, unified-nostr-auth.ts, validation-middleware.ts, social-media-integration-service.ts, email-integration-service.ts
- Good example: `packages/backend/src/routes/payment.routes.ts` (typed as `PaymentController | null`)
- Bad examples: `packages/backend/src/routes/content.routes.ts:17`, `packages/backend/src/routes/user.routes.ts:21`
- Tool: `madge --circular packages/backend/src` (detect circular imports)
