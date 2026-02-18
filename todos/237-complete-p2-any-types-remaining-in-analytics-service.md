# Todo 237: Remaining `any` Types in CrossPlatformAnalyticsService

**Priority**: P2
**Category**: Type Safety
**Status**: pending
**Source**: Pattern recognition review of commit d928918

## Problem

`CrossPlatformAnalyticsService` still uses `any` in 6 places despite Todo 216 (ISupabaseClient returns any) being marked complete:

- Line 44: `new Map<string, any>()` — latestByPlatform
- Line 60: `new Map<string, any>()` — oldByPlatform
- Line 81: `platform as any` — casting to SupportedPlatform
- Line 109: `(post: any) =>` — mapping crossPosts
- Line 132: `new Map<string, any>()` — latestByPlatform in getROI
- Line 162: `platform as any` — casting to SupportedPlatform

The `ISupabaseClient` interface now returns typed `SupabaseFilterBuilder<T>`, but the service doesn't pass a type parameter to `this.db.from()`, so it defaults to `Record<string, unknown>`. The Maps should be typed with proper row interfaces.

## Files

- `packages/backend/src/services/distribution/CrossPlatformAnalyticsService.ts:44,60,81,109,132,162`

## Recommended Fix

Define row type interfaces for the DB tables being queried:

```typescript
interface MetricsHistoryRow {
  platform: SupportedPlatform;
  followers: number;
  engagement_rate: string;
  impressions_30d: number;
  recorded_at: string;
}
```

Then use `this.db.from<MetricsHistoryRow>('platform_metrics_history')` and type the Maps accordingly.

Also fix `platform as any` to use a proper type assertion or validation.
