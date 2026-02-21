---
status: pending
priority: p2
issue_id: 344
tags: [code-review, agent-native, api]
---

# Missing DELETE routes for business resources + update routes

## Problem Statement

Several business and marketplace resources lack DELETE and UPDATE endpoints, making it impossible for users or agents to remove or modify resources after creation. This violates CRUD completeness expectations and blocks agent-native workflows that need to manage resource lifecycles.

## Findings

Missing DELETE routes:

- No `DELETE /business/contracts/:id` — cannot delete/cancel contracts
- No `DELETE /business/invoices/:id` — cannot delete draft invoices
- No `DELETE /business/expenses/:id` — cannot delete expenses
- No `DELETE /business/expense-categories/:id` — cannot delete expense categories
- No `DELETE /business/contract-templates/:id` — cannot delete contract templates

Missing UPDATE routes:

- No `PUT/PATCH /marketplace/listings/:id` — cannot update listings
- No `PUT/PATCH /mentorship/profiles/:id` — cannot update mentor profiles
- No `PUT/PATCH /business/expenses/:id` — cannot update expenses
- No `PUT/PATCH /business/expense-categories/:id` — cannot update expense categories

## Proposed Solutions

1. Add DELETE routes with state guards (e.g., cannot delete a signed contract, only draft ones)
2. Add essential UPDATE routes for resources that need modification after creation
3. Implement soft-delete where appropriate (set status to 'deleted' instead of hard delete)
4. Add proper authorization checks (only owner can delete/update)

## Technical Details

- **Affected Files**: packages/backend/src/routes/v2/business-contracts.routes.ts, packages/backend/src/routes/v2/business-invoices.routes.ts, packages/backend/src/routes/v2/business-tax.routes.ts, packages/backend/src/routes/v2/marketplace.routes.ts, packages/backend/src/routes/v2/mentorship.routes.ts, and corresponding service files

## Acceptance Criteria

- [ ] DELETE routes added for contracts, invoices, expenses, expense categories, contract templates
- [ ] State guards prevent deletion of active/signed resources
- [ ] UPDATE routes added for marketplace listings, mentor profiles, expenses, expense categories
- [ ] Authorization checks ensure only owners can delete/update
- [ ] Soft-delete used where appropriate
- [ ] All routes use `createApiResponse()` helper
- [ ] Routes follow existing patterns and middleware chain
