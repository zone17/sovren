---
status: pending
priority: p2
issue_id: 809
tags: [code-review, simplicity, frontend]
---

# Layout.tsx 12 inline SVGs ~140 LOC

## Problem Statement

Layout.tsx contains 12 inline SVGs adding ~140 lines of markup that bloat the component.

## Findings

- Code Simplicity: 12 inline SVGs bloating Layout component
- Navigation and layout logic obscured by SVG markup

## Proposed Solutions

1. Extract SVGs to icon components (e.g., Lucide icons or custom SVG components)

## Technical Details

- **Affected files**: Layout.tsx

## Acceptance Criteria

- [ ] All 12 inline SVGs extracted to icon components
- [ ] Layout.tsx LOC reduced by ~140 lines
- [ ] Visual appearance unchanged
