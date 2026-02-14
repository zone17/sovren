---
status: pending
priority: p1
issue_id: '114'
tags:
  - code-review
  - data-integrity
  - payment
  - lightning
  - receipt
dependencies: []
---

# 114: Receipt Storage In-Memory Only — All Receipts Lost on Restart

## Problem Statement

`receiptStorage` in `/packages/backend/src/services/lightning/receipt-service.ts` (line 190) is a plain `Map<string, PaymentReceipt>`. Receipts are NEVER persisted to database or disk. Process restart loses ALL receipt records. This is financial data with legal/compliance implications. Receipt verification always returns "not found" after restart. `downloadCount` and `emailDeliveredAt` tracking are purely ephemeral.

## Findings

- **Line 190**: `private receiptStorage = new Map<string, PaymentReceipt>()` — no persistence
- **Lines 297-299**: 3 entries per receipt stored only in Map (receipt, payment_hash, invoice_id)
- **Lines 461-517**: Receipt verification logic fails after restart — all receipts return "not found"
- `downloadCount` and `emailDeliveredAt` tracking lost on restart
- Financial records with potential legal/compliance requirements stored only in memory

## Proposed Solutions

**Option A: Persist to JsonFilePaymentStore (Recommended for MVP)**

- Extend existing JSON persistence to include receipts
- Consistent with current architecture
- Effort: Small, Risk: Low

**Option B: Persist to Supabase `receipts` table**

- Create dedicated receipts table in Supabase
- Full database benefits (ACID, querying, reporting)
- Effort: Medium, Risk: Low

**Option C: At minimum, add health-check warning**

- Document that receipt data is ephemeral
- Add warning in logs/health endpoint
- Effort: Small, Risk: Low (doesn't solve the problem)

## Acceptance Criteria

- [ ] Receipts survive process restart
- [ ] Receipt verification works across restarts
- [ ] Receipt data persisted to durable storage
- [ ] downloadCount and emailDeliveredAt tracking persisted
- [ ] Migration path for existing in-memory receipts

## Work Log

| Date       | Action                                      | Learnings                                                   |
| ---------- | ------------------------------------------- | ----------------------------------------------------------- |
| 2026-02-14 | Identified in code review round 6 of PR #73 | Financial/legal records must never be stored only in memory |
