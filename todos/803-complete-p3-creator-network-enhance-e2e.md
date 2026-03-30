---
status: pending
priority: p3
issue_id: 803
tags: [e2e, creator-network, community, playwright, journey-12]
dependencies: []
---

# Enhance Creator Network E2E Tests (Journey 12)

## Problem Statement
Creator network has 4 tests (tab navigation, placeholder text) plus 17 network tests. Could benefit from circle creation or mentorship request flow tests if those features are functional.

## Findings
- `creator-network.auth.spec.ts` — 4 tests (tabs, filters)
- `network.auth.spec.ts` — 17 tests (follow/unfollow, suggestions)
- Missing: actual circle creation if feature supports it
- Missing: mentorship request flow
- Gherkin in `docs/plans/user-journey-gherkins.md` Journey 12

## Proposed Solutions

### Deliverables
If features are functional, add:
- Circle creation flow test
- Mentorship request flow test
If features are placeholder only, add skip tests documenting expected behavior.

## Acceptance Criteria
- [ ] Documented whether circle/mentorship features are functional or placeholder
- [ ] If functional: 1-2 additional tests per feature
- [ ] If placeholder: skip tests with TODO comments

## Work Log
| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-09 | Created from user journey audit | Good existing coverage, enhancement only |
