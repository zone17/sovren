# Todo 225 — P2: Unbounded query in CrossPlatformAnalyticsService.getROI()

## Priority: P2 (Performance)
## Status: pending
## Found by: performance-review agent
## Commit: d928918

## Description

`CrossPlatformAnalyticsService.getROI()` (line 126-137) queries `platform_metrics_history` without a `.limit()` or date bound:

```typescript
const { data: metrics } = await this.db
  .from('platform_metrics_history')
  .select('platform, impressions_30d, engagement_rate')
  .eq('creator_id', creatorId)
  .order('recorded_at', { ascending: false });
```

This fetches **all historical metrics rows** for a creator just to deduplicate the latest per platform. For a creator with daily snapshots across 5 platforms over 1 year, that is ~1,825 rows fetched to use only ~5.

By contrast, `getOverview()` at line 30-37 correctly bounds to 30 days and limits to 500 rows.

## Impact

- Linear scan growth as history accumulates
- Wastes network bandwidth between API server and Supabase
- Potential timeout for long-running creators

## Fix

Add `.gte('recorded_at', thirtyDaysAgo)` and `.limit(500)` to match the pattern used in `getOverview()`:

```typescript
const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
const { data: metrics } = await this.db
  .from('platform_metrics_history')
  .select('platform, impressions_30d, engagement_rate')
  .eq('creator_id', creatorId)
  .gte('recorded_at', thirtyDaysAgo)
  .order('recorded_at', { ascending: false })
  .limit(500);
```

## File
`packages/backend/src/services/distribution/CrossPlatformAnalyticsService.ts:126-137`
