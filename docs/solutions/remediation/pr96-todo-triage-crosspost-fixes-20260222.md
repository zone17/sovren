---
title: 'PR #96: Todo Triage + Compensating Transaction Hardening in CrossPostService'
date: '2026-02-22'
category: remediation
tags:
  - todo-triage
  - compensating-transactions
  - supabase-mocks
  - bullmq-reliability
  - stale-detection
  - typed-mocks
  - error-classes
module: cross-post-service
severity: P2
symptoms:
  - '76% of 17 pending todos already fixed in prior PRs (stale detection validation)'
  - 'Partial BullMQ enqueue failures left un-enqueued rows stuck in queued status'
  - 'Compensating update did not check its own error result (double-failure blind spot)'
  - 'cancel() used bare Error producing HTTP 500 on client-triggerable path'
  - 'createMockChain covered only 10 of 27 Supabase filter methods'
resolution_type: code_fix
root_cause: stale_todos + missing_error_handling + incomplete_mocks
pattern_refs:
  - critical-patterns.md#4c
  - common-solutions.md#7
  - common-solutions.md#4
---

# PR #96: Todo Triage + Compensating Transaction Hardening

## Problem

17 pending todos accumulated across PRs #85-#95. Three required code changes:

- **#450**: CrossPostService.publish() had non-atomic DB insert + BullMQ enqueue with no compensation for partial failure
- **#452**: Test file used 4 `any` types despite typed interfaces being available
- **#469**: Shared Supabase mock covered only 10 of 27 filter methods

## Investigation

### Triage Phase (3 Explore agents by domain)

| Domain          | Todos                | Result                      |
| --------------- | -------------------- | --------------------------- |
| backend-routes  | 7 (#371-384)         | All 7 ALREADY_FIXED         |
| types-infra     | 7 (#376-388)         | 6 ALREADY_FIXED, 1 WONT_FIX |
| crosspost-mocks | 3 (#450, #452, #469) | All 3 DO                    |

**76% already fixed** — validates the stale-todo detection pattern. Lightweight 3-agent Explore team sufficient for triage.

### Implementation Phase (3 domain specialist agents)

Each fix applied by a dedicated agent in a worktree:

1. **Data Integrity Specialist** (#450): Compensating transaction with `enqueuedIds` tracking
2. **TypeScript Type Safety Specialist** (#452): `Partial<Interface>` + `as` casts
3. **Test Infrastructure Specialist** (#469): 27 methods + barrel export + tsconfig exclude

### Review Phase (8 parallel review agents)

6 of 8 agents flagged the same issue: compensating update didn't check its own `{ error }` return. This consensus elevated it to confirmed-true-positive.

## Root Cause

Three separate root causes:

1. **#450**: DB+queue non-atomicity is inherent (no distributed transaction). Original code had no compensation path.
2. **#452**: Test file predated the interface extraction sprint.
3. **#469**: Mock was written for a single service's needs; expanding to shared utility required covering the full Supabase API surface.

## Solution

### 1. Compensating Transaction with Error Checking (refinement of #4c)

The original #4c pattern showed compensation but didn't address compensation failure. The refinement: destructure `{ error: compensateError }`, log with recovery context, always rethrow original.

```typescript
const enqueuedIds: string[] = [];
try {
  for (const row of inserted || []) {
    await this.queueService.addJob<CrossPublishJobData>(
      QUEUE_NAME,
      `publish-${row.platform}`,
      jobData,
      { jobId: `crosspost-${row.id}`, delay }
    );
    enqueuedIds.push(row.id);
  }
} catch (err) {
  const failedIds = (inserted || []).map((r) => r.id).filter((id) => !enqueuedIds.includes(id));

  this.logger.error('[CrossPostService] Enqueue failed mid-loop; compensating', {
    enqueuedCount: enqueuedIds.length,
    totalCount: (inserted || []).length,
    err,
  });

  if (failedIds.length > 0) {
    const { error: compensateError } = await this.db
      .from('cross_posts')
      .update({
        status: 'failed',
        error_message: 'Queue enqueue failed',
        updated_at: new Date().toISOString(),
      })
      .in('id', failedIds);

    if (compensateError) {
      this.logger.error(
        '[CrossPostService] Compensating update failed — rows may be stuck in queued',
        { failedIds, compensateError }
      );
    }
  }

  throw err; // Always rethrow — compensation is cleanup, not recovery
}
```

**Key rules:**

- Track successes in a running list inside the loop (`enqueuedIds.push`)
- Log before compensating — if compensation crashes, at least one log exists
- Rename destructured error (`compensateError`) to avoid shadowing
- `throw err` is unconditional

### 2. ValidationError for State-Guard Rejections

```typescript
// Before: bare Error → HTTP 500
throw new Error('Cross-post not found or not in a cancellable state');

// After: ValidationError → HTTP 400
throw new ValidationError('Cross-post not found or not in a cancellable state');
```

Decision matrix:

| Scenario                          | Error class        | HTTP |
| --------------------------------- | ------------------ | ---- |
| Resource not found or wrong state | ValidationError    | 400  |
| Caller doesn't own resource       | AuthorizationError | 403  |
| Caller not authenticated          | UnauthorizedError  | 401  |
| Infrastructure failure            | raw error          | 500  |

### 3. Expanded Mock Chain (27 methods)

See `packages/backend/src/test-utils/supabase-mock.ts` — now covers all PostgREST filter methods plus terminal methods (single, maybeSingle, range).

## Prevention

1. **Triage before implementing** — always verify todos against current HEAD before assigning agents
2. **Check compensation error returns** — any `await db.update()` in a catch block must destructure `{ error }`
3. **Never use bare `Error`** — always pick from `utils/errors.ts` (ValidationError, AuthorizationError, NotFoundError, etc.)
4. **Review consensus ≥ 6 agents = confirmed true positive** — treat as P1 regardless of individual ratings

## Metrics

- **Files changed:** 5 source + 17 todo renames = 22 total
- **Lines:** +1052/-34
- **Tests:** 10/10 pass
- **Review agents:** 8 parallel, 6-agent consensus on main finding
- **Merge conflicts:** 0 (7th consecutive sprint with domain-grouped agents)
- **Triage efficiency:** 76% resolved without code

## Related Documents

- [critical-patterns.md #4c](../patterns/critical-patterns.md) — compensating transaction (updated)
- [common-solutions.md #7](../patterns/common-solutions.md) — mock chain builder
- [PR #92 remediation](./pr92-p2-remediation-r7-sprint-20260221.md) — AuthorizationError pattern
- [R7 meta-analysis](../R7_META_ANALYSIS_REVIEW_METHODOLOGY.md) — parallel review methodology
