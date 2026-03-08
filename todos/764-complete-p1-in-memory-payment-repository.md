---
status: pending
priority: p1
issue_id: 764
tags: [code-review, data-integrity, payments, financial]
dependencies: []
---

# In-Memory PaymentProcessingService — Financial Data Lost on Restart

## Problem Statement

PaymentProcessingService defaults to `InMemoryPaymentRepository()` (line 238). All invoices, transactions, refunds, and idempotency records stored in `Map<>` objects. Server restart = complete financial data loss. Orphaned Lightning invoices. Potential double-spend.

## Findings

- **Data Integrity Agent**: P1-4 — `PaymentProcessingService.ts` line 238
- Also: `JsonFilePaymentStore` (payment-persistence.ts) has no ACID guarantees

## Proposed Solutions

1. Remove InMemoryPaymentRepository fallback — require persistent Supabase-backed repo
2. DI container must fail fast if no persistent repository registered
3. Restrict JsonFilePaymentStore to development via env check

## Acceptance Criteria

- [ ] Production startup fails if no persistent payment repository
- [ ] All payment data survives server restart
- [ ] JsonFilePaymentStore only usable in development
