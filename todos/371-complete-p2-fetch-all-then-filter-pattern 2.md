---
status: pending
priority: p2
issue_id: 371
tags:
  - code-review
  - performance
  - agent-native
dependencies: []
---

# Fetch-All-Then-Filter Pattern in GET /:id Endpoints

## Problem Statement

Several GET /:id endpoints (circles, contracts) load all records with `.select('*')` then filter in JavaScript instead of using a SQL WHERE clause. This wastes DB bandwidth and memory, transferring entire tables over the wire when only a single row is needed.

## Findings

**Source agents:** performance-agent, code-review-agent

**Evidence:**

- File: `packages/backend/src/services/community/CreatorCircleService.ts`
- Issue: Uses `.select('*')` to fetch all circle records, then filters by ID in JS
- File: `packages/backend/src/services/finance/ContractService.ts`
- Issue: Same pattern — loads all contracts then filters client-side

## Proposed Solutions

### Option A: Push filter to Supabase query

- **Approach:** Change `.select('*')` to `.select('*').eq('id', id).single()` for single-record fetches. This pushes the WHERE clause to PostgreSQL, returning only the matching row.
- **Effort:** Small
- **Risk:** Low

## Recommended Action

_To be filled during triage_

## Technical Details

**Affected files:**

- `packages/backend/src/services/community/CreatorCircleService.ts`
- `packages/backend/src/services/finance/ContractService.ts`

## Acceptance Criteria

- [ ] All GET /:id endpoints use `.eq('id', id).single()` instead of fetching all records
- [ ] No JavaScript-side filtering of full table results remains
- [ ] Existing tests pass with the query change

## Work Log

| Date       | Action  | Notes                      |
| ---------- | ------- | -------------------------- |
| 2026-02-19 | Created | PR #86 code review finding |

## Resources

- PR: https://github.com/zone17/sovren/pull/86
