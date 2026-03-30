---
status: pending
priority: p3
issue_id: 801
tags: [e2e, comments, cross-journey, playwright, journey-8]
dependencies: [792, 793]
---

# Comments Cross-Journey E2E Test (Journey 8)

## Problem Statement
Comments have good coverage (21 tests across 2 specs) but no cross-journey test that creates content → posts a comment → verifies the comment count updates on the dashboard.

## Findings
- `comments.auth.spec.ts` — 10 tests (good CRUD coverage)
- `comments.public.spec.ts` — 11 tests (good read-only coverage)
- Missing: create content → add comment → verify count on dashboard
- Gherkin in `docs/plans/user-journey-gherkins.md` Journey 8 cross-journey section

## Proposed Solutions

### Deliverables
1. `e2e/comments-journey.auth.spec.ts` — 3 tests:
   - Create content → post comment → see comment appear
   - Create content → post comment → verify count on dashboard
   - Reply to a comment and see nested thread

### Test Data Strategy
- beforeAll: create content via API
- Test: add comment via UI
- afterAll: delete content via API (cascades comments)

## Acceptance Criteria
- [ ] `comments-journey.auth.spec.ts` exists with 3 tests
- [ ] Cross-page comment count verification passes
- [ ] Cleanup runs in afterAll

## Work Log
| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-09 | Created from user journey audit | Good existing coverage, just needs cross-journey |
