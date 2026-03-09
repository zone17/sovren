---
status: pending
priority: p3
issue_id: 823
tags: [code-review, performance, frontend]
---

# IntersectionObserver threshold could be configurable

## Problem Statement

useInView hook hardcodes threshold 0.1.

## Findings

- Performance Oracle: useInView hook hardcodes threshold 0.1

## Proposed Solutions

1. Accept threshold as a parameter in useInView hook

## Technical Details

- **Affected files**: useInView hook

## Acceptance Criteria

- [ ] useInView hook accepts threshold as optional parameter
- [ ] Default threshold remains 0.1 for backward compatibility
