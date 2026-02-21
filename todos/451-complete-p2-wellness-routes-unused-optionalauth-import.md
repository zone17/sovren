---
id: 451
severity: P2
status: complete
title: "wellness.routes.ts: unused optionalAuth import after auth upgrade"
file: packages/backend/src/routes/v2/wellness.routes.ts
found_in: PR #92
reviewer: review-typescript, review-architecture
---

# Unused optionalAuth import in wellness.routes.ts

## Problem

After changing the `/benchmark` endpoint from `optionalAuth` to `authenticate`, the `optionalAuth` import on line 10 is no longer used in this file:

```typescript
import { authenticate, requireCreator, optionalAuth, getAuthUser } from '../../middleware/auth';
//                                      ^^^^^^^^^^^^^ unused
```

This will trigger ESLint `no-unused-imports` warnings and is dead code.

## Location

```
packages/backend/src/routes/v2/wellness.routes.ts  line 10
```

## Fix

Remove `optionalAuth` from the import:

```typescript
import { authenticate, requireCreator, getAuthUser } from '../../middleware/auth';
```

## Severity Justification

P2: Code quality. Dead imports trigger lint warnings and add confusion about which middleware is actually used in the file. Trivial one-line fix.
