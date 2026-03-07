---
status: pending
priority: p1
issue_id: '191'
tags: [code-review, pr-85, api-contract]
---

# Frontend DMCA Reports API Call Returns 404 — No Backend Route

## Problem Statement

Frontend `shieldApi.ts` calls `GET /api/v2/shield/dmca/reports` but no backend route exists for listing DMCA reports. This will 404 at runtime, breaking the DMCA reports UI entirely. Users cannot view their submitted DMCA reports.

## Findings

- **File**: `packages/frontend/src/features/content-shield/services/shieldApi.ts`, line 70
  - Makes a `GET` request to `/api/v2/shield/dmca/reports`
  - Expects a response with an array of DMCA report objects
  - No error handling for 404 (likely shows generic error or blank screen)
- **File**: `packages/backend/src/routes/v2/shield.routes.ts`
  - No `GET /dmca/reports` route is defined
  - Other DMCA routes may exist (e.g., POST to submit a report) but the listing endpoint is missing
  - The route handler and any associated service method are absent

## Proposed Solutions

### Solution 1: Add GET /dmca/reports Backend Route (Recommended)

1. Add `GET /api/v2/shield/dmca/reports` route to `shield.routes.ts`
2. Add `authenticate` middleware — only authenticated creators can list their own reports
3. Create service method to query DMCA reports by `creator_id`
4. Return paginated list of reports with status (submitted, under_review, resolved, rejected)
5. Add RLS policy in Supabase so creators can only read their own reports

**Pros**: Completes the feature, frontend works as designed
**Cons**: New endpoint to implement, test, and secure

### Solution 2: Remove Frontend API Call

If DMCA report listing is not needed for MVP, remove the `GET /dmca/reports` call from `shieldApi.ts` and the associated UI.

**Pros**: No backend work needed
**Cons**: Removes user-facing functionality, may leave dead UI components

## Acceptance Criteria

- [ ] `GET /api/v2/shield/dmca/reports` returns 200 with the creator's DMCA reports (or solution 2: frontend call is removed)
- [ ] Route requires authentication — unauthenticated requests return 401
- [ ] Creators can only see their own reports (RLS or service-layer filtering)
- [ ] Frontend DMCA reports page renders without errors
- [ ] Integration test confirms the endpoint returns expected data shape
