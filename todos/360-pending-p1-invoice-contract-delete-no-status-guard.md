---
status: pending
priority: p1
issue_id: 360
tags:
  - code-review
  - data-integrity
  - security
dependencies: []
---

# Invoice and Contract DELETE Endpoints Missing Status Guard

## Problem Statement

DELETE endpoints for invoices and contracts don't check if the record is in a deletable state (draft/unpaid). This allows deletion of paid invoices or active contracts, losing financial records. Deleting paid invoices violates financial record-keeping requirements and could mask fraud or cause accounting discrepancies.

## Findings

**Source agents:** data-integrity-review, security-audit

**Evidence:**

- File: `packages/backend/src/routes/v2/business-invoices.routes.ts`
- Issue: DELETE handler proceeds without checking invoice status — paid or partially-paid invoices can be deleted
- File: `packages/backend/src/routes/v2/business-contracts.routes.ts`
- Issue: DELETE handler proceeds without checking contract status — active or completed contracts can be deleted
- File: `packages/backend/src/services/finance/BusinessInvoiceService.ts`
- Issue: delete method does not validate invoice.status before performing deletion
- File: `packages/backend/src/services/finance/ContractService.ts`
- Issue: delete method does not validate contract.status before performing deletion

## Proposed Solutions

### Option A: Service-level status guard

- **Approach:** Add status check in BusinessInvoiceService.delete() and ContractService.delete() — only allow deletion when status is 'draft'. Return 409 Conflict with descriptive message for non-draft records.
- **Effort:** Small
- **Risk:** Low

### Option B: Soft delete with audit trail

- **Approach:** Replace hard delete with soft delete (set deleted_at timestamp) for all statuses except draft. Draft records can still be hard deleted. Provides audit trail for financial records.
- **Effort:** Medium
- **Risk:** Medium

## Recommended Action

_To be filled during triage_

## Technical Details

**Affected files:**

- `packages/backend/src/routes/v2/business-invoices.routes.ts`
- `packages/backend/src/routes/v2/business-contracts.routes.ts`
- `packages/backend/src/services/finance/BusinessInvoiceService.ts`
- `packages/backend/src/services/finance/ContractService.ts`

## Acceptance Criteria

- [ ] DELETE /invoices/:id returns 409 Conflict when invoice status is not 'draft'
- [ ] DELETE /contracts/:id returns 409 Conflict when contract status is not 'draft'
- [ ] DELETE /invoices/:id succeeds for draft invoices
- [ ] DELETE /contracts/:id succeeds for draft contracts
- [ ] Error response includes descriptive message explaining why deletion is blocked
- [ ] Integration tests cover attempted deletion of paid/active records

## Work Log

| Date       | Action  | Notes                      |
| ---------- | ------- | -------------------------- |
| 2026-02-19 | Created | PR #86 code review finding |

## Resources

- PR: https://github.com/zone17/sovren/pull/86
