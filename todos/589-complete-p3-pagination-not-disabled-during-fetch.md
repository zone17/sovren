---
status: pending
priority: p3
issue_id: '589'
tags: [code-review, pr-108, frontend, ux]
---

# Pagination buttons not disabled during isFetching

## Problem Statement

Previous/Next Page buttons are disabled based on `hasPrev`/`hasNext` but not `isFetching`. With `keepPreviousData`, clicking "Next Page" twice in quick succession can skip a page.

**Flagged by: Frontend Races Reviewer**

## Proposed Solutions

```tsx
disabled={!pagination.hasPrev || isFetching}
disabled={!pagination.hasNext || isFetching}
```

## Acceptance Criteria

- [ ] Pagination buttons disabled while isFetching is true
