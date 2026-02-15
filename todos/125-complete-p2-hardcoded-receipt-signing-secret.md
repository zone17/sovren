---
status: pending
priority: p2
issue_id: '125'
tags:
  - code-review
  - security
  - payment
  - receipt
dependencies: []
---

# 125: Hardcoded Receipt Signing Secret Fallback — Receipt Forgery Risk

## Problem Statement

Receipt signature in `receipt-service.ts` (line 558) uses `process.env.RECEIPT_SIGNATURE_SECRET || 'sovren-receipt-secret'`. In dev or misconfigured production, all receipts signed with publicly known key, allowing forgery.

## Findings

Hardcoded fallback secret creates forgery risk. Any client knowing the default secret can generate valid-looking receipts. This undermines payment verification.

## Proposed Solutions

1. **Option A**: Throw error if secret not set in production. Effort: Small, Risk: Low.
2. **Option B**: Use SecretsService to retrieve secret. Effort: Small, Risk: Low.

## Acceptance Criteria

- [ ] No hardcoded fallback for signing secret
- [ ] Production startup fails if secret missing
- [ ] Dev environment uses clearly-marked dev-only secret
- [ ] Secret rotation procedure documented

## Work Log

| Date       | Action                                      | Learnings                                                                               |
| ---------- | ------------------------------------------- | --------------------------------------------------------------------------------------- |
| 2026-02-14 | Identified in code review round 6 of PR #73 | Hardcoded secret fallbacks are always a security issue, even in "convenience" scenarios |
