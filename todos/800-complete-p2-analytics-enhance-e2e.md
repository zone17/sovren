---
status: pending
priority: p2
issue_id: 800
tags: [e2e, analytics, playwright, journey-5]
dependencies: []
---

# Enhance Analytics E2E Tests (Journey 5)

## Problem Statement
`analytics.auth.spec.ts` has only 3 smoke tests. No analytics data assertions, no chart rendering verification, no navigation from dashboard test.

## Findings
- `analytics.auth.spec.ts` — 3 tests (smoke: page loads, heading visible)
- `analytics.page.ts` POM exists
- Missing: data visualization assertions (charts/metrics visible after loading)
- Missing: navigation from /dashboard to /dashboard/analytics
- Gherkin in `docs/plans/user-journey-gherkins.md` Journey 5

## Proposed Solutions

### Deliverables
Enhance `analytics.auth.spec.ts`:
- Analytics shows metrics/charts (not just loading spinner)
- Navigate from dashboard to analytics
- Page loads within reasonable time (no infinite loading)

## Acceptance Criteria
- [ ] Analytics spec has 5+ tests
- [ ] At least one test verifies actual data display (not just heading)
- [ ] Navigation from dashboard test passes

## Work Log
| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-09 | Created from user journey audit | Smoke-only coverage insufficient |
