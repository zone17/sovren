---
status: pending
priority: p1
issue_id: 800
tags: [code-review, frontend, patterns, architecture]
---

# button.tsx/select.tsx/dialog.tsx hardcoded Primer hex values

## Problem Statement

Core UI components (button.tsx, select.tsx, dialog.tsx) use hardcoded hex color values from GitHub Primer design system instead of the app's own CSS custom properties / design tokens.

## Findings

- **Pattern Recognition**: Identified hardcoded hex values from Primer in core UI components
- **Architecture Strategist**: Flagged as a design system violation (2/6 consensus)
- These components form the foundation of the UI but reference an external design system's raw values rather than the app's token layer
- Any theme or brand change requires manually updating hex values in each component

## Proposed Solutions

1. **Replace with CSS custom properties** — Swap all hardcoded Primer hex values with var(--\*) tokens from the app's design system
   - Pros: Theme-aware, centralized color control, brand-independent
   - Cons: May need to define new tokens that map to the current Primer values

## Technical Details

- **Affected files**: packages/frontend/src/components/ui/button.tsx, packages/frontend/src/components/ui/select.tsx, packages/frontend/src/components/ui/dialog.tsx

## Acceptance Criteria

- [ ] All hardcoded hex values replaced with CSS custom properties
- [ ] Components respond correctly to theme changes
- [ ] No visual regression in default dark theme
- [ ] Design tokens defined for any values not already in the token set
- [ ] Grep confirms zero remaining hardcoded Primer hex values in these files
