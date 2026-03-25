---
status: pending
priority: p3
issue_id: '575'
tags: [code-review, pr-108, accessibility, frontend]
---

# Fix accessibility gaps in discovery components

## Problem Statement

Several minor accessibility issues across discovery components:

1. Missing `role="status"` and `aria-busy` on fetching indicator — screen readers won't announce loading state
2. Redundant `disabled` + `aria-disabled="true"` on Coming Soon button — native `disabled` already communicates state
3. Missing `sr-only` text for loading indicator

## Findings

- `DiscoveryPage.tsx`: fetching indicator div has no role or aria attributes
- `CreatorCard.tsx`, lines 78-79: both `disabled` and `aria-disabled="true"` set

## Proposed Solutions

1. Add `role="status"` and `<span className="sr-only">Updating results...</span>` to fetching div
2. Remove redundant `aria-disabled="true"` from Coming Soon button (keep native `disabled`)

## Acceptance Criteria

- [ ] Fetching indicator has role="status" and sr-only text
- [ ] Redundant aria-disabled removed from Coming Soon button
