---
status: pending
priority: p2
issue_id: 684
tags: [code-review, e2e, playwright, conventions]
dependencies: []
---

# CSS selector locators in POMs violate role-based convention

## Problem Statement

4 locators across 3 POMs use CSS selectors instead of role-based locators, violating CLAUDE.md: "Use role-based locators — never CSS selectors or test IDs."

**Consensus: 2/8 agents flagged (E2E Testing, Pattern Recognition).**

## Findings

- `analytics.page.ts:21` — `page.locator('select').first()` (bare tag selector)
- `analytics.page.ts:25` — `page.locator('.animate-pulse').first()` (CSS class)
- `subscriptions.page.ts:25` — `page.locator('.animate-pulse').first()` (CSS class)
- `nostr-onboarding.page.ts:18-19` — `page.locator('#backup')`, `page.locator('#security')` (ID selectors)

## Proposed Solutions

Replace with role-based equivalents:

- `page.locator('select')` → `page.getByRole('combobox')` or `page.getByLabel(/period/i)`
- `page.locator('.animate-pulse')` → `page.getByRole('status')` or remove (unused)
- `page.locator('#backup')` → `page.getByRole('checkbox', { name: /backup/i })`
- `page.locator('#security')` → `page.getByRole('checkbox', { name: /security/i })`

Note: All 4 locators are currently unused by specs (covered by #683). If #683 removes them, this finding is moot.

## Acceptance Criteria

- [ ] No `page.locator()` calls with CSS selectors in new POM files
- [ ] All locators use `getByRole`, `getByLabel`, or `getByText`

## Work Log

| Date       | Action                                    | Learnings                                                  |
| ---------- | ----------------------------------------- | ---------------------------------------------------------- |
| 2026-03-07 | Created from /workflows:review of PR #146 | Overlaps with #683 — if locators removed, this is resolved |
