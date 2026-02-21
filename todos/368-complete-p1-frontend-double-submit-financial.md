---
status: complete
priority: p1
issue_id: 368
tags:
  - code-review
  - frontend
  - race-condition
  - financial
dependencies: []
---

# Frontend Financial Buttons Missing Pending Disable State

## Problem Statement

Financial action buttons (mark invoice as paid, complete order, release escrow) don't disable while the mutation is pending. Rapid double-clicks can trigger duplicate financial operations (double-payment, double-release). This is a direct financial risk that can cause double-charges or premature fund releases.

## Findings

**Source agents:** frontend-review, financial-review

**Evidence:**

- File: `packages/frontend/src/features/business/components/InvoiceDashboard.tsx`
- Issue: Financial action buttons (mark as paid, send reminder) do not set `disabled={mutation.isPending}` during the mutation lifecycle. Double-clicks submit duplicate requests.
- File: `packages/frontend/src/features/creator-network/components/OrderTracker.tsx`
- Issue: Order completion and escrow release buttons do not disable during pending mutations. Same double-submit vulnerability.
- Note: `InvoiceEditor` (line 182) already implements this pattern correctly — it should be replicated to the affected components.

## Proposed Solutions

### Option A: Add disabled={mutation.isPending} to all financial buttons

- **Approach:** Audit all financial action buttons in InvoiceDashboard and OrderTracker. Add `disabled={mutation.isPending}` prop to each. Follow the existing pattern from InvoiceEditor line 182.
- **Effort:** Small
- **Risk:** Low

### Option B: Create a FinancialActionButton wrapper component

- **Approach:** Create a reusable `<FinancialActionButton>` component that automatically handles pending state, loading indicator, and double-submit prevention. Replace all financial buttons across the app.
- **Effort:** Medium
- **Risk:** Low

## Recommended Action

_To be filled during triage_

## Technical Details

**Affected files:**

- `packages/frontend/src/features/business/components/InvoiceDashboard.tsx`
- `packages/frontend/src/features/creator-network/components/OrderTracker.tsx`

## Acceptance Criteria

- [ ] All financial action buttons are disabled while their mutation is pending
- [ ] Rapid double-click on any financial button results in exactly one API call
- [ ] Loading indicator is shown on financial buttons during pending state
- [ ] Buttons re-enable after mutation succeeds or fails
- [ ] Visual regression test confirms button states

## Work Log

| Date       | Action  | Notes                      |
| ---------- | ------- | -------------------------- |
| 2026-02-19 | Created | PR #86 code review finding |

## Resources

- PR: https://github.com/zone17/sovren/pull/86
