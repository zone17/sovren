---
status: pending
priority: p2
issue_id: '097'
tags: [code-review, dead-code, cleanup]
dependencies: []
---

# 3000+ Lines of Dead Code Across Multiple Modules

## Problem Statement

Over 3,000 lines of dead code exist across multiple modules, including unused Prometheus metrics, dead deployment monitoring functions, entire unused files (`content-sanitization.ts`, `input-validation.ts`), and 90% of `advanced-rate-limiting.ts`. This dead code increases maintenance burden, confuses developers, bloats bundles, and obscures the actual active codebase.

## Findings

**Dead Code Inventory:**

1. **Unused Prometheus Metrics** (`deployment-monitoring.ts:66-111`)

   - 6 unused metrics definitions (~45 LOC)
   - Metrics registered but never incremented/observed

2. **Dead `checkAndTriggerRollback()` Function** (`deployment-monitoring.ts:223-280`)

   - ~58 LOC
   - Never called in codebase
   - Complex rollback logic that's inaccessible

3. **Dead `getDeploymentHealth()` Function** (`deployment-monitoring.ts:168-203`)

   - ~36 LOC
   - Never called in codebase
   - Health check logic that's unused

4. **Entire File: `content-sanitization.ts`**

   - 1,275 lines
   - Never imported by any other file
   - XSS prevention, HTML sanitization logic completely unused

5. **Entire File: `input-validation.ts`**

   - 610 lines
   - Only imported by `content-sanitization.ts` (which is also dead)
   - Validation schemas, custom validators unused

6. **90% of `advanced-rate-limiting.ts`**

   - 1,231 total lines
   - Only `RequestRateLimiter` class imported (used in middleware)
   - Remaining ~1,100 LOC unused (adaptive throttling, anomaly detection, etc.)

7. **Dead `RequestValidation` in `app.ts:225-239`**

   - ~15 LOC
   - Validation middleware defined but never registered

8. **5 Unused Error Classes** (`error-handler-middleware.ts`)

   - `DatabaseError`, `ExternalServiceError`, `ConfigurationError`, etc.
   - Defined but never thrown anywhere in codebase

9. **Unused Exports** (`error-handler-middleware.ts`)
   - `notFoundHandler` (inline version used instead)
   - `handleUnhandledRejections` (never called)

**Total Dead Code: ~3,175 lines**

**Impact:**

- Increased cognitive load for developers
- False positives in code search/navigation
- Larger bundle sizes (if not tree-shaken)
- Maintenance burden (updating dependencies for unused code)
- Confusing onboarding (developers wonder why code exists)

## Proposed Solutions

### Option 1: Safe Incremental Removal (Low Risk)

**Pros:**

- Remove dead code in small batches
- Each batch can be reviewed and tested independently
- Easy to revert if needed
- Low risk of breaking changes

**Cons:**

- Multiple PRs required
- Takes longer to complete
- Requires discipline to finish all batches

**Effort:** Medium (6 hours spread across multiple PRs)
**Risk:** Low

### Option 2: Comprehensive Dead Code Purge (One PR)

**Pros:**

- Single focused cleanup PR
- Complete visibility of all removals
- Faster completion
- Clean slate

**Cons:**

- Large diff (harder to review)
- Higher risk of missing usage
- All-or-nothing approach

**Effort:** Medium (6 hours in one PR)
**Risk:** Medium

### Option 3: Move to Archive Directory Before Deletion

**Pros:**

- Dead code preserved in `src/archive/` for 1-2 sprints
- Easy to restore if usage discovered
- Psychologically easier for team (not "lost")
- Git history still available regardless

**Cons:**

- Archive directory is clutter
- Requires discipline to delete later
- May never actually get deleted

**Effort:** Low (3 hours)
**Risk:** Very Low

## Recommended Action

**Option 1: Safe Incremental Removal (Low Risk)**

Break into 4 batches for safer removal with incremental testing:

**Batch 1: Dead Functions in Existing Files** (1 hour)

- Remove 6 Prometheus metrics from `deployment-monitoring.ts:66-111`
- Remove `checkAndTriggerRollback()` from `deployment-monitoring.ts:223-280`
- Remove `getDeploymentHealth()` from `deployment-monitoring.ts:168-203`
- Remove `RequestValidation` from `app.ts:225-239`
- Remove 5 unused error classes from `error-handler-middleware.ts`

**Batch 2: Dead Files** (2 hours)

- Delete `content-sanitization.ts` (1,275 LOC)
- Delete `input-validation.ts` (610 LOC)
- Verify no runtime imports (grep, IDE analysis, test suite)

**Batch 3: Dead Code in advanced-rate-limiting.ts** (2 hours)

- Extract `RequestRateLimiter` to separate file `lib/rate-limiter.ts`
- Delete remaining 1,100 LOC of `advanced-rate-limiting.ts`
- Update imports in middleware

**Batch 4: Unused Exports** (1 hour)

- Remove `notFoundHandler` export (use inline version, covered in issue #094)
- Remove `handleUnhandledRejections` export
- Verify no external usage

Each batch gets:

- Separate PR
- Full test suite run
- Code search verification
- 24-hour bake time before next batch

## Technical Details

**Detection Strategy:**

1. **Static Analysis:**

   - TypeScript unused exports: `ts-prune` or IDE "Find Usages"
   - Grep for import statements
   - ESLint `no-unused-vars` for functions

2. **Runtime Verification:**

   - Full test suite must pass after removal
   - Integration tests in staging environment
   - Monitor for runtime errors post-deployment

3. **Search Commands:**

```bash
# Find imports of content-sanitization.ts
grep -r "from.*content-sanitization" src/ --include="*.ts"
grep -r "import.*content-sanitization" src/ --include="*.ts"

# Find calls to checkAndTriggerRollback
grep -r "checkAndTriggerRollback" src/ --include="*.ts"

# Find usages of specific error classes
grep -r "DatabaseError\|ExternalServiceError\|ConfigurationError" src/ --include="*.ts"
```

**Files to Modify or Delete:**

_Batch 1 (Modify):_

- `src/monitoring/deployment-monitoring.ts` (remove 3 functions)
- `src/app.ts` (remove RequestValidation)
- `src/middleware/error-handler-middleware.ts` (remove 5 error classes)

_Batch 2 (Delete):_

- `src/utils/content-sanitization.ts`
- `src/utils/input-validation.ts`

_Batch 3 (Refactor):_

- Create `src/lib/rate-limiter.ts` (extract RequestRateLimiter)
- Delete `src/middleware/advanced-rate-limiting.ts`
- Update imports in middleware files

_Batch 4 (Modify):_

- `src/middleware/error-handler-middleware.ts` (remove exports)

## Acceptance Criteria

**Batch 1: Dead Functions**

- [ ] 6 unused Prometheus metrics removed from deployment-monitoring.ts
- [ ] `checkAndTriggerRollback()` function removed
- [ ] `getDeploymentHealth()` function removed
- [ ] `RequestValidation` removed from app.ts
- [ ] 5 unused error classes removed from error-handler-middleware.ts
- [ ] All tests pass
- [ ] No new runtime errors in staging

**Batch 2: Dead Files**

- [ ] `content-sanitization.ts` deleted
- [ ] `input-validation.ts` deleted
- [ ] Code search confirms no imports of deleted files
- [ ] All tests pass
- [ ] Bundle size reduced by expected amount

**Batch 3: advanced-rate-limiting.ts Cleanup**

- [ ] `RequestRateLimiter` extracted to `lib/rate-limiter.ts`
- [ ] Middleware imports updated to use new location
- [ ] Remaining 1,100 LOC of dead code removed
- [ ] All tests pass
- [ ] Rate limiting functionality verified in integration tests

**Batch 4: Unused Exports**

- [ ] `notFoundHandler` export removed (after issue #094 resolved)
- [ ] `handleUnhandledRejections` export removed
- [ ] All tests pass

**Overall:**

- [ ] Total LOC reduction: ~3,175 lines
- [ ] No new ESLint warnings for unused code
- [ ] Documentation updated to remove references to deleted code
- [ ] Team notified of removed code in case of undiscovered dependencies

## Work Log

**2026-02-14**

- Identified in PR #73 full code review
- Catalogued dead code across 9 categories
- Estimated total dead code at 3,175+ lines
- Proposed 4-batch incremental removal strategy

## Resources

- PR #73: https://github.com/user/sovren/pull/73
- ts-prune (unused exports detector): https://github.com/nadeesha/ts-prune
- ESLint no-unused-vars: https://eslint.org/docs/latest/rules/no-unused-vars
- Dead code elimination best practices: https://martinfowler.com/bliki/DeadCode.html
