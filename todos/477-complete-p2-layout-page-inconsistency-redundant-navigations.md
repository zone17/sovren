---
status: complete
priority: p2
issue_id: '477'
tags:
  - code-review
  - playwright
  - e2e-testing
  - pom-consistency
  - performance
dependencies: []
---

# LayoutPage Inconsistent + Redundant Navigations in navigation.spec.ts

## Problem Statement

Two related issues:

1. **LayoutPage lacks goto() and action methods**: Every other POM has `goto()` and action methods. LayoutPage only defines locators (9 properties, 0 methods). This forces tests to inline `page.goto('/profile')` and `layout.dashboardLink.click()` directly.

2. **`page.goto('/profile')` repeated 6 times**: Every test in `navigation.spec.ts` independently navigates to `/profile` (lines 6, 17, 25, 33, 41, 49). Should be extracted to `beforeEach`.

Combined impact: ~1.2-2.4s of redundant navigations, 30+ lines of duplicated setup code.

## Findings

**Agent consensus: 5/7** (kieran-typescript, architecture, performance, pattern-recognition, code-simplicity)

- POM consistency: 4/5 POMs follow goto() + actions pattern
- DRY: 6 identical `page.goto('/profile')` calls
- Performance: ~200-400ms per redundant navigation

## Proposed Solutions

### Option A: Add beforeEach + navigation methods to LayoutPage (Recommended)

```typescript
// layout.page.ts - add methods
async goto(path = '/profile') {
  await this.page.goto(path);
}

async navigateTo(link: 'profile' | 'create' | 'dashboard' | 'wellness' | 'shield') {
  const linkMap = {
    profile: this.profileLink,
    create: this.createLink,
    dashboard: this.dashboardLink,
    wellness: this.wellnessLink,
    shield: this.shieldLink,
  };
  await linkMap[link].click();
}
```

```typescript
// navigation.spec.ts - add beforeEach
let layout: LayoutPage;

test.beforeEach(async ({ page }) => {
  layout = new LayoutPage(page);
  await layout.goto();
});
```

- Pros: Consistent with other POMs, DRY, ~1-2s faster
- Cons: Minor refactor
- Effort: Small (15 min)
- Risk: Low

## Technical Details

**Affected files:**

- `packages/frontend/e2e/pages/layout.page.ts` (add methods)
- `packages/frontend/e2e/navigation.spec.ts` (extract beforeEach)

## Acceptance Criteria

- [ ] LayoutPage has `goto()` method
- [ ] navigation.spec.ts uses `beforeEach` for page setup
- [ ] No raw `page.goto('/profile')` calls in individual tests
- [ ] All 17 tests still pass

## Work Log

| Date       | Action                          | Outcome                                             |
| ---------- | ------------------------------- | --------------------------------------------------- |
| 2026-02-24 | Identified by 5/7 review agents | Confirmed P2 - consistency + performance            |
| 2026-02-24 | Verified against source         | ALREADY FIXED — layout.page.ts:28 has goto() method |
