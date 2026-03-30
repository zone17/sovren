---
status: pending
priority: p1
issue_id: 795
tags: [e2e, discovery, playwright, journey-3]
dependencies: []
---

# Enhance Discovery E2E Tests (Journey 3)

## Problem Statement
`discovery.public.spec.ts` has only 3 smoke tests. No cross-page flow (discover → view post), no content type rendering tests, no search/filter verification.

## Findings
- Existing: `discovery.public.spec.ts` (3 tests — page loads, heading, basic)
- Existing POM: `discovery.page.ts`
- Missing: click card → navigate to post, filter by category, search
- Missing: content type icon rendering, engagement stats on cards
- Gherkin in `docs/plans/user-journey-gherkins.md` Journey 3

## Proposed Solutions

### Deliverables
Enhance `discovery.public.spec.ts` with 3-4 additional tests:
- Click content card → navigate to /post/{id}
- Content cards display title, creator, and stats
- Filter/category selection (if UI supports it)
Optionally enhance `post.auth.spec.ts` with media rendering tests.

### Test Data Strategy
- Requires published content to exist (beforeAll via API or pre-seeded)
- Use unique title prefix for test isolation

## Acceptance Criteria
- [ ] Discovery spec has 6+ tests (up from 3)
- [ ] Cross-page navigation test (discover → post) passes
- [ ] Content card structure assertions pass
- [ ] `post.auth.spec.ts` has media rendering tests (image, video, audio)

## Work Log
| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-09 | Created from user journey audit | Discovery is the supporter entry point |
