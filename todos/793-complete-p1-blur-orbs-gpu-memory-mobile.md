---
status: pending
priority: p1
issue_id: 793
tags: [code-review, performance, frontend]
---

# 600px blur orbs GPU memory on mobile

## Problem Statement

Multiple 600px blur(100px) decorative elements on the Home page cause excessive GPU memory consumption on mobile devices, potentially causing jank or crashes on low-end hardware.

## Findings

- **Performance Oracle**: Identified the GPU memory impact of multiple large blur elements (1/6 consensus)
- Each 600px element with blur(100px) creates an offscreen texture that is significantly larger than the visible area due to blur radius expansion
- Multiple such elements compound the GPU memory pressure

## Proposed Solutions

1. **Use @media query to reduce size/blur on mobile** — Apply smaller dimensions and reduced blur radius on screens below a breakpoint (e.g., 768px)
   - Pros: Preserves desktop effect, reduces mobile GPU load
   - Cons: Visual difference between mobile and desktop
2. **Replace with CSS gradients** — Use radial-gradient instead of blur filter for the decorative orb effect
   - Pros: Zero GPU compositing overhead, similar visual result
   - Cons: Slightly different aesthetic

## Technical Details

- **Affected files**: packages/frontend/src/pages/Home.tsx

## Acceptance Criteria

- [ ] Mobile devices use reduced blur/size or gradient alternative
- [ ] No visible jank on mid-range mobile devices
- [ ] Desktop visual effect preserved
- [ ] GPU memory usage reduced on mobile (verify with Chrome DevTools Layers panel)
