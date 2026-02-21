---
id: 444
severity: P3
status: pending
title: "env-validation: connectivity check is fire-and-forget with swallowed errors"
file: packages/backend/src/utils/env-validation.ts
found_in: PR #89
reviewer: review-backend
---

# validateEnvironment connectivity check swallows errors silently

## Problem

The connectivity validation is called with `.catch()` that only logs a warning:

```typescript
if (parsed.VALIDATE_ENV) {
  validateConnectivity(parsed).catch((error) => {
    console.warn('Connectivity validation failed:', error);
  });
}
```

This is documented as "non-blocking" but has several issues:

1. **No await** — the promise is fire-and-forget. The `validateEnvironment()` function returns before connectivity is checked.
2. **Error is swallowed** — if Supabase is unreachable, the server starts anyway and will fail on the first request with a confusing error.
3. **Race condition** — if a request arrives before the connectivity check completes, the server is in an indeterminate state.

## Location

```
packages/backend/src/utils/env-validation.ts  lines 410-414
```

## Fix

Either:
1. **Await it with a timeout** — fail fast if critical services are unreachable:

```typescript
if (parsed.VALIDATE_ENV) {
  try {
    await Promise.race([
      validateConnectivity(parsed),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Connectivity check timeout')), 5000)),
    ]);
  } catch (error) {
    console.warn('Connectivity validation failed:', error);
    // Don't throw — allow startup but log degraded state
  }
}
```

2. **Or remove it entirely** — health check endpoints (`/health`, `/ready`) already serve this purpose and are the proper mechanism for readiness checks.

## Severity Justification

P3: Startup reliability. The check provides false confidence — it reports "Environment validation successful" even when Supabase is down.
