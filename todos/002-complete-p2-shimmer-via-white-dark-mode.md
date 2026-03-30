---
status: pending
priority: p2
issue_id: "002"
tags: [code-review, design-system, dark-mode]
dependencies: []
---

# P2: Shimmer Gradient `via-white` Breaks Dark Mode

## Problem Statement

A shimmer/skeleton gradient uses `from-muted via-white to-muted`. The `via-white` is a hardcoded color that will render as a bright white flash against dark backgrounds in dark mode.

**Agent consensus: 1/7** (code-simplicity-reviewer)

## Findings

Pattern: `bg-gradient-to-r from-muted via-white to-muted`

The `from-muted` and `to-muted` correctly use tokens, but the `via-white` midpoint is hardcoded and will break the shimmer effect in dark mode by producing a jarring white streak.

## Proposed Solutions

### Option A: Use `via-background` (Recommended)
- **Pros**: Matches the page background in both themes; subtle shimmer
- **Cons**: May be too subtle if background and muted are close
- **Effort**: Small (1-line fix)
- **Risk**: Low

### Option B: Use `via-card`
- **Pros**: Slightly more contrast than background for shimmer effect
- **Effort**: Small
- **Risk**: Low

## Acceptance Criteria

- [ ] Shimmer gradient uses only token-based colors
- [ ] Shimmer animation looks correct in both light and dark themes

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-09 | Created from PR #159 review | Single instance |

## Resources

- PR: #159
