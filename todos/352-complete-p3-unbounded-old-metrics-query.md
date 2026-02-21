---
status: pending
priority: p3
issue_id: 352
tags: [code-review, performance]
---

# Unbounded old metrics query in CrossPlatformAnalyticsService

## Problem Statement

A query in CrossPlatformAnalyticsService fetches metrics without a row limit, potentially returning unbounded result sets that degrade performance and consume excessive memory for users with large historical data.

## Findings

- File: `packages/backend/src/services/distribution/CrossPlatformAnalyticsService.ts` (lines 70-76)
- Query selects metrics without `.limit()` clause
- For active users with months of cross-platform data, this could return thousands of rows
- No pagination or cursor-based fetching implemented

## Proposed Solutions

1. Add `.limit()` to the query with a sensible default (e.g., 1000 rows)
2. If the endpoint is meant to return all historical data, add pagination support
3. Consider adding a date range filter to scope the query

## Acceptance Criteria

- [ ] Query includes a `.limit()` clause or pagination parameters
- [ ] Large result sets do not cause memory issues or slow responses
- [ ] API consumers can request specific date ranges or pages if needed
