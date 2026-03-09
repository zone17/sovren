---
status: pending
priority: p3
issue_id: 824
tags: [code-review, performance, frontend]
---

# Missing will-change hints for animated elements

## Problem Statement

Animated elements lack will-change CSS for GPU layer promotion.

## Findings

- Performance Oracle: Animated elements lack will-change CSS for GPU layer promotion

## Proposed Solutions

1. Add will-change: transform where appropriate on animated elements

## Technical Details

- **Affected files**: CSS/styled components with animations

## Acceptance Criteria

- [ ] Animated elements have appropriate will-change hints
- [ ] No excessive layer promotion (will-change only on elements that need it)
