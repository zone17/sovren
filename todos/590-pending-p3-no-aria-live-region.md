---
status: pending
priority: p3
issue_id: '590'
tags: [code-review, pr-108, frontend, accessibility]
---

# No aria-live region for dynamic result updates

## Problem Statement

When search/filter results update, screen readers don't announce the change. No `aria-live="polite"` region exists around the results section.

**Flagged by: Agent-Native Reviewer**

## Proposed Solutions

```tsx
<div aria-live="polite" aria-atomic="true">
  {!isLoading && !error && (
    <p className="sr-only">
      {creators.length === 0
        ? 'No creators found'
        : `Showing ${creators.length} of ${pagination?.total ?? 0} creators`}
    </p>
  )}
</div>
```

Also wrap pagination in `<nav aria-label="Pagination">`.

## Acceptance Criteria

- [ ] aria-live region announces result count on filter/search change
- [ ] Pagination wrapped in nav landmark
