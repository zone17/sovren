---
status: pending
priority: p2
issue_id: '617'
tags: [code-review, frontend, react-query, content-shield]
dependencies: []
---

# P2: keepPreviousData Shows Wrong-Status Alerts During Filter Switch

## Problem Statement

`useAlerts` and `useFingerprintCoverage` use `hasInitialData` ref gate for `keepPreviousData`, but the ref never resets when the filter (status/creatorId) changes. Switching from "new" to "reviewed" tab briefly shows "new" alerts under the "reviewed" heading.

## Findings

- **Races Agent 1 (F5)**: "The user sees 'new' alerts under a heading that says 'Reviewed'"
- **Races Agent 2 (F3)**: "hasInitialData is a ref, so it persists across renders but never resets"
- **Consensus**: 2/6 agents

## Proposed Solutions

Reset `hasInitialData.current = false` when status changes:

```typescript
const prevStatus = useRef(status);
if (prevStatus.current !== status) {
  hasInitialData.current = false;
  prevStatus.current = status;
}
```

Or use `isPlaceholderData` to show opacity/loading indicator on stale data.

## Acceptance Criteria

- [ ] Filter change doesn't show stale data from previous filter
- [ ] Page change still shows previous page data smoothly

## Resources

- PR #132: https://github.com/zone17/sovren/pull/132
- common-solutions.md #58: keepPreviousData gate
