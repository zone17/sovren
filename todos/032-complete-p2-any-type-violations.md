---
status: pending
priority: p2
issue_id: '032'
tags: [code-review, typescript, quality]
dependencies: []
---

# `any` Type Violations Throughout Codebase

## Problem Statement

The project CLAUDE.md mandates "Eliminate all `any` types." This PR introduces 20+ `any` usages across multiple files:

1. `app.ts:214` - `error: any` in global error handler
2. `app.ts:114` - `(req as any).rawBody` cast
3. `rate-limit-middleware.ts:195` - `(req as any).user` cast
4. `security-headers.ts` - 10+ `any` types in monitor, events, tests
5. `health.ts:65` - `details?: any` in ServiceHealth interface
6. `database-pool.config.ts:247` - Unsafe `as DatabasePoolConfig` cast after Zod parse

## Findings

- **kieran-typescript-reviewer**: CRITICAL 1-6 - all `any` usage findings
- Project CLAUDE.md: "Eliminate all `any` types"

## Proposed Solutions

1. Use `unknown` + type narrowing for error handler
2. Add Express module augmentation for `rawBody` and `user`
3. Replace `any` with `Record<string, unknown>` or proper interfaces
4. Fix Zod schema to match `DatabasePoolConfig` exactly

**Effort**: Medium | **Risk**: Low

## Acceptance Criteria

- [ ] `grep -r ': any' packages/backend/src/middleware/ packages/backend/src/routes/` returns no matches in new code
- [ ] Express Request type augmented for `rawBody` and `user`
- [ ] No unsafe `as` casts after Zod parse
