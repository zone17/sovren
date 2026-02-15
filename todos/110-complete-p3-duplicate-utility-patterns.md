---
status: pending
priority: p3
issue_id: 110
tags: [code-review, duplication, refactoring]
dependencies: []
---

# Duplicate Utility Patterns Across Backend

## Problem Statement

Multiple utility patterns are duplicated across the backend, leading to maintenance burden and inconsistency:

1. **`asyncHandler`**: Defined in error-handler-middleware.ts:307 AND unified-sessions.ts:158 (2 implementations)
2. **`RateLimitConfig` interface**: Defined 3 times in rate-limit-middleware.ts:19, advanced-rate-limiting.ts:27, currency.ts:130
3. **`getClientIP` helper**: Implemented 4 times across advanced-rate-limiting.ts (twice!), unified-sessions.ts:147, analytics-integration-service.ts:966
4. **Pagination schema**: Defined twice in validation-middleware.ts:142 and app.ts:227
5. **XSS sanitization**: Implemented 3 times across content-sanitization.ts, input-validation.ts, validation-middleware.ts

**Impact**:

- Bug fixes require updating multiple locations
- Implementations may diverge (different edge case handling)
- Increased bundle size (duplicate code)
- Harder to maintain consistent behavior

## Findings

- **Pattern**: Common utilities duplicated due to organic growth, no central utility module
- **Root cause**: No established pattern for shared utilities → developers implement locally
- **Scale**: At least 13 duplicate implementations across 5 utility patterns
- **Files affected**: 10+ files across middleware, services, utils

**Detailed findings**:

| Pattern           | Count | Locations                                                                             | Line Numbers |
| ----------------- | ----- | ------------------------------------------------------------------------------------- | ------------ |
| asyncHandler      | 2     | error-handler-middleware.ts, unified-sessions.ts                                      | 307, 158     |
| RateLimitConfig   | 3     | rate-limit-middleware.ts, advanced-rate-limiting.ts, currency.ts                      | 19, 27, 130  |
| getClientIP       | 4     | advanced-rate-limiting.ts (2x), unified-sessions.ts, analytics-integration-service.ts | -, 147, 966  |
| Pagination schema | 2     | validation-middleware.ts, app.ts                                                      | 142, 227     |
| XSS sanitization  | 3     | content-sanitization.ts, input-validation.ts, validation-middleware.ts                | -            |

## Proposed Solutions

### Option 1: Create Central Utilities Module

**Description**: Consolidate all duplicate utilities into `packages/backend/src/utils/`:

```
packages/backend/src/utils/
├── async-handler.ts         # Single asyncHandler implementation
├── rate-limit-types.ts      # RateLimitConfig interface
├── client-ip.ts             # Single getClientIP implementation
├── pagination.ts            # Pagination schema + types
└── sanitization.ts          # XSS sanitization helpers
```

**Migration**:

```typescript
// Before (error-handler-middleware.ts:307)
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// After (all files import from utils)
import { asyncHandler } from '@/utils/async-handler';
```

**Pros**:

- Single source of truth for each utility
- Easy to find and maintain
- Consistent behavior across codebase
- Reduces bundle size
- Clear import path for new developers

**Cons**:

- Requires updating ~20-30 import statements
- May reveal behavioral differences between implementations (need to reconcile)
- Risk of breaking existing code if implementations differ

**Effort**: Medium (4-6 hours)
**Risk**: Low-Medium (need to verify implementations are equivalent)

### Option 2: Incremental Consolidation

**Description**: Consolidate one pattern at a time, starting with highest impact:

1. **Week 1**: `getClientIP` (4 implementations → 1)
2. **Week 2**: `RateLimitConfig` (3 definitions → 1)
3. **Week 3**: `asyncHandler` (2 implementations → 1)
4. **Week 4**: XSS sanitization (3 implementations → 1)
5. **Week 5**: Pagination schema (2 definitions → 1)

**Pros**:

- Lower risk per change (one pattern at a time)
- Easier to review and test
- Can prioritize by impact
- Spreads effort over time

**Cons**:

- Takes 5 weeks instead of 1 sprint
- Partial solution until complete
- May lose momentum

**Effort**: Medium (4-6 hours total, spread over 5 weeks)
**Risk**: Low (small incremental changes)

### Option 3: Barrel Export Pattern

**Description**: Keep utilities where they are, but create barrel exports in `utils/index.ts`:

```typescript
// packages/backend/src/utils/index.ts
export { asyncHandler } from '@/middleware/error-handler-middleware';
export { RateLimitConfig } from '@/middleware/rate-limit-middleware';
export { getClientIP } from '@/middleware/advanced-rate-limiting';
export { paginationSchema } from '@/middleware/validation-middleware';
```

**Pros**:

- Minimal code changes
- Establishes canonical source for each utility
- Can migrate to Option 1 later without breaking imports

**Cons**:

- Doesn't actually remove duplication
- Still have multiple implementations
- Exports from middleware (odd organization)

**Effort**: Low (1 hour)
**Risk**: Very Low (no behavior changes)

## Recommended Action

**Option 1** - Create central utilities module.

**Rationale**: Duplication is a significant maintenance burden and will only grow worse over time. A central utilities module is a best practice for codebases this size. The upfront migration effort is justified by long-term maintainability. The risk of behavioral differences can be mitigated by careful testing and comparison.

**Implementation approach**:

1. **Audit implementations**: For each pattern, compare all implementations to identify differences:

   ```bash
   # Example for asyncHandler
   grep -A 5 "asyncHandler" packages/backend/src/middleware/error-handler-middleware.ts
   grep -A 5 "asyncHandler" packages/backend/src/auth/unified-sessions.ts
   # Compare outputs
   ```

2. **Create utils modules**:

   ```typescript
   // packages/backend/src/utils/async-handler.ts
   import type { Request, Response, NextFunction } from 'express';

   export const asyncHandler =
     (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
     (req: Request, res: Response, next: NextFunction) => {
       Promise.resolve(fn(req, res, next)).catch(next);
     };
   ```

3. **Consolidate each pattern**:

   - **asyncHandler**: Choose most robust implementation (likely error-handler-middleware.ts), move to utils/async-handler.ts
   - **RateLimitConfig**: Merge all 3 definitions (take union of fields), move to utils/rate-limit-types.ts
   - **getClientIP**: Choose implementation with best proxy/forwarding header support, move to utils/client-ip.ts
   - **Pagination schema**: Merge both schemas, move to utils/pagination.ts
   - **XSS sanitization**: Choose most comprehensive, move to utils/sanitization.ts

4. **Update imports**:

   ```bash
   # Find all usages
   grep -r "asyncHandler" packages/backend/src --exclude-dir=node_modules
   # Update each file to import from utils
   ```

5. **Test thoroughly**:

   - Run existing test suite
   - Add new tests for each consolidated utility
   - Manual testing for critical paths (auth, rate limiting, pagination)

6. **Document**:
   ```typescript
   /**
    * Wraps async Express route handlers to catch promise rejections.
    *
    * @example
    * router.get('/users', asyncHandler(async (req, res) => {
    *   const users = await UserService.findAll();
    *   res.json(users);
    * }));
    */
   export const asyncHandler = ...
   ```

## Technical Details

### 1. asyncHandler Duplication

**Implementation 1** (error-handler-middleware.ts:307):

```typescript
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
```

**Implementation 2** (unified-sessions.ts:158):

```typescript
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
```

**Analysis**: Functionally identical. Consolidate to single implementation in `utils/async-handler.ts`.

### 2. RateLimitConfig Duplication

**Definition 1** (rate-limit-middleware.ts:19):

```typescript
interface RateLimitConfig {
  windowMs: number;
  max: number;
}
```

**Definition 2** (advanced-rate-limiting.ts:27):

```typescript
interface RateLimitConfig {
  windowMs: number;
  max: number;
  keyGenerator?: (req: Request) => string;
}
```

**Definition 3** (currency.ts:130):

```typescript
interface RateLimitConfig {
  windowMs: number;
  max: number;
  message?: string;
}
```

**Analysis**: Incompatible fields. Need to merge into single comprehensive interface:

```typescript
interface RateLimitConfig {
  windowMs: number;
  max: number;
  keyGenerator?: (req: Request) => string;
  message?: string;
}
```

### 3. getClientIP Duplication

**4 implementations** - need to audit each for proxy/forwarding header support. Choose most robust.

**Proposed consolidated implementation**:

```typescript
// packages/backend/src/utils/client-ip.ts
import type { Request } from 'express';

export const getClientIP = (req: Request): string => {
  // Check forwarding headers (respect proxy settings)
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
  }

  // Fallback to direct connection IP
  return req.ip || req.socket.remoteAddress || 'unknown';
};
```

### 4. Pagination Schema Duplication

**Definition 1** (validation-middleware.ts:142):

```typescript
const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});
```

**Definition 2** (app.ts:227):

```typescript
const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(50).default(10),
});
```

**Analysis**: Different max limits (100 vs 50), different defaults (20 vs 10). Need to reconcile:

- Choose max=100 (more permissive)
- Choose default=20 (middle ground)
- Document in JSDoc

### 5. XSS Sanitization Duplication

**3 implementations** - need to audit for differences in sanitization rules. Consolidate to most comprehensive.

## Acceptance Criteria

- [ ] All 5 utility patterns consolidated to `packages/backend/src/utils/`
- [ ] All duplicate implementations removed
- [ ] All imports updated to use central utilities
- [ ] Implementations reconciled (behavioral differences resolved)
- [ ] Tests added for each consolidated utility
- [ ] Existing test suite passes
- [ ] JSDoc added to each utility explaining usage
- [ ] No bundle size increase (should decrease)
- [ ] Document pattern in CONTRIBUTING.md ("use utils/ for shared helpers")

## Work Log

### 2026-02-14

- Identified in PR #73 full code review

## Resources

- PR #73: https://github.com/zone17/sovren/pull/73
- Files with duplicates:
  - `packages/backend/src/middleware/error-handler-middleware.ts:307` (asyncHandler)
  - `packages/backend/src/auth/unified-sessions.ts:158` (asyncHandler)
  - `packages/backend/src/middleware/rate-limit-middleware.ts:19` (RateLimitConfig)
  - `packages/backend/src/middleware/advanced-rate-limiting.ts:27` (RateLimitConfig, getClientIP x2)
  - `packages/backend/src/services/currency.ts:130` (RateLimitConfig)
  - `packages/backend/src/auth/unified-sessions.ts:147` (getClientIP)
  - `packages/backend/src/services/analytics-integration-service.ts:966` (getClientIP)
  - `packages/backend/src/middleware/validation-middleware.ts:142` (pagination, XSS)
  - `packages/backend/src/app.ts:227` (pagination)
  - `packages/backend/src/utils/content-sanitization.ts` (XSS)
  - `packages/backend/src/utils/input-validation.ts` (XSS)
