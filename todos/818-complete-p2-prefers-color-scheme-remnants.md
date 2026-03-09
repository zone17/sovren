---
status: pending
priority: p2
issue_id: 818
tags: [code-review, architecture, frontend]
---

# prefers-color-scheme still in other CSS files

## Problem Statement

@media (prefers-color-scheme) queries remain in CSS files despite the application using a dark-first class-based theme toggle.

## Findings

- Architecture Strategist: @media (prefers-color-scheme) queries remain in CSS files despite dark-first design
- System theme detection conflicts with class-based dark/light toggle

## Proposed Solutions

1. Remove @media (prefers-color-scheme) queries from CSS files
2. Rely solely on class-based dark/light toggle for theme switching

## Technical Details

- **Affected files**: CSS files containing @media (prefers-color-scheme) queries

## Acceptance Criteria

- [ ] All @media (prefers-color-scheme) queries removed
- [ ] Theme switching works exclusively via class-based toggle
- [ ] No visual regression in dark or light mode
