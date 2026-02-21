---
id: 457
severity: P3
status: pending
title: "SERVICE_DEPENDENCIES map missing 'Database' for CrossPostService"
file: packages/backend/src/container/types.ts
found_in: PR #92
reviewer: review-architecture
---

# SERVICE_DEPENDENCIES stale for CrossPostService

## Problem

The dependency map at line 608 lists:
```typescript
CrossPostService: ['PlatformConnectionService', 'QueueService', 'Logger'],
```

But the actual constructor accepts `ISupabaseClient` as its first parameter (resolved via `TYPES.Database` in phase8.bindings.ts). The `Database` dependency is missing from the map.

## Location

```
packages/backend/src/container/types.ts  line 608
```

## Fix

```typescript
CrossPostService: ['Database', 'PlatformConnectionService', 'QueueService', 'Logger'],
```

## Severity Justification

P3: Documentation accuracy. The SERVICE_DEPENDENCIES map is used for dependency analysis tooling, not runtime resolution. Pre-existing issue made more visible by the new auth check which adds a second `db` query.
