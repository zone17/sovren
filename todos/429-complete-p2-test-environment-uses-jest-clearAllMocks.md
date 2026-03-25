---
id: 429
severity: P2
status: complete
title: 'test-environment.ts: resetTestEnvironment calls jest.clearAllMocks instead of vi.clearAllMocks'
file: packages/frontend/src/test-utils/test-environment.ts
found_in: PR #89
reviewer: review-testing
---

# test-environment.ts still references jest.clearAllMocks after Vitest migration

## Problem

The `resetTestEnvironment()` function at line 273 calls `jest.clearAllMocks()`, but the project migrated to Vitest. This function will throw a ReferenceError at runtime since `jest` is not defined in Vitest environments.

```typescript
// Line 273 - BROKEN
export function resetTestEnvironment(): void {
  jest.clearAllMocks(); // Should be vi.clearAllMocks()
  setupTestEnvironment();
}
```

This was NOT fixed in this PR despite the Vitest migration happening in an earlier PR. The function is likely not called in any active test (hence no failures), but it's exported and available for use.

## Location

```
packages/frontend/src/test-utils/test-environment.ts  line 273
```

## Fix

```typescript
import { vi } from 'vitest';

export function resetTestEnvironment(): void {
  vi.clearAllMocks();
  setupTestEnvironment();
}
```

## Severity Justification

P2: Dead code that will fail at runtime if any test calls it. The function is exported from a shared test utility, so new tests could unknowingly use it.

## Verification

1. Grep for `resetTestEnvironment` usage across the codebase
2. Replace `jest.clearAllMocks()` with `vi.clearAllMocks()`
3. Add `import { vi } from 'vitest'` if not already imported
