---
status: pending
priority: p1
issue_id: 793
tags: [e2e, dashboard, playwright, journey-4]
dependencies: []
---

# Creator Dashboard E2E Tests (Journey 4)

## Problem Statement
The creator dashboard (`/dashboard`) has ZERO E2E coverage. No POM exists, no spec file exists. This is the primary management interface for creators.

## Findings
- Route: `/dashboard` renders `CreatorDashboard.tsx`
- No POM: need `dashboard.page.ts`
- No spec: need `dashboard.auth.spec.ts`
- Features: stats overview, content list (reverse chronological), click-to-view, delete action
- Gherkin scenarios defined in `docs/plans/user-journey-gherkins.md` Journey 4

## Proposed Solutions

### Deliverables
1. `e2e/pages/dashboard.page.ts` — POM with stats, content list, action button locators
2. `e2e/dashboard.auth.spec.ts` — 6-8 tests:
   - View dashboard with content (stats visible)
   - View dashboard empty state
   - Content list in reverse chronological order
   - Click content row → navigates to /post/{id}
   - Delete content from dashboard
   - Navigate to create content

### Test Data Strategy
- beforeAll: create test content via API (POST /api/v1/content/publish)
- afterAll: delete test content via API
- Unique titles: `E2E-dashboard-{timestamp}`

## Acceptance Criteria
- [ ] `dashboard.page.ts` POM exists
- [ ] `dashboard.auth.spec.ts` has 6+ tests
- [ ] Stats display test passes
- [ ] Content list test passes
- [ ] Click-to-view navigation test passes
- [ ] Delete content test passes
- [ ] Empty state test passes

## Work Log
| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-09 | Created from user journey audit | Primary management interface, critical gap |
