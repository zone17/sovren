---
status: pending
priority: p2
issue_id: "199"
tags: [code-review, pr-85, performance]
---

# Sequential Token Refresh is O(n) with External API Calls

## Problem Statement
refreshExpiringTokens() processes all expiring tokens sequentially in a for loop. O(n) where each iteration makes 2+ DB queries + an external API call. With 100 connections, this could take minutes.

## Findings
- **File**: `packages/backend/src/services/distribution/PlatformConnectionService.ts:257-314`
- `refreshExpiringTokens()` iterates over all expiring platform connections in a sequential `for` loop
- Each iteration performs: 1 DB read (get connection details), 1 external API call (refresh token with platform), 1-2 DB writes (update tokens)
- With 100 platform connections expiring, this runs ~300+ sequential async operations
- External API calls have variable latency (100ms-2s each), making total execution time unpredictable
- If this runs on a scheduled job, it may overlap with the next scheduled run

## Proposed Solutions
1. Use `Promise.all` with a concurrency limiter (e.g., `p-limit(5)`) to refresh tokens in parallel with backpressure, reducing wall-clock time by ~20x while respecting platform rate limits
2. Use a work queue approach: enqueue each token refresh as a separate BullMQ job with rate limiting per platform, allowing horizontal scaling and automatic retry

## Acceptance Criteria
- [ ] Token refresh processes multiple connections concurrently (not sequentially)
- [ ] Concurrency is bounded to prevent overwhelming platform APIs (e.g., max 5 concurrent refreshes)
- [ ] Total refresh time for 100 connections is under 30 seconds (down from potentially minutes)
- [ ] Failed refreshes for one connection do not block or abort other connections
