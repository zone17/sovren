---
status: pending
priority: p2
issue_id: 814
tags: [code-review, patterns, frontend]
---

# formatPrice duplication across components

## Problem Statement

Price formatting logic is duplicated in multiple components instead of using a shared utility.

## Findings

- Pattern Recognition: Price formatting logic duplicated in multiple places
- Bug fixes or format changes require updating multiple locations

## Proposed Solutions

1. Use a shared formatPrice utility function imported from a common location

## Technical Details

- **Affected files**: Multiple components with inline price formatting logic

## Acceptance Criteria

- [ ] Single formatPrice utility defined in shared location
- [ ] All duplicate price formatting replaced with shared utility
- [ ] Price display unchanged across all components
