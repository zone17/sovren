---
status: pending
priority: p2
issue_id: 385
tags:
  - code-review
  - architecture
  - type-safety
dependencies: []
---

# Missing recurrenceEndDate in BusinessInvoice Type Interface

## Problem Statement

The shared BusinessInvoice type interface doesn't include `recurrenceEndDate`, but the frontend sends it and the backend migration defines the column. This type gap means TypeScript won't catch missing or malformed values, risking silent data loss when the field is stripped during type-checking.

## Findings

**Source agents:** architecture-agent, type-safety-agent, code-review-agent

**Evidence:**

- File: `packages/shared/src/types/finance.ts` (BusinessInvoice interface)
- Issue: `recurrenceEndDate` field is missing from the interface despite being present in the DB schema and sent by the frontend.

## Proposed Solutions

### Option A: Add recurrenceEndDate to the interface

- **Approach:** Add `recurrenceEndDate?: string` to the BusinessInvoice interface in shared types. This aligns the type with the DB column and frontend usage.
- **Effort:** Small
- **Risk:** Low

## Recommended Action

_To be filled during triage_

## Technical Details

**Affected files:**

- `packages/shared/src/types/finance.ts` (BusinessInvoice interface)

## Acceptance Criteria

- [ ] `recurrenceEndDate?: string` is present in the BusinessInvoice interface
- [ ] Frontend can send the field without type errors
- [ ] Backend handles the field in create/update operations
- [ ] Type is consistent across shared, backend, and frontend

## Work Log

| Date       | Action  | Notes                      |
| ---------- | ------- | -------------------------- |
| 2026-02-19 | Created | PR #86 code review finding |

## Resources

- PR: https://github.com/zone17/sovren/pull/86
