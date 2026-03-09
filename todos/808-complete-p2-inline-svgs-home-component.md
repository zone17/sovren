---
status: pending
priority: p2
issue_id: 808
tags: [code-review, simplicity, frontend]
---

# Inline SVGs in Home.tsx ~150 LOC

## Problem Statement

Large SVG blocks are inlined directly in Home.tsx, adding ~150 lines of SVG markup that obscures component logic.

## Findings

- Code Simplicity: Large SVG blocks inline in component (~150 lines)
- Component readability severely impacted by SVG noise

## Proposed Solutions

1. Extract SVGs to separate SVG components or use an SVG sprite system

## Technical Details

- **Affected files**: Home.tsx

## Acceptance Criteria

- [ ] SVGs extracted from Home.tsx into separate components or sprite
- [ ] Home.tsx LOC reduced by ~150 lines
- [ ] Visual appearance unchanged
