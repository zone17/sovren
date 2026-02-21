---
status: deferred
priority: p2
issue_id: '279'
tags: [code-review, performance, scalability]
dependencies: []
---

# Count-by-Fetch + In-Memory Aggregation Patterns

## Problem Statement

Several services fetch all rows to count them or compute aggregates in JS instead of using SQL COUNT/SUM. This transfers unnecessary data over the network and wastes memory.

## Findings

- `packages/backend/src/services/community/CreatorCircleService.ts` — fetches all members to count
- `packages/backend/src/services/finance/RevenueTrackingService.ts` — fetches all entries for SUM
- `packages/backend/src/services/finance/TaxPreparationService.ts` — fetches all for aggregation

## Proposed Solutions

### Option 1: Use SQL aggregates

**Approach:** Replace fetch-all-then-count with Supabase .select('count', { count: 'exact' }) and .select('amount.sum()') for aggregations.
**Effort:** 2h **Risk:** Low

## Acceptance Criteria

- [ ] Count operations use SQL COUNT
- [ ] Sum operations use SQL SUM
- [ ] No fetch-all-for-aggregate patterns remain

## Work Log

### 2026-02-18 - Code Review Discovery

**By:** Claude Code (13-agent parallel review)
