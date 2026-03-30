---
status: pending
priority: p1
issue_id: 792
tags: [e2e, content-creation, playwright, journey-2]
dependencies: [790, 791]
---

# Content Creation E2E Tests (Journey 2)

## Problem Statement
Content creation is the core product action with ZERO E2E coverage. No POM exists for /create, no spec file exists. This is the most critical gap in the test suite.

## Findings
- Route: `/create` renders `CreatorDashboard.tsx` (content creation form)
- No POM: need `create-content.page.ts`
- No spec: need `create-content.auth.spec.ts`
- Form fields: title, content body, content type selector, file upload, tags, monetization toggle, price
- API: POST `/api/v1/content/publish` (multipart form data)
- Gherkin scenarios defined in `docs/plans/user-journey-gherkins.md` Journey 2

## Proposed Solutions

### Deliverables
1. `e2e/pages/create-content.page.ts` — POM with all form locators
2. `e2e/create-content.auth.spec.ts` — 8-10 tests:
   - Publish text article
   - Publish with tags
   - Publish with image upload (depends on #791 fixtures)
   - Publish with video upload
   - Publish with audio upload
   - Publish monetized content
   - Empty title validation error
   - Double-click publish prevention

### Test Data Strategy
- Create via UI (this IS the test)
- Cleanup via API in afterAll: DELETE `/api/v1/content/{id}`
- Unique titles: `E2E-create-{timestamp}-{testName}`

## Acceptance Criteria
- [ ] `create-content.page.ts` POM exists with all form locators
- [ ] `create-content.auth.spec.ts` has 8+ tests
- [ ] Article creation test passes
- [ ] Media upload tests pass (image, video, audio)
- [ ] Monetization toggle test passes
- [ ] Validation error test passes
- [ ] All tests clean up created content in afterAll

## Work Log
| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-09 | Created from user journey audit | Core product action, highest priority |
