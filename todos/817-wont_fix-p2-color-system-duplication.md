---
status: pending
priority: p2
issue_id: 817
tags: [code-review, architecture, frontend]
---

# Color system duplication (Tailwind + CSS vars + inline)

## Problem Statement

Three parallel color systems (Tailwind classes, CSS custom properties, inline styles) exist simultaneously, causing color drift and maintenance burden.

## Findings

- Architecture Strategist: Three parallel color systems causing drift
- No single source of truth for colors

## Proposed Solutions

1. Establish CSS custom properties as single source of truth, consumed by Tailwind config
2. Eliminate inline color values and redundant Tailwind color definitions

## Technical Details

- **Affected files**: tailwind.config, CSS files, components with inline color styles

## Acceptance Criteria

- [ ] Single color source of truth established (CSS custom properties)
- [ ] Tailwind config references CSS custom properties
- [ ] No inline color values that bypass the design system
- [ ] Color rendering unchanged
