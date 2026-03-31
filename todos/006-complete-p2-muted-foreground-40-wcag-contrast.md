---
status: pending
priority: p2
issue_id: "006"
tags: [code-review, design-system, accessibility, wcag]
dependencies: []
---

# P2: `text-muted-foreground/40` May Fail WCAG AA Contrast

## Problem Statement

6 elements use `text-muted-foreground/40` (40% opacity). In light mode, `muted-foreground` resolves to `hsl(215 20% 40%)` — at 40% opacity against the light background, the contrast ratio drops to approximately 2.1:1, failing WCAG AA minimum (4.5:1 for normal text, 3:1 for large text).

**Agent consensus: 1/7** (frontend-races-reviewer)

## Findings

6 instances of `text-muted-foreground/40`:
- DevTools FeatureFlagToggle — "Backend Integration" label
- Empty state icons
- Disabled text elements

The DevTools label will be genuinely hard to read in light mode.

## Proposed Solutions

### Option A: Use `/60` as floor for readable text (Recommended)
- **Pros**: Meets WCAG AA; consistent with other secondary text
- **Cons**: Slightly less visual hierarchy distinction
- **Effort**: Small (6 edits)
- **Risk**: None

### Option B: Keep `/40` only for decorative/non-text elements
- **Pros**: Preserves hierarchy; decorative elements exempt from WCAG text contrast
- **Effort**: Small (review 6 instances, change text ones to `/60`)

## Acceptance Criteria

- [ ] All readable text meets WCAG AA contrast (4.5:1 normal, 3:1 large)
- [ ] `/40` reserved for decorative icons only

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-09 | Created from PR #159 review | WCAG compliance |

## Resources

- PR: #159
- WCAG 2.1 AA: https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum
