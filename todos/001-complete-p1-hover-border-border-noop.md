---
status: pending
priority: p1
issue_id: "001"
tags: [code-review, design-system, ux, accessibility]
dependencies: []
---

# P1: `hover:border-border` No-Op Hover States on Interactive Cards

## Problem Statement

The migration replaced `hover:border-gray-300` with `hover:border-border`, but the base state already uses `border-border`. This makes hover a no-op — interactive cards show zero visual feedback on hover. Users will hover over these cards and see nothing, undermining perceived interactivity.

**Agent consensus: 3/7** (architecture-strategist, frontend-races-reviewer, pattern-recognition-specialist)

## Findings

~7 instances across the codebase where `border-border hover:border-border` appears:

- Extension connection cards in `ExtensionSelector.tsx`
- Category cards
- Search result cards
- Any card with `border border-border hover:border-border transition-colors`

The `transition-colors` class is now animating between identical values.

## Proposed Solutions

### Option A: Use `hover:border-accent` (Recommended)
- **Pros**: Matches the `hover:bg-accent` pattern used for hover backgrounds; consistent brand feel
- **Cons**: Purple border on hover may be strong for neutral cards
- **Effort**: Small (find-replace)
- **Risk**: Low

### Option B: Use `hover:border-muted-foreground/30`
- **Pros**: Subtle, neutral hover feedback; closer to original `hover:border-gray-300`
- **Cons**: Introduces another opacity variant
- **Effort**: Small
- **Risk**: Low

### Option C: Use `hover:border-ring`
- **Pros**: Uses the focus ring token, consistent with focus states
- **Cons**: May be too strong for hover (ring is typically brighter)
- **Effort**: Small
- **Risk**: Low

## Recommended Action

(To be filled during triage)

## Technical Details

**Affected files**: ~7 files with `hover:border-border` pattern
**Components**: Card-style interactive elements (extension selectors, category cards, search results)
**Database changes**: None

## Acceptance Criteria

- [ ] All `hover:border-border` instances replaced with visually distinct hover border
- [ ] Hover feedback visible in both light and dark themes
- [ ] `transition-colors` class animates a real color change

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-09 | Created from PR #159 review | 3/7 agent consensus |

## Resources

- PR: #159
- Pattern: common-solutions.md (no existing pattern — new finding)
