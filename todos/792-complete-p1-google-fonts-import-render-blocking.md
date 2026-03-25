---
status: pending
priority: p1
issue_id: 792
tags: [code-review, performance, security]
---

# Google Fonts @import render-blocking FCP

## Problem Statement

CSS @import url('https://fonts.googleapis.com/css2?...') in index.css blocks First Contentful Paint, degrading initial load performance for all users.

## Findings

- **Performance Oracle**: Identified the render-blocking @import as a critical performance bottleneck
- **Security Sentinel**: Flagged the external resource loading without integrity verification (2/6 consensus)
- CSS @import is parser-blocking — the browser cannot render any content until the external stylesheet is fully downloaded and parsed

## Proposed Solutions

1. **Move to `<link rel="preload">` in index.html** — Replace the CSS @import with a preload link in the HTML head, add font-display:swap parameter, and add SRI hash for integrity
   - Pros: Non-blocking load, better FCP, integrity verification
   - Cons: Requires generating SRI hash; hash changes if font CSS changes
2. **Self-host the fonts** — Download and serve the font files directly
   - Pros: No external dependency, full control, no SRI needed
   - Cons: More maintenance, larger bundle

## Technical Details

- **Affected files**: packages/frontend/src/index.css

## Acceptance Criteria

- [ ] @import removed from index.css
- [ ] Font loaded via `<link rel="preload">` or self-hosted
- [ ] font-display: swap applied to prevent invisible text during load
- [ ] SRI hash added if using external CDN link
- [ ] No visible layout shift when fonts load
