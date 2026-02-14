---
status: pending
priority: p2
issue_id: '093'
tags: [code-review, architecture, circular-dependency]
dependencies: []
---

# Circular Dependency: AppError Between error-handler-middleware.ts and utils/errors.ts

## Problem Statement

Circular dependency exists between `error-handler-middleware.ts` and `utils/errors.ts`. The error handler middleware exports `AppError` and re-exports from `utils/errors.ts` at line 80, while `utils/errors.ts` imports `AppError` from `error-handler-middleware.ts` at line 9. This circular dependency works today only by JavaScript module evaluation order luck and will break unpredictably during refactoring or with different bundlers.

## Findings

- `error-handler-middleware.ts` line 80: Re-exports from `utils/errors.ts`
- `utils/errors.ts` line 9: Imports `AppError` from `error-handler-middleware.ts`
- Circular import chain: middleware → utils → middleware
- Node.js module caching masks the issue during normal execution
- Bundlers (Webpack, esbuild, Vite) may fail or produce different behavior
- TypeScript compiler doesn't always detect circular dependencies
- Code is fragile: reordering imports or changing export style can trigger runtime errors

## Proposed Solutions

### Option 1: Extract AppError to lib/app-error.ts

**Pros:**

- Clean single source of truth for base error class
- Breaks circular dependency completely
- Both files import from canonical location
- Follows single-responsibility principle
- Easy to test in isolation

**Cons:**

- Requires updating imports in both files
- May need to update other files importing AppError

**Effort:** Low (2 hours)
**Risk:** Low

### Option 2: Merge utils/errors.ts into error-handler-middleware.ts

**Pros:**

- Eliminates separate file, removes circular dependency
- Single location for all error-related code
- Fewer files to maintain

**Cons:**

- Creates large monolithic file
- Violates separation of concerns (utils vs middleware)
- Error classes used outside middleware context still in middleware file

**Effort:** Low (1 hour)
**Risk:** Low

### Option 3: Inline AppError Definition in utils/errors.ts

**Pros:**

- Minimal change: remove import, define AppError locally
- utils/errors.ts becomes canonical source

**Cons:**

- error-handler-middleware.ts imports from utils (weird dependency direction)
- Middleware depends on utils instead of both depending on shared lib
- Less discoverable (AppError buried in utils)

**Effort:** Low (1 hour)
**Risk:** Low

## Recommended Action

**Option 1: Extract AppError to lib/app-error.ts**

This is the cleanest architectural solution. Base error classes belong in `lib/` alongside other foundational abstractions like logger, redis, and database clients. Both the middleware and utils can then import from the canonical source.

Implementation:

1. Create `src/lib/app-error.ts` with AppError class
2. Update `error-handler-middleware.ts` to import from `lib/app-error.ts`
3. Update `utils/errors.ts` to import from `lib/app-error.ts`
4. Search codebase for other AppError imports and update
5. Run tests to verify no breakage
6. Use bundler analysis to confirm circular dependency resolved

## Technical Details

**Current Circular Dependency Chain:**

```
error-handler-middleware.ts (defines AppError)
  ↓ exports/re-exports (line 80)
utils/errors.ts
  ↓ imports AppError (line 9)
error-handler-middleware.ts (←circular!)
```

**Proposed Structure:**

```
lib/app-error.ts (canonical source)
  ↑ import          ↑ import
error-handler-middleware.ts    utils/errors.ts
```

**Files to Update:**

- Create: `src/lib/app-error.ts`
- Modify: `src/middleware/error-handler-middleware.ts`
- Modify: `src/utils/errors.ts`
- Find/replace: Any other files importing AppError

**AppError Base Class:**

```typescript
// lib/app-error.ts
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public isOperational = true
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}
```

**Detection Strategy:**

- Use `madge` or similar tool to detect circular dependencies
- Add pre-commit hook to block future circular imports
- Configure ESLint with `import/no-cycle` rule

## Acceptance Criteria

- [ ] `lib/app-error.ts` created with AppError class definition
- [ ] `error-handler-middleware.ts` imports AppError from `lib/app-error.ts`
- [ ] `utils/errors.ts` imports AppError from `lib/app-error.ts`
- [ ] All other files importing AppError updated to use `lib/app-error.ts`
- [ ] Circular dependency confirmed resolved via `madge` or bundler analysis
- [ ] All existing tests pass
- [ ] New test added verifying AppError can be imported independently
- [ ] ESLint `import/no-cycle` rule enabled to prevent future circular dependencies
- [ ] Documentation updated in architecture docs

## Work Log

**2026-02-14**

- Identified in PR #73 full code review
- Confirmed circular dependency using module import tracing
- Verified current code works only due to module evaluation order

## Resources

- PR #73: https://github.com/user/sovren/pull/73
- Madge (circular dependency detector): https://github.com/pahen/madge
- ESLint import/no-cycle: https://github.com/import-js/eslint-plugin-import/blob/main/docs/rules/no-cycle.md
- Node.js modules and circular dependencies: https://nodejs.org/api/modules.html#modules_cycles
