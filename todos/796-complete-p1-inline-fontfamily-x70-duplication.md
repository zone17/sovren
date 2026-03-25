---
status: pending
priority: p1
issue_id: 796
tags: [code-review, frontend, simplicity]
---

# Inline fontFamily x70 massive duplication

## Problem Statement

`style={{ fontFamily: "'Sora', sans-serif" }}` is repeated approximately 70 times across pages and components instead of using a CSS utility class, creating massive duplication and maintenance burden.

## Findings

- **Code Simplicity**: Identified the repeated inline style pattern
- **Pattern Recognition**: Confirmed the pattern occurs ~70 times across the codebase
- **Architecture Strategist**: Flagged as a design system violation (3/6 consensus — strong signal)
- Every instance must be updated individually if the font changes, and the inline styles bloat the rendered HTML

## Proposed Solutions

1. **Create CSS utility class** — Add `.font-display { font-family: 'Sora', sans-serif; }` to index.css and replace all 70 inline occurrences with `className="font-display"`
   - Pros: Single source of truth, smaller HTML output, easy to change font globally
   - Cons: Requires touching ~70 files/locations (but straightforward find-replace)
2. **Set as default body font** — If Sora is the primary display font, set it on body/html and only override where different fonts are needed
   - Pros: Zero class additions needed, automatic inheritance
   - Cons: Only works if Sora is the default for most text

## Technical Details

- **Affected files**: Multiple files across packages/frontend/src/pages/ and packages/frontend/src/components/

## Acceptance Criteria

- [ ] CSS utility class .font-display created (or body default set)
- [ ] All ~70 inline fontFamily styles replaced
- [ ] No visual regression in font rendering
- [ ] Grep confirms zero remaining inline fontFamily: "'Sora'" occurrences
