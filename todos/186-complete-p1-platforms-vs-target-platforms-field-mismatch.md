---
status: pending
priority: p1
issue_id: '186'
tags: [code-review, pr-85, api-contract]
---

# Frontend `platforms` vs Backend `target_platforms` Field Name Mismatch

## Problem Statement

Frontend sends `platforms` in the RepurposePayload but backend expects `target_platforms` in distribute.routes.ts. This field name mismatch causes a runtime 400 error (or silent undefined) when the frontend calls the distribute/repurpose endpoint. The feature is completely broken at the API boundary.

## Findings

- **File**: `packages/frontend/src/features/multi-platform/types/index.ts`
  - `RepurposePayload` interface defines field as `platforms`
  - Frontend code constructs request body using `platforms` field name
- **File**: `packages/backend/src/routes/v2/distribute.routes.ts`
  - Route handler destructures `req.body.target_platforms`
  - Validation schema (if any) expects `target_platforms`
  - `platforms` field is ignored, `target_platforms` is `undefined`

## Proposed Solutions

### Solution 1: Rename Frontend to `target_platforms` (Recommended)

Update `RepurposePayload.platforms` to `RepurposePayload.target_platforms` in the frontend types and all usage sites.

**Pros**: `target_platforms` is more descriptive (distinguishes source from target), matches backend naming
**Cons**: More files to change on frontend side

### Solution 2: Rename Backend to `platforms`

Update `distribute.routes.ts` to read `req.body.platforms` instead of `req.body.target_platforms`.

**Pros**: Fewer files to change if backend is the only consumer
**Cons**: Less descriptive name, may conflict with other `platforms` fields in the API

## Acceptance Criteria

- [ ] Frontend payload field name matches backend route handler's expected field name exactly
- [ ] Validation schema (Zod/Joi) matches the chosen field name
- [ ] API TypeScript types are shared or synchronized between frontend and backend
- [ ] Integration test confirms repurpose endpoint accepts frontend payload without 400 error
- [ ] Grep confirms no remaining references to the old field name in either package
