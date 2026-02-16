---
status: pending
priority: p3
issue_id: "163"
tags: [code-review, pr-82, phase-7, performance, database, parallelization]
dependencies: []
---

# Sequential Database Queries in Wellness Dashboard

## Problem Statement
WellnessService methods make sequential database queries that could run in parallel using `Promise.all()`. Affects dashboard load time.

## Findings
- Multiple `await supabase.from()` calls that are independent and could run concurrently
- Dashboard rendering blocked until all sequential queries complete
- Estimated 2-3x latency improvement with parallelization
- Flagged by: performance-oracle

## Proposed Solutions
### Option 1: Promise.all for Independent Queries
**Approach:** Wrap independent queries in `Promise.all([query1, query2, query3])`.
**Effort:** 30 minutes | **Risk:** Low

## Technical Details
- `packages/backend/src/services/wellness/WellnessService.ts`

## Acceptance Criteria
- [ ] Independent queries run in parallel
- [ ] Dashboard load time reduced

## Work Log
### 2026-02-14 - Discovery
**By:** Claude Code Review
Tags: performance, database, parallelization
