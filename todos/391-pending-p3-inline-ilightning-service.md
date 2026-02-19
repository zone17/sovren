---
status: pending
priority: p3
issue_id: 391
tags:
  - code-review
  - architecture
  - consistency
dependencies: []
---

# ILightningService Interface Defined Inline Instead of in /interfaces/

## Problem Statement

The ILightningService interface is defined inline in the container bindings file instead of in the `/interfaces/` directory like all other service interfaces. This breaks the established convention for interface organization, making it harder to find and maintain.

## Findings

**Source agents:** architecture-agent, code-review-agent

**Evidence:**

- File: `packages/backend/src/container/bindings/finance.bindings.ts`
- Issue: ILightningService interface is defined directly in the bindings file rather than in `packages/backend/src/interfaces/` where other service interfaces live. This is inconsistent with the project's interface organization pattern.

## Proposed Solutions

### Option A: Move interface to standard location

- **Approach:** Extract ILightningService to `packages/backend/src/interfaces/finance/ILightningService.ts`, add it to the barrel re-export in the interfaces directory, and update the import in `finance.bindings.ts` to reference the new location.
- **Effort:** Small
- **Risk:** Low

## Recommended Action

_To be filled during triage_

## Technical Details

**Affected files:**

- `packages/backend/src/container/bindings/finance.bindings.ts` (remove inline interface)
- `packages/backend/src/interfaces/finance/ILightningService.ts` (new file)
- `packages/backend/src/interfaces/index.ts` (add barrel re-export)

## Acceptance Criteria

- [ ] ILightningService interface moved to `packages/backend/src/interfaces/finance/ILightningService.ts`
- [ ] Barrel re-export updated in interfaces index
- [ ] Import in `finance.bindings.ts` updated to use new location
- [ ] TypeScript compilation passes
- [ ] No other files contain inline interface definitions in bindings files

## Work Log

| Date       | Action  | Notes                      |
| ---------- | ------- | -------------------------- |
| 2026-02-19 | Created | PR #86 code review finding |

## Resources

- PR: https://github.com/zone17/sovren/pull/86
