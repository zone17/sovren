---
status: pending
priority: p3
issue_id: 826
tags: [code-review, frontend]
---

# Stale reveal-stagger animation on fast scroll

## Problem Statement

Rapid scrolling can trigger multiple reveal animations simultaneously.

## Findings

- Frontend Races: Rapid scrolling can trigger multiple reveal animations simultaneously

## Proposed Solutions

1. Add debounce or one-shot to IntersectionObserver callback

## Technical Details

- **Affected files**: Reveal/stagger animation components, IntersectionObserver callback

## Acceptance Criteria

- [ ] Rapid scrolling does not trigger duplicate animations
- [ ] Each element animates at most once
