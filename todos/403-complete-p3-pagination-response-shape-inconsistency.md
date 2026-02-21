---
status: pending
priority: p3
issue_id: "420"
tags: [code-review, architecture, api-contract, pr-87]
dependencies: []
---

# Pagination response shape differs between new and existing endpoints

## Problem Statement

The 10 newly-paginated endpoints return `{ items, total, limit, offset }` while the existing paginated endpoints (shield fingerprints, shield alerts, wellness pulse history) use a different shape: `{ data, pagination: { page, limit, total, totalPages } }`.

The `PaginatedResponse<T>` type in `api-handlers.ts` uses `{ items: T[], pagination: PaginationMeta }` with `PaginationMeta` having `page, limit, total, totalPages, hasNext, hasPrev`.

This means 3 different pagination shapes exist:
1. New (this PR): `{ items, total, limit, offset }` (offset-based)
2. Existing shield/alerts: `{ data, pagination }` (page-based)
3. Canonical type: `PaginatedResponse<T>` with full `PaginationMeta` (page-based, never used)

## Findings

- New endpoints: `{ items: paginated, total: data.length, limit, offset }`
- Shield fingerprints: `{ data: result.data, pagination: result.pagination }`
- Shield alerts: `{ data: result.data, pagination: result.pagination }`
- `PaginatedResponse<T>` from `api-handlers.ts` is never actually used in any route
- Frontend consumers will need to handle different response shapes per endpoint

## Proposed Solutions

### Option 1: Accept multiple shapes (pragmatic)

**Approach:** The API is still evolving. Standardize later when all endpoints support pagination.

**Effort:** 0 minutes

**Risk:** Low (frontend can adapt per endpoint)

---

### Option 2: Standardize on one shape

**Approach:** Pick either offset-based or page-based, create a helper, use it everywhere.

**Effort:** 2-3 hours

**Risk:** Low but wide-reaching

## Recommended Action

Accept for this PR. Create a follow-up to standardize pagination response shape across all endpoints.

## Technical Details

**Affected files:**
- All 10 newly-paginated route files
- `packages/shared/src/types/api-handlers.ts` (PaginatedResponse type)
- `packages/backend/src/routes/v2/shield.routes.ts` (existing pagination)

## Acceptance Criteria

- [ ] Decision documented

## Work Log

### 2026-02-20 - Code Review Discovery

**By:** Claude Code (PR #87 review)

## Resources

- **PR:** #87
