---
id: 430
severity: P2
status: complete
title: "ILightningService interface exists but DI token still uses Record<string, unknown>"
file: packages/backend/src/container/types.ts
found_in: PR #89
reviewer: review-backend
---

# DI token for LightningService not updated to use new ILightningService interface

## Problem

This PR extracted `ILightningService` into `packages/backend/src/interfaces/finance/ILightningService.ts` (a new file). The `MarketplaceService` correctly imports and uses this interface. However, the DI container registry in `types.ts` still uses `Record<string, unknown>` for the `LightningService` token:

```typescript
// Line 346-349 in types.ts
LightningService: new ServiceToken<Record<string, unknown>>(
  'LightningService',
  'Bitcoin Lightning Network integration'
),
```

This means:
1. Any service resolving `TYPES.LightningService` from the container gets an untyped `Record<string, unknown>` instead of `ILightningService`
2. The type safety gained by extracting the interface is lost at the DI boundary
3. Consumers must cast the resolved service, defeating the purpose of the interface extraction

## Location

```
packages/backend/src/container/types.ts  line 346-349
packages/backend/src/interfaces/finance/ILightningService.ts  (the new interface)
```

## Fix

Update the DI token to use the new interface:

```typescript
import type { ILightningService } from '../interfaces/finance/ILightningService';

// ...

LightningService: new ServiceToken<ILightningService>(
  'LightningService',
  'Bitcoin Lightning Network integration'
),
```

## Severity Justification

P2: Type safety regression. The interface was extracted specifically to improve typing, but the DI container (the primary resolution point) still uses the untyped fallback.

## Verification

1. Update the token type
2. Check that all `container.resolve(TYPES.LightningService)` call sites compile without casts
