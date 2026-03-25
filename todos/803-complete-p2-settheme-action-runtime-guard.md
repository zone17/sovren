---
status: pending
priority: p2
issue_id: 803
tags: [code-review, security, frontend]
---

# setTheme action missing runtime guard

## Problem Statement

Redux setTheme action accepts any string without runtime validation, allowing invalid theme values to propagate through the store.

## Findings

- Security Sentinel: Redux action accepts any string, no runtime validation
- Invalid values could cause unexpected UI behavior or class injection

## Proposed Solutions

1. Add runtime check for valid theme values ('light', 'dark') in the reducer or action creator

## Technical Details

- **Affected files**: Theme-related Redux slice/reducer

## Acceptance Criteria

- [ ] setTheme action validates input against allowed theme values at runtime
- [ ] Invalid theme values are rejected or fall back to default
- [ ] TypeScript type narrowing aligns with runtime guard
