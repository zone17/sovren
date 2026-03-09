---
status: pending
priority: p2
issue_id: 816
tags: [code-review, architecture, frontend]
---

# Hardcoded rgba purple values x30

## Problem Statement

Approximately 30 instances of rgba(139,92,246,...) are hardcoded instead of using design tokens.

## Findings

- Architecture Strategist: ~30 instances of rgba(139,92,246,...) instead of design tokens
- Color changes require find-and-replace across 30 locations

## Proposed Solutions

1. Replace with CSS custom property var(--purple-500) or equivalent design token

## Technical Details

- **Affected files**: ~30 locations across frontend components and styles

## Acceptance Criteria

- [ ] All rgba(139,92,246,...) instances replaced with design token reference
- [ ] Purple color defined once as CSS custom property
- [ ] Visual appearance unchanged
