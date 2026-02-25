---
status: pending
priority: p3
issue_id: '500'
tags:
  - code-review
  - playwright
  - e2e-testing
  - cleanup
dependencies: []
---

# WellnessPage Has Unnecessary JSDoc Comment

## Problem Statement

`WellnessPage` has a 4-line JSDoc comment that states "Page Object for WellnessDashboard" and includes a source file path. The class name already communicates it is a page object. The source path goes stale if the file moves. No other POM has this comment — it's inconsistent.

## Findings

**Agent consensus: 1/4** (code-simplicity-reviewer)

## Proposed Solutions

### Option A: Remove the JSDoc (Recommended)

Delete lines 3-6 of `wellness.page.ts`.

- Pros: -3 lines, consistent with all other POMs
- Cons: None
- Effort: Small
- Risk: Low

## Technical Details

**Affected files:**

- `packages/frontend/e2e/pages/wellness.page.ts` (lines 3-6)

## Acceptance Criteria

- [ ] No JSDoc on WellnessPage class
- [ ] Consistent with other POMs (none have JSDoc)
- [ ] All 20 tests still pass

## Work Log

| Date       | Action                                 | Outcome                  |
| ---------- | -------------------------------------- | ------------------------ |
| 2026-02-24 | Identified by code-simplicity-reviewer | P3 — unnecessary comment |
