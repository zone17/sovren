---
status: pending
priority: p1
issue_id: 797
tags: [code-review, simplicity, frontend]
---

# glass-dark duplicates glass in dark-first design

## Problem Statement

The .glass-dark CSS class is nearly identical to .glass when dark mode is the default theme, creating unnecessary duplication and confusion about which class to use.

## Findings

- **Code Simplicity**: Identified that .glass-dark is redundant given the dark-first design approach (1/6 consensus)
- Since the app defaults to dark mode, the .glass class already provides the dark-appropriate styling
- Having both classes leads to inconsistent usage across components

## Proposed Solutions

1. **Consolidate into single .glass class** — Merge .glass-dark styles into .glass, add dark: variant only if light mode support is needed in the future
   - Pros: Single class to use, no confusion, less CSS
   - Cons: Requires updating all .glass-dark references to .glass

## Technical Details

- **Affected files**: packages/frontend/src/index.css

## Acceptance Criteria

- [ ] .glass-dark class removed or merged into .glass
- [ ] All references to .glass-dark updated to use .glass
- [ ] No visual regression in glassmorphism effects
- [ ] Grep confirms zero remaining .glass-dark references
