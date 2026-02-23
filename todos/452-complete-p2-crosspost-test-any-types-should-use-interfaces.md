---
id: 452
severity: P2
status: pending
title: "CrossPostService.test.ts: 12 'any' types should use available interfaces"
file: packages/backend/src/services/distribution/__tests__/CrossPostService.test.ts
found_in: PR #92
reviewer: review-typescript
---

# CrossPostService test file uses 'any' extensively instead of available interfaces

## Problem

The test file declares 6 mock variables as `any` and uses `any` in callback parameters, despite proper interfaces being available:

```typescript
let mockDb: any;
let mockQueueService: any;
let mockPlatformService: any;
let mockLogger: any;
let contentChain: any;
let crossPostsChain: any;
```

The interfaces `ISupabaseClient`, `ILogger`, `IQueueService`, and `IPlatformConnectionService` all exist and could type the first 4 mocks. The `createMockChain` internals legitimately need `any` due to Vitest mock API conflicts with strict interfaces.

## Location

```
packages/backend/src/services/distribution/__tests__/CrossPostService.test.ts  lines 28-35, 93-94
```

## Fix

Type the 4 dependency mocks using their interfaces or Partial wrappers:

```typescript
import type { ILogger } from '../../../interfaces/shared/ILogger';
import type { IQueueService } from '../../../interfaces/queue/IQueueService';
import type { IPlatformConnectionService } from '../../../interfaces/distribution/IPlatformConnectionService';

let mockDb: ReturnType<typeof createMockDb>; // or ISupabaseClient
let mockQueueService: Partial<IQueueService>;
let mockPlatformService: Partial<IPlatformConnectionService>;
let mockLogger: Partial<ILogger>;
```

Add a justification comment on the `createMockChain` `any` usages explaining that Vitest mock methods (`mockReturnValue`, `mockResolvedValue`) conflict with Supabase interface types.

## Severity Justification

P2: Type safety in tests. The `any` types hide type mismatches between mocks and the actual service dependencies, reducing the value of the tests as contract verification.
