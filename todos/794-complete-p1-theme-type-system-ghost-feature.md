---
status: pending
priority: p1
issue_id: 794
tags: [code-review, architecture]
---

# Theme type still includes 'system' ghost feature

## Problem Statement

ThemeMode type includes 'system' as a valid value, but system theme support was removed from the design. This creates a dead code path and confusing type surface.

## Findings

- **Architecture Strategist**: Identified the orphaned 'system' variant in the ThemeMode union type (1/6 consensus)
- The 'system' option was part of an earlier design that supported OS-level theme preference detection, but this feature was removed
- Any code handling the 'system' case is unreachable dead code

## Proposed Solutions

1. **Remove 'system' from ThemeMode union type** — Delete 'system' from the type definition and remove all handling code (switch cases, if branches) that reference it
   - Pros: Cleaner types, no dead code, prevents confusion
   - Cons: Minor churn if multiple files reference the type

## Technical Details

- **Affected files**: packages/frontend/src/store/slices/uiSlice.ts and related type definitions

## Acceptance Criteria

- [ ] 'system' removed from ThemeMode union type
- [ ] All switch/if branches handling 'system' theme removed
- [ ] TypeScript compilation passes with no errors
- [ ] Theme toggle UI does not show system option
