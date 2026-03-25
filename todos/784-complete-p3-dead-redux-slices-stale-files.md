---
status: pending
priority: p3
issue_id: 784
tags: [code-review, simplicity, dead-code, frontend]
dependencies: []
---

# Dead Redux Slices + Stale Root Files (~6,300 LOC)

## Problem Statement

navigationSlice, paginationSlice, layoutSlice have zero component consumers. unifiedCmsSlice manages server data via Redux despite project using React Query. Stale root files (app.js.OLD, styles.css, migration scripts) add cognitive load.

## Findings

- **Simplicity Agent**: P2-04 through P2-08

## Proposed Solutions

Delete dead slices, replace unifiedCmsSlice with React Query hooks, delete stale root files.

## Acceptance Criteria

- [ ] Dead slices removed
- [ ] Stale root files deleted
