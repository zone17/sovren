---
status: pending
priority: p3
issue_id: '412'
tags: [code-review, types, quality, pr-87]
dependencies: []
---

# CacheService `as T & string` cast is not type-safe

## Problem Statement

The CacheService replacement of `as unknown as T` with `as T & string` (todo #377) is not meaningfully more type-safe. `T & string` is an intersection type that narrows to `string` when `T extends string`, but when `T` is not a string (e.g., `T = object`), the intersection `T & string` is `never` — which TypeScript still allows via the `as` assertion.

The old pattern `as unknown as T` was a double-cast. The new pattern `as T & string` is a single-cast that happens to compile but doesn't actually enforce that `T` is `string`. Both are equally unsafe type assertions — the new one just looks nicer.

## Findings

- `CacheService.ts:264`: `return value as T & string;` (in `get()` method)
- `CacheService.ts:479`: `result.set(key, value as T & string);` (in `mget()` method)
- The comment "Raw string value -- valid when T is string" is correct about intent but the cast doesn't enforce this
- A truly type-safe approach would use a runtime type guard or method overload

## Proposed Solutions

### Option 1: Accept as-is (pragmatic)

**Approach:** The cast is in a catch block that only runs when `JSON.parse()` fails, meaning the value IS a raw string. The comment documents the intent. This is a minor type-safety gap in a well-understood code path.

**Effort:** 0 minutes

**Risk:** None

---

### Option 2: Add runtime type assertion

**Approach:** Add `if (typeof value !== 'string') return null;` before the cast (which is redundant since Redis always returns strings, but makes the code self-documenting).

**Effort:** 5 minutes

**Risk:** None

## Recommended Action

Accept as-is. The `as T & string` pattern is marginally better than `as unknown as T` for readability and the comment documents the intent.

## Technical Details

**Affected files:**

- `packages/backend/src/services/CacheService.ts:264,479`

## Acceptance Criteria

- [ ] Decision documented

## Work Log

### 2026-02-20 - Code Review Discovery

**By:** Claude Code (PR #87 review)

## Resources

- **PR:** #87
- **Original finding:** Todo #377 (as-unknown-as-cast-patterns)
