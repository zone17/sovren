---
status: pending
priority: p3
issue_id: 827
tags: [code-review, a11y, frontend]
---

# Missing aria-reduced-motion support

## Problem Statement

Animations don't respect prefers-reduced-motion.

## Findings

- Performance Oracle: Animations don't respect prefers-reduced-motion

## Proposed Solutions

1. Add @media (prefers-reduced-motion: reduce) to disable animations

## Technical Details

- **Affected files**: CSS/styled components with animations

## Acceptance Criteria

- [ ] All animations respect prefers-reduced-motion media query
- [ ] Reduced motion users see no animations or transitions
