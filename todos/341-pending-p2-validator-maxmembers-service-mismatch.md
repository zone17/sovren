---
status: pending
priority: p2
issue_id: 341
tags: [code-review, validation]
---

# Validator maxMembers 10,000 but service enforces 5-20

## Problem Statement

The community validator allows `maxMembers` up to 10,000, but the CreatorCircleService enforces a maximum of 20 members. This mismatch means the validator accepts values that the service will reject, leading to confusing error messages (validation passes but the service throws).

## Findings

- `packages/backend/src/validators/community.ts:27` — `.max(10000)` on maxMembers field
- `packages/backend/src/services/community/CreatorCircleService.ts:52` — enforces max 20 members
- Values between 21 and 10,000 pass validation but fail at the service layer

## Proposed Solutions

1. Align the validator's `.max()` value with the service's maximum (20)
2. Alternatively, if 10,000 is the intended future limit, update the service to match
3. Add a comment documenting the business rule for the maximum

## Technical Details

- **Affected Files**: packages/backend/src/validators/community.ts, packages/backend/src/services/community/CreatorCircleService.ts

## Acceptance Criteria

- [ ] Validator `.max()` value aligned with service maximum
- [ ] No values pass validation that the service will reject
- [ ] Business rule for maximum members documented in a comment
- [ ] Existing tests updated to reflect the aligned limit
