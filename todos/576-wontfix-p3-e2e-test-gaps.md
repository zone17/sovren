---
status: wont_fix
priority: p3
issue_id: '576'
tags: [code-review, pr-108, testing, e2e]
---

# Improve E2E test coverage for discovery page

## Problem Statement

E2E tests only verify UI controls render (heading, search input, category buttons). They don't test that creator cards actually appear or that the Load More button works. The POM is missing `creatorCard` and `loadMoreButton` locators. The `searchInput` locator uses placeholder instead of role-based locator.

## Findings

- `discovery.page.ts`: only has heading, searchInput, categoryNav, sortSelect locators
- Plan doc POM includes creatorCard and loadMoreButton — not implemented
- `searchInput` uses `getByPlaceholder` instead of `getByLabel` (CLAUDE.md convention: role-based locators)
- No test verifies creator cards render after page load

## Proposed Solutions

1. Add `creatorCard` and `loadMoreButton` locators to POM
2. Change `searchInput` to `page.getByLabel('Search creators')`
3. Add test that verifies at least one article element renders (if test env has seeded data)

## Acceptance Criteria

- [ ] POM has creatorCard and loadMoreButton locators
- [ ] searchInput uses getByLabel instead of getByPlaceholder
- [ ] E2E test verifies creator cards render (with seeded data)
