---
status: pending
priority: p2
issue_id: 340
tags: [code-review, performance, security]
---

# `select('*')` over-fetching in finance services

## Problem Statement

All four finance services use `select('*')` in their Supabase queries, fetching all columns from each table. Community services correctly use explicit column lists (e.g., `select('id, name, created_at')`). Over-fetching wastes bandwidth, slows queries, and may inadvertently expose sensitive columns to API consumers.

## Findings

- `packages/backend/src/services/finance/ContractService.ts` — uses `select('*')`
- `packages/backend/src/services/finance/RevenueService.ts` — uses `select('*')`
- `packages/backend/src/services/finance/BusinessInvoiceService.ts` — uses `select('*')`
- `packages/backend/src/services/finance/TaxService.ts` — uses `select('*')`
- Community services use explicit column lists as the established pattern

## Proposed Solutions

1. Replace all `select('*')` calls with explicit column lists
2. Identify which columns are actually needed by the route handlers and frontend
3. Ensure no sensitive columns (internal IDs, audit fields) are exposed unnecessarily

## Technical Details

- **Affected Files**: packages/backend/src/services/finance/ContractService.ts, packages/backend/src/services/finance/RevenueService.ts, packages/backend/src/services/finance/BusinessInvoiceService.ts, packages/backend/src/services/finance/TaxService.ts

## Acceptance Criteria

- [ ] All `select('*')` calls replaced with explicit column lists in all 4 finance services
- [ ] Column lists include only columns needed by consumers
- [ ] No sensitive internal columns exposed
- [ ] Existing tests pass with the reduced column sets
- [ ] Response shapes verified compatible with frontend expectations
