---
status: pending
priority: p2
issue_id: '650'
tags: [code-review, types, duplication, business-manager]
dependencies: []
---

# getAnnualSummary Return Type Duplicated in 3 Places

## Problem Statement

The 8-field anonymous return type of `getAnnualSummary` is duplicated in: (1) `ITaxService` interface, (2) `TaxService` implementation, (3) frontend `QuarterlyTaxSummary` type. Changes to the shape require updating 3 locations.

**Consensus**: 4/8 review agents flagged this.

## Findings

- `packages/backend/src/interfaces/finance/ITaxService.ts` — inline return type
- `packages/backend/src/services/finance/TaxService.ts` — inline return type matching interface
- `packages/frontend/src/features/business/types/index.ts` — `QuarterlyTaxSummary` type

## Proposed Solutions

### Solution A: Define in shared package (Recommended)

```typescript
// packages/shared/src/types/finance.ts
export interface QuarterlyTaxSummary {
  year: number;
  quarter: string;
  totalIncomeSats: number;
  totalIncomeUsd: number;
  totalExpensesSats: number;
  totalExpensesUsd: number;
  netSats: number;
  netUsd: number;
}
```

- **Pros**: Single source of truth, backend and frontend import from same place
- **Cons**: None significant
- **Effort**: Small
- **Risk**: Low

## Acceptance Criteria

- [ ] Type defined once in shared package
- [ ] Backend interface and implementation reference shared type
- [ ] Frontend imports from shared type (or re-exports)
- [ ] No type regression

## Work Log

| Date       | Action                                            | Learnings                                         |
| ---------- | ------------------------------------------------- | ------------------------------------------------- |
| 2026-03-04 | Created from PR #136 review (4/8 agent consensus) | Cross-package type duplication — use shared types |
