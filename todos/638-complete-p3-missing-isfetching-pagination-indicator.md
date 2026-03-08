---
status: pending
priority: p3
issue_id: '638'
tags: [code-review, frontend, ux, pagination]
dependencies: []
---

# Missing isFetching indicator during pagination

## Problem Statement

`CommentList.tsx` does not destructure or display `isFetching` from the query. When paginating with `keepPreviousData`, old data shows but no loading indicator is visible.

## Findings

- Pattern-Recognition agent flagged (common-solutions.md #58 checklist incomplete)

## Proposed Solutions

Add `isFetching` to destructured result, show subtle loading indicator when `isFetching && !isLoading`.

## Acceptance Criteria

- [ ] isFetching state shown during background page fetches
