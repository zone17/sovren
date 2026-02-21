---
status: pending
priority: p2
issue_id: 380
tags:
  - code-review
  - performance
dependencies: []
---

# Revenue Analytics Endpoint Runs Two Queries Instead of One

## Problem Statement

Revenue analytics endpoint runs two separate SELECT queries on the same table that could be combined into a single query with different aggregation columns. This doubles the DB round-trips and table scans for every analytics request.

## Findings

**Source agents:** performance-agent, code-review-agent

**Evidence:**

- File: `packages/backend/src/services/finance/RevenueService.ts`
- Issue: Two separate SELECT queries hit the same table with different aggregation functions, when a single query with multiple aggregation columns would suffice.

## Proposed Solutions

### Option A: Combine into single query

- **Approach:** Combine into a single query with multiple aggregation functions (SUM, COUNT, GROUP BY). Reduces DB round-trips from 2 to 1.
- **Effort:** Small
- **Risk:** Low

## Recommended Action

_To be filled during triage_

## Technical Details

**Affected files:**

- `packages/backend/src/services/finance/RevenueService.ts`

## Acceptance Criteria

- [ ] Analytics data is fetched with a single query instead of two
- [ ] Query results match the previous two-query output exactly
- [ ] Response time for the analytics endpoint is measurably improved

## Work Log

| Date       | Action  | Notes                      |
| ---------- | ------- | -------------------------- |
| 2026-02-19 | Created | PR #86 code review finding |

## Resources

- PR: https://github.com/zone17/sovren/pull/86
