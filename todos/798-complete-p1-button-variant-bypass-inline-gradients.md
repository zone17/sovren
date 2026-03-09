---
status: pending
priority: p1
issue_id: 798
tags: [code-review, frontend, patterns]
---

# Button variant bypass - 21 inline gradient overrides

## Problem Statement

21 buttons use inline `style={{ background: 'linear-gradient(...)' }}` bypassing the Button component's variant system, defeating the purpose of having a centralized design system component.

## Findings

- **Pattern Recognition**: Identified 21 instances of inline gradient overrides on Button components (1/6 consensus)
- The Button component has a variant prop system for styling, but these 21 instances bypass it entirely with inline styles
- This makes the gradient buttons impossible to update centrally and inconsistent with the design system

## Proposed Solutions

1. **Create gradient variant in Button component** — Add a `variant="gradient"` option to the Button component that applies the standard gradient, then replace all 21 inline overrides with `variant="gradient"`
   - Pros: Centralized control, consistent gradients, clean component API
   - Cons: May need sub-variants if different gradient directions are used

## Technical Details

- **Affected files**: Multiple component files across packages/frontend/src/

## Acceptance Criteria

- [ ] Button component supports variant="gradient" (and sub-variants if needed)
- [ ] All 21 inline gradient style overrides replaced with variant prop
- [ ] No visual regression in gradient button appearance
- [ ] Grep confirms zero remaining inline gradient styles on Button components
