---
status: pending
priority: p3
issue_id: 464
tags: [code-review, testing, dry]
dependencies: []
---

# P3: Create shared makeQueueServiceMock() factory

## Problem Statement

After adding `removeJob` to `IQueueService`, the mock in `BusinessInvoiceService.test.ts` doesn't include the new method. Test mocks should satisfy the full interface to prevent drift. A shared factory would keep all queue mocks consistent.

## Findings

- `BusinessInvoiceService.test.ts` mock (lines 31-39) missing `removeJob`
- `CrossPostService.test.ts` mock correctly includes it
- Interface compliance drift risk as `IQueueService` evolves

Source: Architecture strategist (PR #93)

## Proposed Solutions

### Option A: Create shared factory in test-utils
```typescript
// packages/backend/src/test-utils/queue-mock.ts
export function createQueueServiceMock() { ... }
```
- Effort: Small
- Risk: Low

## Technical Details

- **Affected files**: `packages/backend/src/test-utils/queue-mock.ts` (new), `BusinessInvoiceService.test.ts`, `CrossPostService.test.ts`

## Acceptance Criteria

- [ ] Shared factory satisfies full `IQueueService` interface
- [ ] Both test files use the shared factory
- [ ] Tests still pass

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-21 | Created from PR #93 review | |
