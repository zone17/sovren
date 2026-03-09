---
status: pending
priority: p1
issue_id: 799
tags: [code-review, frontend, patterns]
---

# Light-mode color leaks in status badges

## Problem Statement

Status badge components use hardcoded light-mode colors that don't adapt to the dark theme, causing visual inconsistency and poor contrast in the dark-first design.

## Findings

- **Pattern Recognition**: Identified hardcoded light-mode colors in status badge components (1/6 consensus)
- Badge background and text colors are set with light-mode-appropriate values that look wrong or have poor contrast on dark backgrounds
- These badges do not respond to theme changes

## Proposed Solutions

1. **Use dark: variants or CSS custom properties** — Replace hardcoded colors with Tailwind dark: variants or CSS custom properties that adapt to the current theme
   - Pros: Theme-aware badges, consistent with design system
   - Cons: Need to define appropriate dark-mode badge colors if not already in token set

## Technical Details

- **Affected files**: Status badge components in packages/frontend/src/components/

## Acceptance Criteria

- [ ] All status badge colors use theme-aware values (dark: variants or CSS custom properties)
- [ ] Badges have appropriate contrast in dark mode
- [ ] No hardcoded light-mode-only color values remain in badge components
- [ ] Visual inspection confirms correct appearance in dark theme
