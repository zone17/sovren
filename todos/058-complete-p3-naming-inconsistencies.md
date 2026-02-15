---
status: pending
priority: p3
issue_id: '058'
tags: [code-review, consistency, naming]
dependencies: []
---

# Naming and Convention Inconsistencies

## Problem Statement

Multiple naming and convention inconsistencies exist across the codebase:

1. **requestId vs correlationId mismatch**: Error response uses `requestId` in metadata, but the source is `getCorrelationId()` and the header is `X-Correlation-ID`

2. **Middleware file naming conventions**: Three different patterns used:

   - Kebab-case with suffix: `error-handler-middleware.ts`
   - Kebab-case no suffix: `correlation-id.ts`
   - camelCase: `rateLimit.ts`

3. **Unsafe header type casting**: `as string` casts on Express headers that can be `string | string[]` (correlation-id.ts:54-56, csrf.ts:145)

4. **Export style inconsistency**: Default exports on `logger` and `ErrorBoundary` despite project preferring named exports

5. **Unnecessary type assertion**: `as const` on `SENSITIVE_FIELDS` provides no value since the union type is never used

These inconsistencies reduce code readability and increase cognitive load for developers.

## Findings

**Locations**:

- `middleware/error-handler-middleware.ts:97` (requestId naming)
- `middleware/*.ts` (file naming conventions)
- `middleware/correlation-id.ts:54-56` (header casting)
- `middleware/csrf.ts:145` (header casting)
- `lib/logger.ts:95` (default export)
- `monitoring/ErrorBoundary.tsx:259` (default export)
- `lib/sensitive-fields.ts:6-20` (unnecessary `as const`)

**Impact**:

- Developer confusion about correct naming conventions
- Type safety issues with header access (arrays not handled)
- Inconsistent import styles across codebase
- Unnecessarily complex code (`as const` without benefit)

## Proposed Solutions

### 1. Rename requestId to correlationId

**Change**: `error-handler-middleware.ts:97`

```typescript
// Before
requestId: getCorrelationId(req);

// After
correlationId: getCorrelationId(req);
```

### 2. Standardize Middleware Naming

**Convention**: Use kebab-case without `-middleware` suffix (matches Express community convention)

**Changes**:

- `error-handler-middleware.ts` → `error-handler.ts`
- `rateLimit.ts` → `rate-limit.ts`
- Keep: `correlation-id.ts`, `csrf.ts` (already compliant)

### 3. Create Header Helper for Type Safety

**Add**: `middleware/lib/headers.ts`

```typescript
export function getHeader(req: Request, name: string): string | undefined {
  const value = req.get(name);
  return Array.isArray(value) ? value[0] : value;
}
```

**Update**: `correlation-id.ts:54-56`, `csrf.ts:145` to use helper

### 4. Switch to Named Exports

**Changes**:

- `lib/logger.ts:95`: `export const logger = winston.createLogger(...)`
- `monitoring/ErrorBoundary.tsx:259`: `export { ErrorBoundary }`

Update all import statements accordingly.

### 5. Remove Unnecessary `as const`

**Change**: `lib/sensitive-fields.ts:6-20`

```typescript
// Before
export const SENSITIVE_FIELDS = [...] as const;

// After
export const SENSITIVE_FIELDS = [...];
```

## Technical Details

**Files Affected**:

- `middleware/error-handler-middleware.ts`
- `middleware/error-handler.ts` (renamed)
- `middleware/rateLimit.ts`
- `middleware/rate-limit.ts` (renamed)
- `middleware/correlation-id.ts`
- `middleware/csrf.ts`
- `middleware/lib/headers.ts` (new)
- `lib/logger.ts`
- `monitoring/ErrorBoundary.tsx`
- `lib/sensitive-fields.ts`
- All files importing logger or ErrorBoundary

**Complexity**: Low (renaming + refactoring)

**Breaking Changes**:

- Import paths change for renamed middleware files
- Named export changes require import updates

## Acceptance Criteria

- [ ] All error responses use `correlationId` (not `requestId`)
- [ ] All middleware files use kebab-case without suffix
- [ ] Header helper created and used for all header access
- [ ] `logger` and `ErrorBoundary` use named exports
- [ ] All imports updated to use named exports
- [ ] `as const` removed from `SENSITIVE_FIELDS`
- [ ] TypeScript compilation succeeds with no type errors
- [ ] All tests pass
- [ ] ESLint/Prettier checks pass

## Work Log

_No work logged yet_

## Resources

- PR #73: Post-Remediation Review
- Express header types: https://expressjs.com/en/api.html#req.get
- TypeScript handbook on `as const`: https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-4.html#const-assertions
