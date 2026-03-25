---
status: pending
priority: p2
issue_id: 805
tags: [code-review, simplicity, frontend]
---

# Spinner animation duplicated x6

## Problem Statement

Same spinner keyframes and styles are duplicated across 6 components instead of being shared.

## Findings

- Code Simplicity: Same spinner keyframes/styles duplicated across 6 components
- Changes to spinner appearance require updating 6 separate locations

## Proposed Solutions

1. Extract to shared Spinner component or CSS class with keyframes defined once

## Technical Details

- **Affected files**: 6 components containing duplicate spinner animations

## Acceptance Criteria

- [ ] Spinner animation defined once (shared component or CSS class)
- [ ] All 6 duplicated spinner implementations replaced with shared version
- [ ] Spinner behavior and appearance unchanged
