---
status: pending
priority: p1
issue_id: 366
tags:
  - code-review
  - data-integrity
  - performance
  - financial
dependencies: []
---

# Revenue Breakdown Silently Truncated at 1000 Rows

## Problem Statement

Revenue breakdown query uses .limit(1000) but doesn't check if more rows exist. If a creator has >1000 revenue entries, the breakdown totals will be silently incorrect, showing lower revenue than actual. This directly affects financial reporting accuracy and could cause creators to underreport income.

## Findings

**Source agents:** data-integrity-review, financial-review

**Evidence:**

- File: `packages/backend/src/services/finance/RevenueService.ts`
- Issue: Revenue breakdown query applies .limit(1000) without any mechanism to detect or handle truncation. Creators with more than 1000 revenue entries receive silently incomplete data. The totals computed from truncated data will be mathematically incorrect.

## Proposed Solutions

### Option A: DB-level aggregation

- **Approach:** Replace the row-level query + client-side aggregation with a Supabase RPC or raw SQL that performs GROUP BY with SUM at the database level. This handles any number of rows without truncation.
- **Effort:** Medium
- **Risk:** Low

### Option B: Paginated accumulation with truncation flag

- **Approach:** Add pagination to accumulate totals across all pages. As a safety net, return a `truncated: true` flag in the response if any page indicates more data exists.
- **Effort:** Small
- **Risk:** Medium

## Recommended Action

_To be filled during triage_

## Technical Details

**Affected files:**

- `packages/backend/src/services/finance/RevenueService.ts`

## Acceptance Criteria

- [ ] Revenue breakdown totals are correct for creators with >1000 revenue entries
- [ ] No silent data truncation occurs in revenue calculations
- [ ] Revenue breakdown performance remains acceptable for high-volume creators
- [ ] API response format remains backward-compatible
- [ ] Integration test with >1000 entries verifies total accuracy

## Work Log

| Date       | Action  | Notes                      |
| ---------- | ------- | -------------------------- |
| 2026-02-19 | Created | PR #86 code review finding |

## Resources

- PR: https://github.com/zone17/sovren/pull/86
