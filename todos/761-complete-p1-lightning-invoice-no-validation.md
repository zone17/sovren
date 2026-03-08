---
status: pending
priority: p1
issue_id: 761
tags: [code-review, security, validation, lightning, payments]
dependencies: []
---

# Lightning Invoice Creation — No Input Validation

## Problem Statement

`POST /api/lightning/invoice` passes `req.body` directly to `lightningService.createInvoice()` without Zod validation. Attackers can inject arbitrary fields, manipulate amounts, or cause unexpected LNbits API behavior. CVSS: 7.5.

## Findings

- **Security Agent**: P1-04 — `lightning.ts` lines 39-46
- Subscription route (line 77) correctly uses `validate({ body: CreateSubscriptionBodySchema })`

## Proposed Solutions

Add Zod schema validating `amount`, `description`, and expected fields. Apply via `validate()` middleware.

## Acceptance Criteria

- [ ] Invoice creation endpoint has Zod body validation
- [ ] Invalid/extra fields are rejected with 400
- [ ] Test coverage for validation
