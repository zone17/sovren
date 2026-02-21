---
status: complete
priority: p3
issue_id: 389
tags:
  - code-review
  - simplicity
  - dead-code
dependencies: []
---

# Dead SERVICE_DEPENDENCIES Constant — False Positive

## Problem Statement

The SERVICE_DEPENDENCIES constant was reported as unused legacy code.

## Resolution

**FALSE POSITIVE.** Grep verification found that `SERVICE_DEPENDENCIES` is NOT dead:

1. It is consumed by `getServiceDependencies()` in the same file (`types.ts`)
2. `getServiceDependencies()` is imported and used in `packages/backend/src/container/__tests__/ServiceContainer.integration.test.ts`

The constant serves as a documented dependency map and is actively used by integration tests. Updated the JSDoc comment on the constant to clarify its usage. No deletion performed.

## Work Log

| Date       | Action   | Notes                                                       |
| ---------- | -------- | ----------------------------------------------------------- |
| 2026-02-19 | Created  | PR #86 code review finding                                  |
| 2026-02-20 | Resolved | False positive: used by getServiceDependencies() + test file |

## Resources

- PR: https://github.com/zone17/sovren/pull/86
