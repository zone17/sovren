---
status: pending
priority: p2
issue_id: "482"
tags:
  - code-review
  - msw
  - api-contract
  - phase-9
dependencies: []
---

# Handler URL paths use /api/* instead of real /api/v1/*

## Problem Statement

MSW handlers define endpoints at `/api/content`, `/api/analytics/summary`, etc. The real frontend ApiClient uses `/api/v1/content`, `/api/v1/analytics/summary`. Handlers will never match real requests because the `/v1/` prefix is missing.

**Consensus: 3/7 review agents flagged this.**

## Findings

### Evidence

- `apiClient.ts` base URL includes `/api/v1/` prefix
- All handler files use `/api/*` without version prefix
- When tests use the real ApiClient, MSW will never intercept because paths don't match

## Proposed Solutions

### Option A: Update all handler paths to /api/v1/* (Recommended)

**Pros:** Matches real API paths. Handlers will intercept real ApiClient requests.
**Cons:** Need to verify exact paths from backend routes.
**Effort:** Small
**Risk:** Low

### Option B: Use regex patterns to match with or without /v1/

**Pros:** Handles both old and new path styles.
**Cons:** Overly permissive. Hides path mismatches.
**Effort:** Small
**Risk:** Medium

## Recommended Action

Option A. Update paths to match real API.

## Technical Details

**Affected files:** All 8 handler files in `packages/frontend/src/test-utils/msw/handlers/`

## Acceptance Criteria

- [ ] All handler paths updated to match real ApiClient paths (`/api/v1/*`)
- [ ] Verified against backend route definitions
- [ ] At least one handler confirmed to intercept a real ApiClient request

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-24 | Created from Phase 9 MSW review (3/7 agent consensus) | MSW handler paths must exactly match frontend ApiClient paths |

## Resources

- `packages/frontend/src/services/api/apiClient.ts` — base URL
- `packages/backend/src/routes/` — real endpoint definitions
