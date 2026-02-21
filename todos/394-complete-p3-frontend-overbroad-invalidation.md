---
status: pending
priority: p3
issue_id: 394
tags:
  - code-review
  - frontend
  - performance
dependencies: []
---

# Overbroad React Query Invalidation in Mutation Handlers

## Problem Statement

Some mutation success handlers invalidate entire query namespaces (e.g., `invalidateQueries(['circles'])`) instead of specific queries (e.g., `invalidateQueries(['circles', circleId])`). This causes unnecessary re-fetches of all queries in that namespace, degrading performance and wasting bandwidth, especially on mobile connections.

## Findings

**Source agents:** frontend-agent, code-review-agent

**Evidence:**

- File: `packages/frontend/src/features/creator-network/hooks/*.ts`
- Issue: Mutation success callbacks invalidate broad query keys like `['circles']` which triggers re-fetches of every circles-related query, not just the one affected by the mutation.
- File: `packages/frontend/src/features/business/hooks/*.ts`
- Issue: Same pattern of overbroad invalidation in business feature hooks.

## Proposed Solutions

### Option A: Specific query key invalidation

- **Approach:** Update mutation success handlers to use specific query keys that target only the affected resource. For example, after updating circle with ID `abc`, invalidate `['circles', 'abc']` and `['circles', 'list']` instead of `['circles']`. Define query key factories per feature to ensure consistency.
- **Effort:** Medium
- **Risk:** Low

### Option B: Query key factory pattern

- **Approach:** Create query key factories (e.g., `circleKeys.detail(id)`, `circleKeys.list(filters)`) following the TanStack Query recommended pattern. Use these factories in both query definitions and invalidation calls to ensure precise cache management.
- **Effort:** Medium
- **Risk:** Low

## Recommended Action

_To be filled during triage_

## Technical Details

**Affected files:**

- `packages/frontend/src/features/creator-network/hooks/*.ts`
- `packages/frontend/src/features/business/hooks/*.ts`
- Potentially other feature hook files with similar patterns

## Acceptance Criteria

- [ ] Mutation handlers use specific query keys for invalidation
- [ ] Query key factories created for affected features
- [ ] No overbroad `invalidateQueries` calls with single-element key arrays for entity namespaces
- [ ] Verified that affected mutations still correctly update the UI after the change
- [ ] No unnecessary network requests observed after mutations

## Work Log

| Date       | Action  | Notes                      |
| ---------- | ------- | -------------------------- |
| 2026-02-19 | Created | PR #86 code review finding |

## Resources

- PR: https://github.com/zone17/sovren/pull/86
