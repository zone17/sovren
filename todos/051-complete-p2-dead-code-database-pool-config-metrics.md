---
status: pending
priority: p2
issue_id: '051'
tags: [code-review, dead-code, yagni]
dependencies: []
---

# Dead Code - Database Pool Config and Metrics

## Problem Statement

Multiple substantial code blocks exist that are never imported or used, representing speculative implementation (YAGNI violation) and maintenance burden. This includes a 349-line database pool config, 5 Prometheus metrics that are never incremented, speculative rollback code, and several utility functions.

## Findings

**Location**:

- `config/database-pool.config.ts` (349 lines - NEVER imported)
- `middleware/deployment-monitoring.ts:64-111,221-278` (Prometheus metrics)
- `middleware/rate-limit-middleware.ts:140-201,273-289` (unused functions)
- `monitoring/ErrorBoundary.tsx:233-257` (unused HOC and hook)

**Dead Code Inventory**:

1. **database-pool.config.ts** (349 lines):

   - Complete database pool configuration module
   - Connection management, retry logic, health checks
   - Zero imports across entire codebase
   - Likely superseded by another implementation

2. **Prometheus Metrics** (5 registrations):

   - `dbQueryDuration` - never incremented
   - `dbConnectionsActive` - never updated
   - `cacheOperations` - never recorded
   - `queueJobsTotal` - never counted
   - `queueJobDuration` - never measured
   - Metrics exist but provide no data

3. **Speculative Rollback** (57 lines):

   - `checkAndTriggerRollback` function
   - Automatic deployment rollback logic
   - Never called
   - Unclear trigger conditions

4. **Rate Limiter Utils** (65 lines total):

   - `createRedisRateLimiter` (36 lines) - never imported
   - `createUserRateLimiter` (12 lines) - never imported
   - `bypassRateLimitInTest` (17 lines) - never imported

5. **Error Boundary Utils** (25 lines):
   - `withErrorBoundary` HOC - never imported
   - `useAsyncError` hook - never imported

## Proposed Solutions

1. **Delete All Dead Code** (Recommended):

   - Remove unused files completely
   - Remove unused functions from active files
   - Remove unused metric registrations
   - Document removal in commit message for future reference
   - Archive in git history if needed later

2. **Audit and Activate**:

   - Determine original intent of each piece
   - Complete implementation if valuable
   - Wire up metrics to actual code
   - Higher effort, unclear value

3. **Mark as Deprecated**:
   - Add deprecation comments
   - Keep code but document non-use
   - Still incurs maintenance cost

## Technical Details

**Verification Steps**:

1. Global search for imports of each file/function
2. Verify zero references
3. Check git history for last usage
4. Document original purpose if discernible
5. Safe deletion (preserved in git history)

**Files to Delete Entirely**:

- `config/database-pool.config.ts` (if truly unused)

**Code Blocks to Remove**:

- `middleware/deployment-monitoring.ts`:

  - Lines 64-111: Unused metric registrations
  - Lines 221-278: `checkAndTriggerRollback` function

- `middleware/rate-limit-middleware.ts`:

  - Lines 140-180: `createRedisRateLimiter` (unless task 050 uses it)
  - Lines 273-289: `bypassRateLimitInTest`

- `monitoring/ErrorBoundary.tsx`:
  - Lines 233-257: `withErrorBoundary`, `useAsyncError`

**Coordination with Task 050**:

- If task 050 plans to use `createRedisRateLimiter`, keep it
- Otherwise, delete as dead code

## Acceptance Criteria

- [ ] All dead code identified and catalogued
- [ ] Global search confirms zero imports/references
- [ ] Files deleted or code blocks removed
- [ ] Tests still pass after removal
- [ ] No broken imports in codebase
- [ ] Build succeeds
- [ ] Documentation updated if relevant
- [ ] Git history preserves deleted code for reference
- [ ] Commit message documents what was removed and why
- [ ] Code review confirms safe deletion

## Work Log

Created: 2026-02-12

## Resources

- PR #73 post-remediation review
- YAGNI principle documentation
- Git history for context
