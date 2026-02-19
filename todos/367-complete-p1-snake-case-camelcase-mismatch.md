---
status: complete
priority: p1
issue_id: 367
tags:
  - code-review
  - architecture
  - type-safety
  - runtime-error
dependencies: []
---

# Snake_case/camelCase Mismatch Between DB Rows and Shared Types

## Problem Statement

Backend services return rows with snake_case column names (e.g., `creator_id`, `line_items`, `total_sats`) but shared type interfaces define camelCase properties (e.g., `creatorId`, `lineItems`, `totalSats`). There's no automatic case transformation layer, causing property access failures at runtime. TypeScript compilation succeeds because services use `as` casts or `any`, masking the mismatch until runtime.

## Findings

**Source agents:** type-safety-review, architecture-review

**Evidence:**

- File: `packages/shared/src/types/finance.ts`
- Issue: Type interfaces use camelCase property names (e.g., `creatorId`, `totalSats`, `lineItems`)
- File: `packages/shared/src/types/community.ts`
- Issue: Type interfaces use camelCase property names (e.g., `creatorId`, `maxMembers`, `memberCount`)
- File: `packages/backend/src/services/finance/*.ts`
- Issue: Supabase queries return snake_case columns but code accesses camelCase properties — mismatch hidden by type assertions
- File: `packages/backend/src/services/community/*.ts`
- Issue: Same snake_case/camelCase mismatch pattern across community services

## Proposed Solutions

### Option A: Add snake_case-to-camelCase mapping utility

- **Approach:** Create a generic `toCamelCase<T>()` utility function that transforms snake_case DB row keys to camelCase. Apply after every Supabase query in service methods. This preserves the existing camelCase shared types.
- **Effort:** Medium
- **Risk:** Medium

### Option B: Align shared types to snake_case

- **Approach:** Change shared type interfaces to use snake_case property names matching the database columns. Update all frontend consumers to use snake_case. This eliminates the transformation layer entirely.
- **Effort:** Large
- **Risk:** High

### Option C: Supabase client-level transformation

- **Approach:** Configure the Supabase client or add a response interceptor that automatically transforms all query results from snake_case to camelCase. Single point of transformation.
- **Effort:** Small
- **Risk:** Medium

## Recommended Action

_To be filled during triage_

## Technical Details

**Affected files:**

- `packages/shared/src/types/finance.ts`
- `packages/shared/src/types/community.ts`
- `packages/backend/src/services/finance/*.ts`
- `packages/backend/src/services/community/*.ts`

## Acceptance Criteria

- [ ] All DB query results are accessible via the property names defined in shared types
- [ ] No runtime property access returns `undefined` due to case mismatch
- [ ] TypeScript compilation catches actual mismatches (remove `as any` / `as T` casts where possible)
- [ ] Frontend consumers can access all properties without case conversion
- [ ] Existing API response format is preserved (no breaking change for frontend)

## Work Log

| Date       | Action  | Notes                      |
| ---------- | ------- | -------------------------- |
| 2026-02-19 | Created | PR #86 code review finding |

## Resources

- PR: https://github.com/zone17/sovren/pull/86
