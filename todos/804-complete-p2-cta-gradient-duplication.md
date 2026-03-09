---
status: pending
priority: p2
issue_id: 804
tags: [code-review, simplicity, frontend]
---

# CTA gradient repeated x9 inline

## Problem Statement

The same linear-gradient value is repeated 9 times as inline styles across components, violating DRY and making gradient changes error-prone.

## Findings

- Code Simplicity: Same linear-gradient value repeated 9 times as inline style
- Any gradient change requires updating 9 separate locations

## Proposed Solutions

1. Extract to CSS class `.bg-cta-gradient` and apply via className

## Technical Details

- **Affected files**: Components using inline CTA gradient styles (9 locations)

## Acceptance Criteria

- [ ] CTA gradient defined once as CSS class (e.g., `.bg-cta-gradient`)
- [ ] All 9 inline gradient styles replaced with the shared class
- [ ] Visual appearance unchanged
