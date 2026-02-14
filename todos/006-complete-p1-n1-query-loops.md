---
status: pending
priority: p1
issue_id: 006
tags: [code-review, performance]
dependencies: []
---

# N+1 Query Patterns in Multiple Services

## Problem Statement

N+1 query patterns in subscription notification dispatch (sequential INSERT per subscriber, lines 321-344) and user preference updates (sequential upsert per tag, lines 436-444). Also redundant DB round trips on every feed request (lines 101-114) and 4 sequential queries per recommendation request (lines 60-157).

## Findings

Performance-oracle found:

1. subscription-management-service-extensions.ts:321-344 loops subscribers with individual INSERT per notification
2. recommendation-service.ts:436-444 loops tags with individual upsert
3. content-discovery-service.ts:101-114 fetches following list then separately counts it
4. recommendation-service.ts:60-157 runs 4 sequential queries that could be parallelized

## Proposed Solutions

### Option A: Batch Operations and Parallelization

Batch all INSERT/upsert operations using multi-row inserts. Use Promise.all() for independent queries.

**Pros:** Immediate performance improvement, straightforward implementation, maintains existing schema
**Cons:** Code complexity increase, requires careful transaction handling
**Effort:** Medium
**Risk:** Low

### Option B: Materialized Views and Advanced Batching

Refactor to use Supabase batch operations and materialized views for frequently-accessed aggregates.

**Pros:** Maximum performance gains, scales better long-term, reduces repeated computation
**Cons:** Schema changes required, materialized view refresh overhead, complex migration
**Effort:** Large
**Risk:** Medium

## Technical Details

**Affected Files:**

- packages/backend/src/services/subscription-management-service-extensions.ts (321-344)
- packages/backend/src/services/recommendation-service.ts (60-157, 436-444)
- packages/backend/src/services/content-discovery-service.ts (101-114)

## Acceptance Criteria

- [ ] No for-loop with individual DB operations
- [ ] All batch operations use multi-row inserts
- [ ] Independent queries use Promise.all()
- [ ] Feed request uses single query for following list + count
- [ ] Performance testing shows measurable improvement in query counts and latency

## Work Log

- 2026-02-11: Created from /workflows:review multi-agent code review
