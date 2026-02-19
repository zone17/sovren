---
status: pending
priority: p1
issue_id: 365
tags:
  - code-review
  - performance
  - security
  - dos
dependencies: []
---

# Tax Summary Unbounded Query Risks OOM

## Problem Statement

getTaxSummary() loads ALL expenses for a quarter without pagination or streaming. A creator with thousands of expenses could trigger OOM or extreme latency. The quarterly grouping means up to 3 months of data loaded at once. This is both a performance issue and a potential denial-of-service vector.

## Findings

**Source agents:** performance-review, security-audit

**Evidence:**

- File: `packages/backend/src/services/finance/TaxService.ts`
- Issue: getTaxSummary() queries all expenses for a date range (quarter) and loads every row into memory to compute aggregates. No .limit() or pagination is applied. For creators with high expense volume, this can exhaust Node.js heap memory or cause request timeouts.

## Proposed Solutions

### Option A: DB-level aggregation via RPC

- **Approach:** Replace the in-memory aggregation with a Supabase RPC function that performs SUM/COUNT/GROUP BY at the database level. Only the aggregated results are returned to the application, regardless of row count.
- **Effort:** Medium
- **Risk:** Low

### Option B: Paginated accumulation

- **Approach:** Add cursor-based pagination to the expense query (e.g., .range(0, 999) with iteration). Accumulate totals across pages without holding all rows in memory simultaneously.
- **Effort:** Small
- **Risk:** Medium

## Recommended Action

_To be filled during triage_

## Technical Details

**Affected files:**

- `packages/backend/src/services/finance/TaxService.ts`

## Acceptance Criteria

- [ ] getTaxSummary() does not load all expense rows into memory at once
- [ ] Tax summary results are correct for creators with >1000 expenses per quarter
- [ ] Memory usage remains bounded regardless of expense count
- [ ] Response time for tax summary remains under 5 seconds for 10,000+ expenses
- [ ] Existing tax summary output format is preserved (no breaking API change)

## Work Log

| Date       | Action  | Notes                      |
| ---------- | ------- | -------------------------- |
| 2026-02-19 | Created | PR #86 code review finding |

## Resources

- PR: https://github.com/zone17/sovren/pull/86
