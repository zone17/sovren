---
status: pending
priority: p3
issue_id: 356
tags: [code-review, frontend-backend]
---

# Frontend `UpdateContractPayload` includes `counterparty` not in backend schema + `CreateInvoicePayload` includes `totalSats`

## Problem Statement

Frontend TypeScript types include fields that do not exist in the corresponding backend Zod schemas. These phantom fields are silently stripped by Zod's `.parse()`, giving frontend developers the false impression that these fields are persisted or processed.

## Findings

- `UpdateContractPayload` includes a `counterparty` field not present in the backend schema
- `CreateInvoicePayload` includes a `totalSats` field not present in the backend schema
- Zod's default behavior strips unknown keys, so these fields are silently ignored
- Frontend developers may write code that depends on these fields being saved, leading to subtle bugs

## Proposed Solutions

1. Remove `counterparty` from `UpdateContractPayload` and `totalSats` from `CreateInvoicePayload` in frontend types
2. If these fields are intentionally needed, add them to the backend Zod schemas and database columns
3. Consider generating frontend types from backend Zod schemas to prevent future drift

## Acceptance Criteria

- [ ] Frontend payload types match backend Zod schemas exactly (no phantom fields)
- [ ] No frontend code depends on the removed fields being persisted
- [ ] If fields were intentional, they are added to both backend schema and database
