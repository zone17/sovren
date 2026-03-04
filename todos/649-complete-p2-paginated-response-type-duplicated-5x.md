---
status: pending
priority: p2
issue_id: '649'
tags: [code-review, types, duplication, business-manager]
dependencies: []
---

# Paginated Response Type Duplicated 5x Inline

## Problem Statement

The paginated response shape `{ items: T[]; total: number; limit: number; offset: number }` is written inline in 5 places across 3 service files. This violates DRY and creates maintenance burden when the pagination contract changes.

**Consensus**: 4/8 review agents flagged this.

## Findings

- `packages/frontend/src/features/business/services/contractsApi.ts` — 2 inline occurrences (getTemplates, getContracts)
- `packages/frontend/src/features/business/services/invoicesApi.ts` — 1 inline occurrence (getInvoices)
- `packages/frontend/src/features/business/services/taxApi.ts` — 2 inline occurrences (getExpenses, getCategories)

## Proposed Solutions

### Solution A: Extract shared PaginatedResponse<T> generic (Recommended)

```typescript
// packages/shared/src/types/api.ts
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}
```

- **Pros**: Single source of truth, reusable across all features
- **Cons**: Adds shared type dependency
- **Effort**: Small
- **Risk**: Low

## Acceptance Criteria

- [ ] All 5 inline paginated types replaced with `PaginatedResponse<T>`
- [ ] Type defined in shared package for cross-feature reuse
- [ ] No type regression (all consuming code compiles)

## Work Log

| Date       | Action                                            | Learnings                                                 |
| ---------- | ------------------------------------------------- | --------------------------------------------------------- |
| 2026-03-04 | Created from PR #136 review (4/8 agent consensus) | common-solutions.md #14 (utility extraction threshold ≥3) |
