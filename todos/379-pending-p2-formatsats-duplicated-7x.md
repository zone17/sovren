---
status: pending
priority: p2
issue_id: 379
tags:
  - code-review
  - simplicity
  - duplication
dependencies: []
---

# formatSats() Utility Duplicated 7 Times Across Frontend Components

## Problem Statement

`formatSats()` utility (formats satoshi amounts with locale separators) is copy-pasted across 7 frontend components instead of extracted to a shared utility. Any bug fix or formatting change must be applied 7 times independently.

## Findings

**Source agents:** simplicity-agent, duplication-agent, code-review-agent

**Evidence:**

- File: `packages/frontend/src/features/business/components/*.tsx` (7 components)
- Issue: Identical or near-identical `formatSats()` function copied into 7 separate component files.

## Proposed Solutions

### Option A: Extract to shared utility

- **Approach:** Extract to `packages/frontend/src/shared/utils/formatSats.ts` and import from there in all 7 components. Remove inline copies.
- **Effort:** Small
- **Risk:** Low

## Recommended Action

_To be filled during triage_

## Technical Details

**Affected files:**

- `packages/frontend/src/features/business/components/*.tsx` (7 components)
- New file: `packages/frontend/src/shared/utils/formatSats.ts`

## Acceptance Criteria

- [ ] Single `formatSats()` implementation exists in shared utils
- [ ] All 7 components import from the shared utility
- [ ] No inline `formatSats()` copies remain in component files
- [ ] Formatting output is identical to the existing implementation

## Work Log

| Date       | Action  | Notes                      |
| ---------- | ------- | -------------------------- |
| 2026-02-19 | Created | PR #86 code review finding |

## Resources

- PR: https://github.com/zone17/sovren/pull/86
