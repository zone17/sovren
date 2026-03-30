---
status: pending
priority: p1
issue_id: 794
tags: [e2e, golden-path, cross-journey, playwright]
dependencies: [792, 793]
---

# Golden Path Cross-Journey E2E Test

## Problem Statement
No cross-page journey test exists that validates the complete creator workflow: Dashboard (empty) → Create Content → Publish → Dashboard (has content) → View Post → Delete → Dashboard (empty again). This is the single most important E2E test for the product.

## Findings
- Depends on: `create-content.page.ts` (#792), `dashboard.page.ts` (#793)
- Also uses: `post.page.ts` (existing)
- File: `creator-journey.auth.spec.ts`
- Tests the complete content lifecycle across 3 pages
- Gherkin in `docs/plans/user-journey-gherkins.md` Cross-Journey section

## Proposed Solutions

### Deliverables
1. `e2e/creator-journey.auth.spec.ts` — 2-3 tests:
   - Full creator golden path (empty dashboard → create → view → delete → empty)
   - Content lifecycle with comments (create → comment → verify count)
   - Discovery integration (create → verify appears on /discover)

### Test Data Strategy
- Creates data via UI (that IS the test)
- Cleanup via API in afterAll
- Must wait for API responses between page navigations

## Acceptance Criteria
- [ ] `creator-journey.auth.spec.ts` exists
- [ ] Golden path test passes end-to-end
- [ ] Test creates, views, and deletes content across 3+ pages
- [ ] No page.route() mocks used
- [ ] Cleanup runs even if test fails (afterAll)

## Work Log
| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-09 | Created from user journey audit | Single most important E2E test |
