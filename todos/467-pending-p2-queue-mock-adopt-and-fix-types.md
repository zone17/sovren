---
status: pending
priority: p2
issue_id: 467
tags: [code-review, test-infrastructure, types]
dependencies: []
---

# Queue mock factory: adopt in tests + fix return type

## Problem Statement

`createQueueServiceMock()` in `test-utils/queue-mock.ts` was created (todo #464) but has zero consumers. 4+ test files still hand-roll partial IQueueService mocks. Additionally, the return type `{ [K in keyof IQueueService]: ReturnType<typeof vi.fn> }` erases all method signatures to `Mock<any>`, defeating type safety.

## Findings

- Source: TypeScript reviewer, Architecture strategist, Simplicity reviewer, Pattern recognition (PR #94 review)
- Evidence: `grep -r 'createQueueServiceMock' packages/backend/` returns only the definition
- Hand-rolled mocks in: CrossPostService.test.ts:31, MarketplaceService.test.ts:84, NotificationService.test.ts:59, BusinessInvoiceService.test.ts:32
- `vi.fn<[], Promise<string>>()` generic syntax may not match Vitest 2.x

## Proposed Solutions

### Option A: Migrate consumers + simplify return type to IQueueService

Return `IQueueService` instead of the mapped type. Migrate at least CrossPostService.test.ts and MarketplaceService.test.ts.

- Effort: Small
- Risk: Low

### Option B: Keep mapped type but fix generics

Use proper `vi.fn` generics matching each method's real signature. Migrate all 4 test files.

- Effort: Medium
- Risk: Low

## Acceptance Criteria

- [ ] At least 2 test files import and use `createQueueServiceMock()`
- [ ] Return type is assignable to `IQueueService` without casts
- [ ] No `any` types in the factory

## Work Log

| Date       | Action                     | Learnings                                                  |
| ---------- | -------------------------- | ---------------------------------------------------------- |
| 2026-02-22 | Created from PR #94 review | Dead code without consumers; mapped type erases signatures |
