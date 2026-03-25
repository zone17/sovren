---
status: pending
priority: p2
issue_id: 806
tags: [code-review, simplicity, frontend]
---

# @theme inline duplication across components

## Problem Statement

Tailwind @theme directive values are repeated across multiple files instead of being centralized.

## Findings

- Code Simplicity: Tailwind @theme directive values repeated across files
- Theme drift risk when values are updated in one file but not others

## Proposed Solutions

1. Centralize theme values in tailwind.config or index.css as the single source of truth

## Technical Details

- **Affected files**: Multiple CSS/component files with @theme directives

## Acceptance Criteria

- [ ] @theme values defined in one central location (tailwind.config or index.css)
- [ ] Component files reference centralized values instead of duplicating them
- [ ] No theme value drift between files
