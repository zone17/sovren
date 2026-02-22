---
id: 438
severity: P3
status: complete
title: 'env-validation: process.exit(1) makes the module untestable'
file: packages/backend/src/utils/env-validation.ts
found_in: PR #89
reviewer: review-backend
---

# validateEnvironment calls process.exit(1) on failure

## Problem

When validation fails, `validateEnvironment()` calls `process.exit(1)` at line 440:

```typescript
} catch (error) {
  console.error('Environment validation failed:', error);
  // ... helpful messages ...
  process.exit(1);  // <-- kills the process
}
```

This makes it impossible to test error cases because the test process itself exits. It also prevents graceful shutdown, signal handling, and connection cleanup.

## Location

```
packages/backend/src/utils/env-validation.ts  line 440
```

## Fix

Throw the error instead of exiting. Let the caller (typically the server bootstrap) decide whether to exit:

```typescript
} catch (error) {
  console.error('Environment validation failed:', error);
  // ... helpful messages ...
  throw new Error(`Environment validation failed: ${error instanceof Error ? error.message : String(error)}`);
}
```

The server bootstrap (`index.ts` or `server.ts`) can then catch and exit:

```typescript
try {
  await initializeEnvironment();
} catch (err) {
  console.error(err);
  process.exit(1);
}
```

## Severity Justification

P3: Testability issue. Tests for invalid env configurations cannot exercise the catch branch without process termination. Also prevents graceful cleanup.
