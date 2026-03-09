---
status: pending
priority: p1
issue_id: 795
tags: [code-review, architecture, frontend]
---

# Sidebar hardcodes HSL bypassing design tokens

## Problem Statement

Sidebar component uses hardcoded HSL color values instead of CSS custom properties from the design system, making it immune to theme changes and breaking design consistency.

## Findings

- **Architecture Strategist**: Identified hardcoded HSL values that bypass the design token system (1/6 consensus)
- The sidebar uses inline or class-based HSL values directly rather than referencing var(--sidebar-\*) or equivalent design tokens
- This means theme changes will not propagate to the sidebar

## Proposed Solutions

1. **Replace hardcoded HSL with CSS custom properties** — Swap all hardcoded HSL values with var(--sidebar-\*) tokens from the design system
   - Pros: Theme-aware, consistent with rest of app, single source of truth for colors
   - Cons: May need to define new tokens if they don't exist yet

## Technical Details

- **Affected files**: packages/frontend/src/components/Layout.tsx (or sidebar component)

## Acceptance Criteria

- [ ] All hardcoded HSL values in sidebar replaced with CSS custom properties
- [ ] Sidebar colors respond correctly to theme changes
- [ ] No visual regression in default dark theme
- [ ] Design tokens defined if not already present
