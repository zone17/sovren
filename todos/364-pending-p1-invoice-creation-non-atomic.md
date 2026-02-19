---
status: pending
priority: p1
issue_id: 364
tags:
  - code-review
  - data-integrity
  - atomicity
dependencies: []
---

# Invoice Creation Non-Atomic Multi-Step Operation

## Problem Statement

Invoice creation involves separate DB calls for (1) inserting the invoice row, (2) inserting line items, and (3) generating payment link. If step 2 or 3 fails, an invoice exists without line items or with a stale total. This creates orphaned invoices that show incorrect amounts and may confuse both creators and clients.

## Findings

**Source agents:** data-integrity-review, atomicity-review

**Evidence:**

- File: `packages/backend/src/services/finance/BusinessInvoiceService.ts`
- Issue: Invoice creation performs multiple separate Supabase calls — insert invoice row, insert line items (or update JSONB), and generate payment link. A failure after the first insert but before completion leaves the database in an inconsistent state. Need to verify whether line_items is a JSONB column (which would make step 1+2 atomic) or a separate table.

## Proposed Solutions

### Option A: Supabase RPC transaction

- **Approach:** Create a Supabase RPC function that wraps the entire invoice creation flow (insert invoice, insert/set line items, calculate total) in a single PostgreSQL transaction. Payment link generation can remain outside the transaction as a separate idempotent step.
- **Effort:** Medium
- **Risk:** Low

### Option B: Verify JSONB column and fix total calculation

- **Approach:** If line_items is already a JSONB column on the invoice row, the insert is already atomic for steps 1+2. Verify this, and ensure the total is calculated from the line_items array before insert rather than after. Payment link generation should be idempotent with retry logic.
- **Effort:** Small
- **Risk:** Low

## Recommended Action

_To be filled during triage_

## Technical Details

**Affected files:**

- `packages/backend/src/services/finance/BusinessInvoiceService.ts`

## Acceptance Criteria

- [ ] Invoice creation is atomic — either all components (row, line items, total) are persisted or none are
- [ ] Total amount is always consistent with line items at rest
- [ ] Payment link generation failure does not leave an invoice in a broken state
- [ ] Failed invoice creation does not leave orphaned rows in any table
- [ ] Integration test simulates partial failure and verifies rollback

## Work Log

| Date       | Action  | Notes                      |
| ---------- | ------- | -------------------------- |
| 2026-02-19 | Created | PR #86 code review finding |

## Resources

- PR: https://github.com/zone17/sovren/pull/86
