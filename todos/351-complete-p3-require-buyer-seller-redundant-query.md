---
status: pending
priority: p3
issue_id: 351
tags: [code-review, performance]
---

# `requireBuyer`/`requireSeller` middleware makes redundant DB query

## Problem Statement

The `requireBuyer` and `requireSeller` middleware functions fetch an order from the database to verify the user's role, but the downstream service handler fetches the same order again. This results in duplicate database queries for every marketplace order endpoint.

## Findings

- File: `packages/backend/src/routes/v2/marketplace.routes.ts`
- Middleware fetches order to check if user is buyer/seller
- Service handler fetches the same order by ID immediately after
- Two identical DB queries per request on protected marketplace routes

## Proposed Solutions

1. Store the fetched order on `req.locals` (or `res.locals`) in the middleware so the service can reuse it
2. Alternatively, combine the role check into the service layer and remove the middleware
3. If middleware pattern is preferred, create a `withOrder` middleware that both validates role and attaches the order

## Acceptance Criteria

- [ ] Order is fetched from the database only once per request
- [ ] Buyer/seller role verification still occurs before service logic executes
- [ ] No change in authorization behavior or error responses
