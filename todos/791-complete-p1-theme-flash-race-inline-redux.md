---
status: pending
priority: p1
issue_id: 791
tags: [code-review, frontend, architecture]
---

# Theme flash race between inline script and Redux

## Problem Statement

Inline script in index.html sets the dark class on the document, but Redux uiSlice initialState also hardcodes 'dark', and ThemeProvider useEffect may flash the theme during hydration when the two sources disagree.

## Findings

- **Frontend Races (Julik)**: Identified the race condition between the inline script theme initialization and Redux state hydration
- **Architecture Strategist**: Confirmed the dual-source-of-truth issue (2/6 consensus)
- The inline script reads localStorage and sets the class synchronously, but uiSlice initialState defaults to 'dark' without reading localStorage, creating a window where Redux state and DOM class diverge

## Proposed Solutions

1. **Read localStorage in uiSlice initialState** — Make uiSlice initialState read the same localStorage key as the inline script, then remove the redundant ThemeProvider useEffect that re-applies the theme
   - Pros: Single source of truth (localStorage), no flash, removes dead code
   - Cons: Slightly more logic in slice initialization
2. **Remove inline script, let Redux own theme** — Remove the index.html inline script entirely
   - Pros: Single owner
   - Cons: Will flash on initial load since Redux hydrates after first paint

## Technical Details

- **Affected files**: packages/frontend/index.html, packages/frontend/src/store/slices/uiSlice.ts

## Acceptance Criteria

- [ ] No visible theme flash on page load or refresh
- [ ] uiSlice initialState reads from localStorage to match inline script logic
- [ ] Redundant ThemeProvider useEffect removed
- [ ] Theme persists correctly across page refreshes
