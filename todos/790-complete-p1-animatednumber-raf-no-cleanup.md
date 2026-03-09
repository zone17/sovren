---
status: pending
priority: p1
issue_id: 790
tags: [code-review, frontend, performance]
---

# AnimatedNumber rAF no cleanup on unmount

## Problem Statement

AnimatedNumber uses requestAnimationFrame loop but never calls cancelAnimationFrame on unmount, causing a memory leak and potential state-update-on-unmounted-component errors.

## Findings

- **Frontend Races (Julik)**: Identified the rAF loop in lines 31-52 with no cleanup return in useEffect
- **Performance Oracle**: Confirmed the leak pattern (2/6 consensus)
- The useEffect starts a requestAnimationFrame loop but the cleanup function does not call cancelAnimationFrame(rafId), meaning the animation continues running after the component unmounts

## Proposed Solutions

1. **Return cleanup function from useEffect** — Add `return () => cancelAnimationFrame(rafId)` to the useEffect that drives the animation loop
   - Pros: Minimal change, standard React pattern
   - Cons: None — this is the correct fix

## Technical Details

- **Affected files**: packages/frontend/src/pages/Home.tsx (lines 31-52)

## Acceptance Criteria

- [ ] useEffect cleanup calls cancelAnimationFrame with the current rafId
- [ ] No console warnings about state updates on unmounted components when navigating away from Home
- [ ] Animation still works correctly when component is mounted
