---
status: wont_fix
priority: p3
issue_id: '578'
tags: [code-review, pr-108, testing, frontend]
---

# Remove unnecessary BrowserRouter wrapper from CreatorCard tests

## Problem Statement

`CreatorCard.test.tsx` wraps every render in `<BrowserRouter>` and mocks `useNavigate`, but the current `CreatorCard` component has no navigation — the "View Profile" button was replaced with a disabled "Coming Soon" button. The router wrapper and navigate mock are now dead test infrastructure.

Also: test for "does not render View Profile button" tests absence of removed feature — always passes, tests nothing meaningful.

## Findings

- `CreatorCard.test.tsx`, lines 7-11: mocks useNavigate
- `CreatorCard.test.tsx`, lines 29-30: renderWithRouter helper
- `CreatorCard.test.tsx`, line 96-103: test for navigate call on removed button
- CreatorCard no longer uses useNavigate or Link

## Proposed Solutions

1. Remove `vi.mock('react-router-dom')` and `mockNavigate`
2. Remove `renderWithRouter` helper — use plain `render()`
3. Remove "navigates to creator profile" test
4. Remove "does not render View Profile button" test

## Acceptance Criteria

- [ ] BrowserRouter wrapper removed from CreatorCard tests
- [ ] Navigate mock removed
- [ ] Dead test cases removed
- [ ] Remaining tests still pass
