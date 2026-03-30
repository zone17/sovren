---
status: pending
priority: p2
issue_id: 799
tags: [e2e, monetization, lightning, playwright, journey-6]
dependencies: [792]
---

# Enhance Monetization E2E Tests (Journey 6)

## Problem Statement
Revenue and subscriptions specs have only 3 smoke tests each. No monetization toggle test during creation, no tip button visibility test, no price display assertion.

## Findings
- `revenue.auth.spec.ts` — 3 tests (smoke)
- `subscriptions.auth.spec.ts` — 3 tests (smoke)
- Missing: monetized content creation with price display
- Missing: Lightning tip button visibility on post page
- Missing: price display assertion
- Depends on content creation spec (#792) for monetization toggle test
- Gherkin in `docs/plans/user-journey-gherkins.md` Journey 6

## Proposed Solutions

### Deliverables
Enhance existing specs + add tests:
- Monetization toggle during content creation (in create-content spec)
- Price badge visible on post page after publishing monetized content
- Lightning tip button visible on posts (stub — real payment needs LN node)
- Revenue page shows earnings data or empty state with instructions

## Acceptance Criteria
- [ ] Monetized content creation test passes
- [ ] Price display on post page verified
- [ ] Revenue/subscription specs have 4+ tests each

## Work Log
| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-09 | Created from user journey audit | Lightning payment testing limited to UI visibility |
