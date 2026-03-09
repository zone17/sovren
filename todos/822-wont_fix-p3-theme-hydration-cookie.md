---
status: pending
priority: p3
issue_id: 822
tags: [code-review, frontend]
---

# Theme hydration could use cookie instead of localStorage

## Problem Statement

Cookie-based theme would eliminate flash entirely.

## Findings

- Frontend Races: Cookie-based theme would eliminate flash entirely

## Proposed Solutions

1. Consider cookie-based theme for SSR readiness to eliminate theme flash on load

## Technical Details

- **Affected files**: Theme provider / theme initialization code

## Acceptance Criteria

- [ ] Theme preference stored in cookie instead of localStorage
- [ ] No theme flash on page load
- [ ] SSR-ready theme initialization
