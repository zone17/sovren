---
status: pending
priority: p1
issue_id: 763
tags: [code-review, security, database, rls, payments]
dependencies: []
---

# Payments INSERT Policy Allows Fraudulent Records

## Problem Statement

The payments table INSERT policy uses `WITH CHECK (payer_id = auth.uid() OR recipient_id = auth.uid())`. A malicious user can insert payment records crediting themselves as recipient for payments never made, inflating `total_earnings_sats`.

## Findings

- **Data Integrity Agent**: P1-3 — `baseline_schema.sql` lines 234-235

## Proposed Solutions

Restrict to payer only: `WITH CHECK (payer_id = auth.uid())`. Payment records crediting recipients should only come via `service_role`.

## Acceptance Criteria

- [ ] INSERT policy restricted to `payer_id = auth.uid()` or `service_role`
- [ ] Cannot insert records as arbitrary recipient
- [ ] Existing payment flows still work via service_role
