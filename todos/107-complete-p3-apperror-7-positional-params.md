---
status: pending
priority: p3
issue_id: 107
tags: [code-review, typescript, api-design]
dependencies: []
---

# AppError Constructor Has 7 Positional Parameters

## Problem Statement

`AppError` constructor at `packages/backend/src/middleware/error-handler-middleware.ts` takes **7 positional parameters**:

```typescript
constructor(
  message: string,
  statusCode: number = 500,
  code?: string,
  isOperational: boolean = true,
  metadata?: Record<string, any>,
  context?: string,
  cause?: Error
)
```

**Issues**:

1. **Parameter confusion**: Easy to swap `statusCode` and `isOperational` (both have defaults)
2. **Silent bugs**: Passing `metadata` as 4th arg instead of 5th compiles but fails at runtime
3. **Poor discoverability**: Hard to remember parameter order without checking definition
4. **Fragile refactoring**: Adding/reordering parameters breaks all callsites

**Example of easy mistake**:

```typescript
// Intended: message, statusCode, code, isOperational, metadata
new AppError('Not found', 404, 'NOT_FOUND', { userId: 123 }, true);
//                                           ^ metadata    ^ isOperational (SWAPPED!)

// TypeScript allows this because isOperational is boolean = true (optional)
// and metadata is Record<string, any> (flexible type)
```

## Findings

- **File**: `packages/backend/src/middleware/error-handler-middleware.ts`
- **Constructor signature**: 7 positional parameters, 5 with defaults/optional
- **Usage**: AppError used ~40 times across backend (grep shows widespread usage)
- **Similar patterns**: Other custom errors (ValidationError, AuthError) likely have same issue
- **Industry standard**: Most modern libraries use options objects (axios, node-fetch, etc.)

## Proposed Solutions

### Option 1: Options Object Pattern

**Description**: Replace positional parameters with a single options object:

```typescript
interface AppErrorOptions {
  message: string;
  statusCode?: number;
  code?: string;
  isOperational?: boolean;
  metadata?: Record<string, any>;
  context?: string;
  cause?: Error;
}

class AppError extends Error {
  constructor(options: AppErrorOptions | string) {
    // Support legacy: new AppError('message') for simple cases
    const opts = typeof options === 'string' ? { message: options } : options;

    super(opts.message);
    this.statusCode = opts.statusCode ?? 500;
    this.code = opts.code;
    this.isOperational = opts.isOperational ?? true;
    this.metadata = opts.metadata;
    this.context = opts.context;
    this.cause = opts.cause;
  }
}
```

**Usage**:

```typescript
// Clear, self-documenting
new AppError({
  message: 'User not found',
  statusCode: 404,
  code: 'USER_NOT_FOUND',
  metadata: { userId: 123 },
});

// Simple case still works
new AppError({ message: 'Something went wrong' });
new AppError('Something went wrong'); // Legacy support
```

**Pros**:

- **Self-documenting**: Parameter names visible at callsite
- **Order-independent**: Can't swap parameters by mistake
- **Extensible**: Add new fields without breaking existing code
- **Type-safe**: IDE autocomplete shows all options
- **Backward compatible**: Can support string-only constructor for simple cases

**Cons**:

- Requires updating ~40 callsites across backend
- Slightly more verbose for simple cases
- Migration effort for existing code

**Effort**: Medium (4-6 hours to update all callsites)
**Risk**: Low (TypeScript ensures all migrations are caught)

### Option 2: Builder Pattern

**Description**: Use fluent builder API:

```typescript
class AppError extends Error {
  constructor(message: string) {
    super(message);
    this.statusCode = 500;
    this.isOperational = true;
  }

  withStatusCode(code: number): this {
    this.statusCode = code;
    return this;
  }

  withCode(code: string): this {
    this.code = code;
    return this;
  }

  withMetadata(metadata: Record<string, any>): this {
    this.metadata = metadata;
    return this;
  }

  // ...
}
```

**Usage**:

```typescript
new AppError('User not found')
  .withStatusCode(404)
  .withCode('USER_NOT_FOUND')
  .withMetadata({ userId: 123 });
```

**Pros**:

- Fluent, chainable API
- Very clear intent
- Easy to add new fields

**Cons**:

- Unfamiliar pattern for error classes
- More boilerplate (8+ methods)
- Harder to enforce required fields
- Mutable (fields set after construction)

**Effort**: High (6-8 hours, more complex migration)
**Risk**: Medium (unconventional for errors, team may resist)

## Recommended Action

**Option 1** - Options object pattern.

**Rationale**: Industry standard for complex constructors. Self-documenting, type-safe, and extensible. The migration effort is justified by improved maintainability and reduced bug surface area. Backward compatibility for simple string-only cases eases migration.

**Implementation approach**:

1. Add `AppErrorOptions` interface in `error-handler-middleware.ts`
2. Update `AppError` constructor to accept `AppErrorOptions | string`
3. Add backward-compat branch for string-only constructor
4. Run `grep -r "new AppError" packages/backend/src` to find all callsites (~40)
5. Update callsites in batches by domain:
   - Auth errors
   - Validation errors
   - Database errors
   - API errors
6. Add tests for both options-object and legacy string-only usage
7. Deprecate positional parameters (add JSDoc warning)
8. Consider applying same pattern to ValidationError, AuthError, etc.

## Technical Details

**Current constructor** (7 positional params):

```typescript
class AppError extends Error {
  constructor(
    message: string,
    statusCode: number = 500,
    code?: string,
    isOperational: boolean = true,
    metadata?: Record<string, any>,
    context?: string,
    cause?: Error
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.metadata = metadata;
    this.context = context;
    this.cause = cause;
  }
}
```

**Problematic callsites** (examples of confusion):

```typescript
// Easy to swap boolean and metadata
new AppError('Error', 500, 'CODE', { data: 1 }, true); // WRONG ORDER!

// Easy to forget optional params
new AppError('Error', 404); // OK
new AppError('Error', 404, 'NOT_FOUND'); // OK
new AppError('Error', 404, 'NOT_FOUND', { id: 1 }); // WRONG! metadata in isOperational position
```

**Proposed options object**:

```typescript
interface AppErrorOptions {
  message: string;
  statusCode?: number;
  code?: string;
  isOperational?: boolean;
  metadata?: Record<string, any>;
  context?: string;
  cause?: Error;
}

class AppError extends Error {
  public readonly statusCode: number;
  public readonly code?: string;
  public readonly isOperational: boolean;
  public readonly metadata?: Record<string, any>;
  public readonly context?: string;
  public override readonly cause?: Error;

  constructor(options: AppErrorOptions | string) {
    const opts = typeof options === 'string' ? { message: options } : options;

    super(opts.message);
    this.name = 'AppError';
    this.statusCode = opts.statusCode ?? 500;
    this.code = opts.code;
    this.isOperational = opts.isOperational ?? true;
    this.metadata = opts.metadata;
    this.context = opts.context;
    this.cause = opts.cause;
  }
}
```

**Migration examples**:

```typescript
// Before
new AppError('User not found', 404, 'USER_NOT_FOUND', true, { userId: 123 });

// After (options object)
new AppError({
  message: 'User not found',
  statusCode: 404,
  code: 'USER_NOT_FOUND',
  metadata: { userId: 123 },
});

// Simple case (backward compatible)
new AppError('Internal error'); // Still works
```

**Testing strategy**:

```typescript
describe('AppError', () => {
  it('accepts options object', () => {
    const error = new AppError({
      message: 'Test',
      statusCode: 400,
      code: 'TEST_ERROR',
      metadata: { key: 'value' },
    });
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('TEST_ERROR');
    expect(error.metadata).toEqual({ key: 'value' });
  });

  it('accepts string for backward compatibility', () => {
    const error = new AppError('Test error');
    expect(error.message).toBe('Test error');
    expect(error.statusCode).toBe(500); // default
    expect(error.isOperational).toBe(true); // default
  });

  it('applies defaults correctly', () => {
    const error = new AppError({ message: 'Test' });
    expect(error.statusCode).toBe(500);
    expect(error.isOperational).toBe(true);
  });
});
```

## Acceptance Criteria

- [ ] `AppErrorOptions` interface defined with all 7 fields
- [ ] `AppError` constructor accepts `AppErrorOptions | string`
- [ ] Backward compatibility: `new AppError('message')` still works
- [ ] All ~40 callsites migrated to options object pattern
- [ ] Tests added for options object, string-only, and defaults
- [ ] No breaking changes (legacy string-only usage supported)
- [ ] JSDoc added explaining options pattern
- [ ] Consider applying to ValidationError, AuthError, etc.

## Work Log

### 2026-02-14

- Identified in PR #73 full code review

## Resources

- PR #73: https://github.com/zone17/sovren/pull/73
- File: `packages/backend/src/middleware/error-handler-middleware.ts`
- Related: ValidationError, AuthError, DatabaseError classes (similar pattern)
- Callsites: `grep -r "new AppError" packages/backend/src` (~40 usages)
