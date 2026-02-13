---
status: pending
priority: p1
issue_id: '043'
tags: [code-review, typescript, type-safety]
dependencies: []
---

# Unsafe Type Casts Database and Express

## Problem Statement

Two unsafe type casts erode TypeScript's safety guarantees:

1. `createPoolConfig` casts Zod-validated `ValidatedPoolConfig` to `DatabasePoolConfig` despite incompatible type shapes
2. `express.d.ts` user type has `[key: string]: unknown` index signature, allowing any property access without warnings

## Findings

**Locations**:

- `/Users/fp/Desktop/Sovren/packages/backend/src/config/database-pool.config.ts:247` (unsafe cast)
- `/Users/fp/Desktop/Sovren/packages/backend/src/types/express.d.ts:5` (index signature)

**Found by**: TypeScript Reviewer

**Issue 1 - Incompatible Type Cast**:

```typescript
function createPoolConfig(): DatabasePoolConfig {
  const validated = poolConfigSchema.parse(rawConfig);
  // validated is ValidatedPoolConfig
  // DatabasePoolConfig expects different shape
  return validated as DatabasePoolConfig; // ← Unsafe cast
}
```

The two types have different structures:

- `ValidatedPoolConfig`: Flat Zod-validated structure
- `DatabasePoolConfig`: Nested structure with different property names

TypeScript's `as` operator bypasses type checking, silently bridging incompatible hierarchies. Runtime type errors are possible if the structures actually differ.

**Issue 2 - Express User Index Signature**:

```typescript
declare global {
  namespace Express {
    interface User {
      id: string;
      email: string;
      role: string;
      [key: string]: unknown; // ← Erodes type safety
    }
  }
}
```

The index signature allows any property access:

```typescript
// All of these compile without warnings:
req.user.id; // OK - actually exists
req.user.typo; // Compiles! Returns undefined at runtime
req.user.whatever; // Compiles! No type error
req.user.foo.bar; // Runtime error (cannot read property 'bar' of undefined)
```

This defeats TypeScript's purpose - catching typos and undefined property access at compile time.

## Proposed Solutions

### Option 1: Align Types or Return Validated Type Directly (Recommended for Issue 1)

Either:

- Return `ValidatedPoolConfig` directly and update consumers, OR
- Align Zod schema structure with `DatabasePoolConfig`

**Pros**:

- Type-safe
- No runtime surprises
- Compiler catches mismatches

**Cons**:

- May require refactoring consumers
- Need to decide which type is authoritative

### Option 2: Remove Index Signature, Define Named Interface (Recommended for Issue 2)

Remove `[key: string]: unknown` and define explicit optional properties.

**Pros**:

- Catches typos at compile time
- Better autocomplete
- Explicit about what properties exist

**Cons**:

- Must update type when adding new properties (this is actually a pro for safety)

**Implementation**:

```typescript
declare global {
  namespace Express {
    interface User {
      id: string;
      email: string;
      role: string;
      // Explicit optional properties instead of index signature
      organizationId?: string;
      permissions?: string[];
    }
  }
}
```

### Option 3: Transformation Function with Type Guards

Create explicit transformation function that type-guards the conversion.

**Pros**:

- Explicit about transformation
- Can validate at runtime
- Type-safe

**Cons**:

- More boilerplate
- Need to maintain transformation logic

**Implementation**:

```typescript
function toPoolConfig(validated: ValidatedPoolConfig): DatabasePoolConfig {
  // Explicit transformation with runtime checks
  return {
    host: validated.host,
    port: validated.port,
    // ... map all properties explicitly
  };
}
```

## Technical Details

**Root cause 1 - Type Cast**:
Zod schema was added later to validate configuration, but the existing `DatabasePoolConfig` type wasn't updated to match. Developer used `as` to suppress type errors instead of fixing the mismatch.

**Root cause 2 - Index Signature**:
Added to support dynamic properties from JWT claims or OAuth providers without defining each one. Classic "flexible now, pay later" technical debt.

**Why `as` is dangerous**:

```typescript
interface A {
  x: string;
}
interface B {
  y: number;
}

const a: A = { x: 'hello' };
const b = a as B; // Compiles!

console.log(b.y.toFixed(2)); // Runtime error: cannot read property 'toFixed' of undefined
```

TypeScript's `as` says "trust me, I know better than the compiler." Usually you don't.

**Why index signatures erode safety**:

```typescript
interface User {
  id: string;
  [key: string]: unknown;
}

const user: User = { id: '123' };

// Intended: user.email (typo)
// Actual:
if (user.emial) {
  // Compiles! No error
  // This branch never executes, but TypeScript doesn't warn
}
```

**Impact**:

- Issue 1: Potential runtime type errors if structures differ
- Issue 2: Typos in property access compile without warnings
- Both: False confidence in type safety

## Acceptance Criteria

### For Issue 1 (Type Cast):

- [ ] Remove `as DatabasePoolConfig` cast
- [ ] Either return `ValidatedPoolConfig` directly, or
- [ ] Align Zod schema with `DatabasePoolConfig` type structure, or
- [ ] Create explicit type-guarded transformation function
- [ ] Tests verify returned object shape matches expected type
- [ ] No TypeScript errors without using `as` or `@ts-ignore`

### For Issue 2 (Index Signature):

- [ ] Remove `[key: string]: unknown` from Express.User interface
- [ ] Define explicit optional properties for all actually-used fields
- [ ] Verify all `req.user.*` access sites with grep
- [ ] Add missing properties to interface or fix typos
- [ ] Tests verify property access patterns
- [ ] TypeScript strict mode enabled (if not already)

### General:

- [ ] Run `tsc --noEmit` with strict mode - no errors
- [ ] ESLint rule to prevent `as` casts (or require justification comment)
- [ ] Documentation on when type assertions are acceptable (rare!)

## Work Log

_No work logged yet_

## Resources

- TypeScript type assertions: https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#type-assertions
- Zod schema inference: https://zod.dev/?id=type-inference
- Express TypeScript types: https://expressjs.com/en/advanced/best-practice-security.html
- Index signatures considered harmful: https://effectivetypescript.com/2020/04/09/avoid-infecting/
- Related files:
  - `/Users/fp/Desktop/Sovren/packages/backend/src/config/database-pool.config.ts`
  - `/Users/fp/Desktop/Sovren/packages/backend/src/types/express.d.ts`
