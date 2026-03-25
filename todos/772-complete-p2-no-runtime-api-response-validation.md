---
status: pending
priority: p2
issue_id: 772
tags: [code-review, typescript, frontend, api]
dependencies: []
---

# No Runtime API Response Validation at Trust Boundary

## Problem Statement

The frontend apiClient uses `response.json() as Promise<T>` (line 127) — a compile-time fiction. Server response changes silently produce wrong data. The TODO(ADR-020) comment acknowledges this. Every single API call relies on this trust-cast.

## Findings

- **TypeScript Agent**: P1-5 — `apiClient.ts` line 127
- **Architecture Agent**: P2-03 — same finding

## Proposed Solutions

Add Zod runtime validation for the response envelope (`success`, `data`, `error`) at minimum. Use shared schemas for type-critical endpoints.

## Acceptance Criteria

- [ ] Response envelope shape validated at runtime
- [ ] Backend response changes caught at the API boundary
- [ ] Critical endpoints (payments, auth) have full response validation
