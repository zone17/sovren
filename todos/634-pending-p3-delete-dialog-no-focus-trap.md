---
status: pending
priority: p3
issue_id: '634'
tags: [code-review, frontend, accessibility, a11y]
dependencies: []
---

# Delete dialog lacks focus trap

## Problem Statement

`CommentItem.tsx` delete dialog uses `role="dialog"` and `aria-modal="true"` but has no focus trap. Users can Tab out of the dialog.

## Findings

- Architecture Strategist flagged as P3
- The dialog promises modal behavior to assistive tech but doesn't enforce it

## Proposed Solutions

Add `focus-trap-react` library or a custom focus trap hook.

## Acceptance Criteria

- [ ] Tab key cycles within dialog when open
- [ ] Escape closes the dialog
