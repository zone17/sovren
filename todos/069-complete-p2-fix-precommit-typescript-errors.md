---
status: pending
priority: p2
issue_id: '069'
tags: [tech-debt, typescript, pre-commit, code-quality]
dependencies: []
---

# 069: Fix Pre-existing TypeScript Type Errors Blocking Pre-commit Hook

## Problem Statement

The pre-commit hook runs `tsc --noEmit` which fails with hundreds of pre-existing TypeScript type errors across the codebase. This forces `--no-verify` on every commit, bypassing all pre-commit quality gates (ESLint, Prettier, type checking).

## Findings

The TypeScript errors span multiple packages and domains:

### packages/backend/src/container/ (~30 errors)

- `content.bindings.ts` — Wrong argument counts for service constructors
- `payment.bindings.ts` — Wrong argument counts for payment service constructors
- `user.bindings.ts` — Wrong argument counts for user service constructors
- `controller.bindings.ts` — Type incompatibility in `dependencies` property
- `shared.bindings.ts` — Wrong argument counts
- `ServiceContainer.ts` — Unused variables, type mismatches
- `types.ts` — String not assignable to union type

### packages/backend/src/ (misc ~10 errors)

- `app.ts` — Unused `req`/`res` parameters
- `config/database.ts` — Unused variable
- `cache/RedisAdapter.ts` — Type `string | undefined` not assignable to `string`

### packages/testing/src/ (~100+ errors)

- `unit-testing/UnitTestingStrategy.ts` — Missing properties, wrong argument counts
- `usability-testing/AIUsabilityTestingFramework.ts` — Many unused variables
- Various test infrastructure files

### packages/frontend/ (~50+ errors)

- Various component and service type mismatches

## Proposed Solutions

### Option A: Fix All TypeScript Errors (Large effort)

- **Pros**: Clean codebase, pre-commit hook works fully
- **Cons**: Very large effort, touches many files, high risk of regressions
- **Effort**: Large (2-3 days)
- **Risk**: High — touching container bindings and test infrastructure

### Option B: Fix Backend Container Errors Only (Medium effort)

- **Pros**: Fixes the most critical package, reduces error count significantly
- **Cons**: Other packages still broken
- **Effort**: Medium (4-6 hours)
- **Risk**: Medium

### Option C: Disable tsc in Pre-commit, Move to CI (Recommended)

- **Pros**: Unblocks pre-commit immediately, TypeScript still checked in CI
- **Cons**: Type errors caught later in pipeline instead of at commit time
- **Effort**: Small (30 min)
- **Risk**: Low

## Recommended Action

Option C first (unblock pre-commit), then Option B (fix container errors) as follow-up.

## Technical Details

- **Affected files**: `.husky/pre-commit` or lint-staged config
- **Components**: Pre-commit hook, TypeScript compiler
- **Root cause**: Service constructors were refactored but container bindings weren't updated; testing framework has many stub implementations

## Acceptance Criteria

- [ ] Pre-commit hook passes without `--no-verify`
- [ ] ESLint and Prettier checks still run at commit time
- [ ] TypeScript checking either fixed or moved to CI
- [ ] No new TypeScript errors introduced

## Work Log

| Date       | Action                                  | Result                                             |
| ---------- | --------------------------------------- | -------------------------------------------------- |
| 2026-02-13 | Identified during P1 remediation commit | Hundreds of pre-existing TS errors across codebase |

## Resources

- Commit: 2ba69ff (used --no-verify to bypass)
- Prior todo: 061-pending-p2-fix-precommit-typescript-errors.md
