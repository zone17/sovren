---
status: pending
priority: p1
issue_id: '115'
tags:
  - code-review
  - data-integrity
  - payment
  - lightning
dependencies: []
---

# 115: Premature Invoice Status Mutation in processWebhook — Inconsistent State on Failure

## Problem Statement

In `/packages/backend/src/services/lightning-service.ts` (lines 587-608), `invoice.status = 'paid'` is set BEFORE persistence. If `savePayment` or `updateInvoiceStatus` throws, the in-memory invoice is already marked 'paid' but no payment record was persisted. Subsequent checks see 'paid' status without corresponding payment record.

## Findings

- **Line 589**: `invoice.status = 'paid'` — mutation BEFORE persistence
- **Lines 606-608**: Persistence happens AFTER mutation
- **Lines 392-395**: Expired status changes never persisted to disk
- Creates window where in-memory state diverges from persisted state
- If persistence fails, invoice shows as paid but payment record missing
- Retry logic or status checks will see inconsistent state

## Proposed Solutions

**Option A: Move status mutation AFTER successful persistence (Recommended)**

- Reorder operations: persist first, then mutate in-memory state
- Implementation: `await this.persistence.savePayment(payment); await this.persistence.updateInvoiceStatus(invoice.id, 'paid'); invoice.status = 'paid';`
- Effort: Small, Risk: Low

**Option B: Use local variable for updated invoice**

- Avoid mutating cached reference directly
- Create updated copy, persist, then update cache
- Effort: Small, Risk: Low

## Acceptance Criteria

- [ ] Invoice status only updated in memory AFTER successful persistence
- [ ] Expired status changes also persisted to disk
- [ ] No window of inconsistency between memory and persistence
- [ ] Persistence failures don't leave inconsistent state
- [ ] Tests verify rollback behavior on persistence failure

## Work Log

| Date       | Action                                      | Learnings                                               |
| ---------- | ------------------------------------------- | ------------------------------------------------------- |
| 2026-02-14 | Identified in code review round 6 of PR #73 | State mutations must follow persistence, not precede it |
