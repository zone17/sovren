---
status: complete
priority: p2
issue_id: '285'
tags: [code-review, quality, naming]
dependencies: []
---

# CreateRevenuEntryPayload Typo Propagated to 4 Files

## Problem Statement

"CreateRevenuEntryPayload" is missing an 'e' — should be "CreateRevenueEntryPayload". The typo is propagated across interface, service, route, and frontend files.

## Findings

- `packages/backend/src/interfaces/finance/IRevenueTrackingService.ts` — typo in type name
- `packages/backend/src/services/finance/RevenueTrackingService.ts` — uses typo
- `packages/backend/src/routes/v2/revenue.routes.ts` — uses typo
- `packages/frontend/src/features/business-manager/` — uses typo

## Proposed Solutions

### Option 1: Rename across all files

**Approach:** Find-and-replace CreateRevenuEntryPayload → CreateRevenueEntryPayload in all 4 files.
**Effort:** 15min **Risk:** Low

## Acceptance Criteria

- [ ] Type name corrected to CreateRevenueEntryPayload
- [ ] All references updated
- [ ] No compilation errors

## Work Log

### 2026-02-18 - Code Review Discovery

**By:** Claude Code (13-agent parallel review)
