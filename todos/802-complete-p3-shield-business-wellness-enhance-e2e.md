---
status: pending
priority: p3
issue_id: 802
tags: [e2e, shield, business, wellness, playwright, journey-9-10-11]
dependencies: []
---

# Enhance Shield, Business, and Wellness E2E Tests (Journeys 9, 10, 11)

## Problem Statement
Shield (4 tests), business (6 tests), and wellness (5 tests) have basic coverage but lack meaningful data assertions. Most tests only verify page loads and headings.

## Findings
- `shield.auth.spec.ts` — 4 tests (page loads, heading, tabs)
- `business.auth.spec.ts` — 6 tests (page loads, sections visible)
- `wellness.auth.spec.ts` — 5 tests (page loads, gauge visible)
- Missing: burnout gauge score assertion, safety metric values, revenue data
- Gherkin in `docs/plans/user-journey-gherkins.md` Journeys 9-11

## Proposed Solutions

### Deliverables
Enhance each existing spec with 1-2 additional tests:
- Shield: safety score/rating visible (not just heading)
- Business: revenue figures or empty state with instructions
- Wellness: burnout gauge shows a level (not perpetual loading)

## Acceptance Criteria
- [ ] Shield spec has 5+ tests
- [ ] Business spec has 7+ tests
- [ ] Wellness spec has 6+ tests
- [ ] At least one test per spec verifies actual data (not just heading)

## Work Log
| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-09 | Created from user journey audit | Low priority — pages work, just need deeper assertions |
