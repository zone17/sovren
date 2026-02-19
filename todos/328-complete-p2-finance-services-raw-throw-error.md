---
status: pending
priority: p2
issue_id: 328
tags: [code-review, error-handling, security]
---

# Finance services raw `throw error` pattern — leaks internal DB details

## Problem Statement

All 4 finance services use bare `throw error` to propagate raw PostgrestError objects from Supabase. These errors can contain internal database details (table names, column names, constraint names, SQL snippets) that should not be exposed to API consumers. Community services correctly wrap errors with `this.logger.error()` and `throw new Error(msg)`.

## Findings

- `packages/backend/src/services/finance/BusinessInvoiceService.ts` — multiple `throw error` sites
- `packages/backend/src/services/finance/ContractService.ts` — multiple `throw error` sites
- `packages/backend/src/services/finance/RevenueService.ts` — multiple `throw error` sites
- `packages/backend/src/services/finance/TaxService.ts` — multiple `throw error` sites
- Approximately 15 total sites across all 4 files
- Community services use `this.logger.error(context, error)` + `throw new Error('user-safe message')`

## Proposed Solutions

1. At each `throw error` site, add `this.logger.error()` with context before throwing
2. Replace `throw error` with `throw new Error('descriptive but safe message')`
3. Ensure raw PostgrestError details are logged but never sent to the client

## Technical Details

- **Affected Files**: packages/backend/src/services/finance/BusinessInvoiceService.ts, packages/backend/src/services/finance/ContractService.ts, packages/backend/src/services/finance/RevenueService.ts, packages/backend/src/services/finance/TaxService.ts

## Acceptance Criteria

- [ ] All ~15 `throw error` sites wrapped with logger and safe error messages
- [ ] No raw PostgrestError objects propagated to route handlers
- [ ] Error logs contain full error context for debugging
- [ ] Client-facing error messages are descriptive but do not leak internals
- [ ] Existing tests pass
