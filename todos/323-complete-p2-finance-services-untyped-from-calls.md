---
status: pending
priority: p2
issue_id: 323
tags: [code-review, typescript, type-safety]
---

# Finance services untyped `.from()` calls — all 4 finance services lack type params

## Problem Statement

All four finance services use untyped `.from('table')` calls without generic type parameters, resulting in `any`-typed query results. Community services correctly use `.from<RowType>('table')`. This inconsistency leads to loss of type safety and forces unsafe casts like `(inserted as { id: string }).id` (5 occurrences).

## Findings

- `packages/backend/src/services/finance/BusinessInvoiceService.ts` — all `.from()` calls lack type params
- `packages/backend/src/services/finance/ContractService.ts` — all `.from()` calls lack type params
- `packages/backend/src/services/finance/RevenueService.ts` — all `.from()` calls lack type params
- `packages/backend/src/services/finance/TaxService.ts` — all `.from()` calls lack type params
- Community services (e.g., CreatorCircleService, MentorshipService) correctly use `.from<RowType>('table')`
- 5 occurrences of `(inserted as { id: string }).id` casts as a workaround

## Proposed Solutions

1. Define row type interfaces for each finance table (invoices, contracts, revenue_goals, expenses, etc.)
2. Add type parameters to all `.from<RowType>()` calls across all 4 finance services
3. Remove the 5 unsafe `as { id: string }` casts that become unnecessary with proper typing

## Technical Details

- **Affected Files**: packages/backend/src/services/finance/BusinessInvoiceService.ts, packages/backend/src/services/finance/ContractService.ts, packages/backend/src/services/finance/RevenueService.ts, packages/backend/src/services/finance/TaxService.ts

## Acceptance Criteria

- [ ] Row type interfaces defined for all finance tables
- [ ] All `.from()` calls in all 4 finance services use type parameters
- [ ] All 5 `as { id: string }` casts removed
- [ ] No new `any` types introduced
- [ ] TypeScript compiles without errors
