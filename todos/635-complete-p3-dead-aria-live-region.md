---
status: pending
priority: p3
issue_id: '635'
tags: [code-review, frontend, yagni, a11y]
dependencies: []
---

# Dead aria-live region never populated

## Problem Statement

`CommentList.tsx` lines 101-107 render an `aria-live="polite"` div that is never written to. It makes a promise to screen readers that is never fulfilled.

## Findings

- Simplicity agent flagged as YAGNI violation (~22 LOC including test)

## Proposed Solutions

Remove the div and its test. Add back when actual screen reader announcements are implemented.

## Acceptance Criteria

- [ ] Dead aria-live div removed from CommentList
- [ ] Corresponding test removed from CommentList.test.tsx
