---
status: pending
priority: p3
issue_id: 493
tags: [code-review, e2e, conventions]
dependencies: []
---

# Wellness POM uses CSS class selectors — violates project conventions

## Problem Statement

`e2e/pages/wellness.page.ts` lines 27-33 use `[class*="BurnoutRiskGauge"]` patterns. CLAUDE.md states: "Use role-based locators — never CSS selectors or test IDs." These locators are also unused in any test.

## Proposed Solutions

Remove unused locators now. When tests need them, add `data-testid` to source components and use role-based or testid locators.

## Acceptance Criteria

- [ ] No `[class*=...]` selectors in POM files
- [ ] All POM locators are used in at least one test assertion

## Work Log

| Date       | Action                         | Learnings                             |
| ---------- | ------------------------------ | ------------------------------------- |
| 2026-02-24 | Created from /workflows:review | 3 agents flagged convention violation |
