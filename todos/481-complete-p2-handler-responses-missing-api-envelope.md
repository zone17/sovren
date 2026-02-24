---
status: pending
priority: p2
issue_id: "481"
tags:
  - code-review
  - msw
  - api-contract
  - phase-9
dependencies: []
---

# Handler responses missing ApiResponse envelope

## Problem Statement

All 8 MSW handler files return raw data objects (e.g., `{ id, title, body }`) instead of the `ApiResponse<T>` envelope (`{ success: true, data: { id, title, body }, metadata: {...} }`) used by the real backend. The frontend ApiClient expects and unwraps this envelope — tests using these handlers will get wrong response shapes.

**Consensus: 4/7 review agents flagged this.**

## Findings

### Evidence

- `packages/frontend/src/services/api/types.ts` defines `ApiResponse<T>` with `{ success, data, error?, code?, timestamp? }`
- `PaginatedResponse<T>` adds `{ pagination: { page, limit, total, totalPages, hasNext, hasPrev } }`
- All 8 handler files return unwrapped data
- Example: `content.ts` returns `{ id, title, body }` but ApiClient expects `{ success: true, data: { id, title, body } }`

## Proposed Solutions

### Option A: Wrap all handler responses in ApiResponse envelope (Recommended)

Create a `wrapResponse<T>(data: T)` helper that returns `{ success: true, data, timestamp: new Date().toISOString() }`. Apply to all handlers.
**Pros:** Matches real API. Tests will exercise real response unwrapping.
**Cons:** More verbose handlers.
**Effort:** Small
**Risk:** Low

### Option B: Keep raw responses, add note that these are "pre-unwrapped"

**Pros:** Simpler handlers.
**Cons:** Doesn't match reality. Tests skip envelope handling.
**Effort:** None
**Risk:** Medium — missed bugs in response parsing.

## Recommended Action

Option A. Create helper, apply to all handlers.

## Technical Details

**Affected files:** All 8 files in `packages/frontend/src/test-utils/msw/handlers/`

## Acceptance Criteria

- [ ] All handler responses wrapped in `{ success: true, data: T }` envelope
- [ ] Paginated responses include `pagination` object matching `PaginatedResponse<T>`
- [ ] Error handlers return `{ success: false, error: message, code: statusCode }`
- [ ] Helper function created to reduce duplication

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-24 | Created from Phase 9 MSW review (4/7 agent consensus) | MSW handlers must match API envelope, not just data shape |

## Resources

- `packages/frontend/src/services/api/types.ts` — ApiResponse, PaginatedResponse types
