---
status: pending
priority: p2
issue_id: '120'
tags:
  - code-review
  - agent-native
  - api
  - payment
dependencies: []
---

# 120: Payment API Gaps — Transaction History, Balance, Webhook CRUD, Retry, Invoice List Missing

## Problem Statement

Multiple payment validators exist with no corresponding routes. Missing endpoints:

- `GET /transactions` — `GetTransactionHistorySchema` at validators/payment/index.ts:171
- `GET /balance` — `GetBalanceSchema` at validators/payment/index.ts:180
- `PUT /webhooks/:id` — `UpdateWebhookSchema` at validators/payment/index.ts:186
- `DELETE /webhooks/:id` — `DeleteWebhookSchema` at validators/payment/index.ts:194
- `GET /invoices` — no list/query endpoint
- `POST /invoices/:id/retry` — `PaymentRetryService.manualRetry()` at services/payment/PaymentRetryService.ts:643
- `GET /invoices/:id/retry-history` — `PaymentRetryService.getRetryHistory()` at :687
- `GET /metrics/retries` — `PaymentRetryService.getRetryMetrics()` at :707

## Findings

Validators and service methods exist but are not exposed via API. Critical payment operations like transaction history, balance queries, and retry management are inaccessible to clients.

## Proposed Solutions

1. **Option A**: Wire up all validators to routes in payment.routes.ts. Effort: Medium, Risk: Low.
2. **Option B**: Batch: validators first (already done), then routes, then tests. Effort: Medium, Risk: Low.

## Acceptance Criteria

- [ ] All payment validators connected to routes
- [ ] Invoice list with pagination
- [ ] Transaction history queryable
- [ ] Retry operations exposed
- [ ] Integration tests for all new endpoints

## Work Log

| Date       | Action                                      | Learnings                                                        |
| ---------- | ------------------------------------------- | ---------------------------------------------------------------- |
| 2026-02-14 | Identified in code review round 6 of PR #73 | Validators without routes indicate incomplete API implementation |
