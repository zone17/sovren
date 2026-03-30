---
status: pending
priority: p3
issue_id: 805
tags: [e2e, navigation, responsive, playwright, journey-14]
dependencies: []
---

# Add Mobile/Responsive Navigation E2E Test (Journey 14)

## Problem Statement
`navigation.auth.spec.ts` has 6 tests for desktop navigation but no mobile viewport test. If the app has a hamburger menu or responsive nav, it's untested.

## Findings
- `navigation.auth.spec.ts` — 6 tests (desktop nav links, logo click)
- `layout.page.ts` POM exists with nav locators
- Missing: mobile viewport test with hamburger menu (if applicable)
- Gherkin in `docs/plans/user-journey-gherkins.md` Journey 14

## Proposed Solutions

### Deliverables
Add 1-2 tests with mobile viewport:
```typescript
test.use({ viewport: { width: 375, height: 667 } });
test('mobile nav shows hamburger menu', async ({ page }) => { ... });
```

## Acceptance Criteria
- [ ] At least 1 mobile viewport navigation test exists
- [ ] Test verifies navigation works on mobile (hamburger or responsive)

## Work Log
| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-09 | Created from user journey audit | Enhancement — low priority |
