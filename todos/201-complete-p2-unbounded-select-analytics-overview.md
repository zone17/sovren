---
status: pending
priority: p2
issue_id: "201"
tags: [code-review, pr-85, performance]
---

# Unbounded SELECT in Analytics Overview

## Problem Statement
CrossPlatformAnalyticsService.getOverview() fetches all platform_metrics_history rows for a creator with no LIMIT or date range filter. Grows unbounded over time.

## Findings
- **File**: `packages/backend/src/services/distribution/CrossPlatformAnalyticsService.ts` (getOverview method)
- The `getOverview()` method queries `platform_metrics_history` filtered only by `creator_id`
- No `LIMIT` clause restricts the result set size
- No date range filter (e.g., `WHERE recorded_at > NOW() - INTERVAL '30 days'`) bounds the time window
- As metrics accumulate daily per platform, row count grows linearly: creators x platforms x days
- After 1 year with 4 platforms, a single creator could have ~1,460 rows; with 1,000 creators, the table has ~1.46M rows
- Query response time and memory usage will degrade progressively

## Proposed Solutions
1. Add a default date range filter (e.g., last 30 days) and a LIMIT clause (e.g., 1000 rows max). Accept optional `startDate`/`endDate` parameters to allow custom ranges.
2. Create a materialized view or summary table that pre-aggregates metrics by week/month, and query that for the overview instead of raw history rows.

## Acceptance Criteria
- [ ] getOverview() includes a date range filter (default: last 30 days)
- [ ] A LIMIT clause prevents unbounded result sets
- [ ] API accepts optional startDate/endDate parameters for custom date ranges
- [ ] Response time remains under 500ms with 1 year of data for a single creator
