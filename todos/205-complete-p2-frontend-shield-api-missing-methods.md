---
status: pending
priority: p2
issue_id: '205'
tags: [code-review, pr-85, frontend]
---

# Frontend Shield API References Missing Backend Methods

## Problem Statement

Frontend shieldApi.ts references 4 backend methods that don't match routes: getWellnessResources (no route), listDmcaReports (no route), and 2 others.

## Findings

- **File**: `packages/frontend/src/features/content-shield/services/shieldApi.ts`
- **File**: `packages/frontend/src/features/wellness/services/wellnessApi.ts`
- The frontend API service files reference at least 4 backend endpoints that have no corresponding route definitions:
  - `getWellnessResources` — no matching backend route
  - `listDmcaReports` — no matching backend route
  - 2 additional methods with no backend route match
- These API calls will return 404 errors at runtime
- Indicates either the backend routes were planned but not implemented, or the frontend was built against an outdated API spec

## Proposed Solutions

1. Add the missing backend routes and controller methods to match the frontend API calls (if the features are planned and needed)
2. Remove or stub out the frontend API calls that reference non-existent routes, replacing them with TODO comments or feature flags until the backend is implemented

## Acceptance Criteria

- [ ] Every frontend API call in shieldApi.ts and wellnessApi.ts has a corresponding backend route
- [ ] No 404 errors occur when the frontend exercises all shield/wellness API methods
- [ ] Any intentionally deferred endpoints are clearly marked with TODO comments and guarded by feature flags
- [ ] Frontend gracefully handles missing endpoints if backend implementation is deferred
