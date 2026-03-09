---
status: pending
priority: p2
issue_id: 807
tags: [code-review, simplicity, frontend]
---

# Unused CSS surface custom properties

## Problem Statement

CSS custom properties (--surface-\*) are defined but never referenced anywhere in the codebase.

## Findings

- Code Simplicity: --surface-\* variables defined but never referenced
- Dead CSS variables add confusion and maintenance burden

## Proposed Solutions

1. Remove unused --surface-\* variables, or use them consistently where appropriate

## Technical Details

- **Affected files**: CSS files defining --surface-\* custom properties

## Acceptance Criteria

- [ ] All --surface-\* variables either removed or actively used
- [ ] No orphaned CSS custom property definitions
