---
status: complete
priority: p2
issue_id: '282'
tags: [code-review, typescript, type-safety]
dependencies: []
---

# Pervasive `as any` Casts in Finance Services (22+)

## Problem Statement

Finance service implementations contain 22+ `as any` type assertions, bypassing TypeScript's type checker. These mask potential type mismatches between Supabase query results and expected shapes.

## Findings

- `packages/backend/src/services/finance/ContractAnalysisService.ts` — 6 `as any` casts
- `packages/backend/src/services/finance/InvoicingService.ts` — 5 `as any` casts
- `packages/backend/src/services/finance/RevenueTrackingService.ts` — 5 `as any` casts
- `packages/backend/src/services/finance/TaxPreparationService.ts` — 6 `as any` casts

## Proposed Solutions

### Option 1: Generate types from Supabase schema

**Approach:** Use `supabase gen types typescript` to generate DB types, then cast query results to generated types instead of `any`.
**Effort:** 3-4h **Risk:** Low

## Acceptance Criteria

- [ ] Zero `as any` casts in finance services
- [ ] Supabase-generated types used for query results
- [ ] Type mismatches caught at compile time

## Work Log

### 2026-02-18 - Code Review Discovery

**By:** Claude Code (13-agent parallel review)
