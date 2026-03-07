---
id: 425
severity: P2
status: complete
title: 'env-validation: applyEnvFallbacks mutates process.env before Zod parse but after import'
file: packages/backend/src/utils/env-validation.ts
found_in: PR #89
reviewer: review-backend
---

# Env fallback function mutates process.env without clearing old values

## Problem

`applyEnvFallbacks()` copies old env var names to new names, but only if the new name is NOT already set:

```typescript
if (!process.env[newName] && process.env[oldName]) {
  process.env[newName] = process.env[oldName];
}
```

This is correct for the primary use case. However, there are two edge cases:

1. **Both old and new set with different values:** The new value wins silently. No deprecation warning is emitted, and the user may not realize the old value is being ignored. This could cause confusion during migration.

2. **`cachedEnv` singleton:** If `initializeEnvironment()` is called twice (e.g., in tests or after config hot-reload), `applyEnvFallbacks()` runs again but `cachedEnv` is already set from the first call. The second call returns the cached env, ignoring any env var changes between calls.

## Location

```
packages/backend/src/utils/env-validation.ts  lines 373-389 (applyEnvFallbacks)
packages/backend/src/utils/env-validation.ts  lines 459-463 (initializeEnvironment)
```

## Fix

1. Warn when both old and new names are set with different values:

```typescript
if (process.env[newName] && process.env[oldName] && process.env[newName] !== process.env[oldName]) {
  console.warn(
    `[env-validation] WARNING: Both ${oldName} and ${newName} are set with different values. ` +
      `Using ${newName}. Remove ${oldName} from your .env file.`
  );
}
```

2. Add a `forceRevalidate` parameter to `initializeEnvironment()` for test/hot-reload scenarios:

```typescript
export async function initializeEnvironment(opts?: { force?: boolean }): Promise<ValidatedEnv> {
  if (!cachedEnv || opts?.force) {
    cachedEnv = await validateEnvironment();
  }
  return cachedEnv;
}
```

## Verification

Add unit tests for:

- Both old and new env var set with different values
- `initializeEnvironment({ force: true })` re-reads env vars
