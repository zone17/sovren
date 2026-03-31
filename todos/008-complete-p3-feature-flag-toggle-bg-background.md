---
status: pending
priority: p3
issue_id: "008"
tags: [code-review, design-system, consistency]
dependencies: []
---

# P3: FeatureFlagToggle Uses `bg-background` Instead of `bg-card`

## Problem Statement

The DevTools `FeatureFlagToggle.tsx` floating panel uses `bg-background` but is semantically a card/panel widget, not a page background. Other floating panels and modals use `bg-card`.

**Agent consensus: 1/7** (pattern-recognition-specialist)

Dev-only component — lowest priority.

## Proposed Solutions

Change `bg-background` to `bg-card` in FeatureFlagToggle.tsx. 1-line fix.

## Acceptance Criteria

- [ ] Floating dev panel uses `bg-card` like other floating elements

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-09 | Created from PR #159 review | Dev-only, lowest priority |

## Resources

- PR: #159
