---
status: pending
priority: p1
issue_id: '623'
tags: [code-review, security, backend, validation]
dependencies: []
---

# Missing UUID validation on route parameters

## Problem Statement

Route parameters `:contentId` and `:commentId` in `packages/backend/src/routes/v2/comments.routes.ts` are not validated as UUID format before being passed to the service layer. Arbitrary strings reach Supabase `.eq('id', contentId)`, which may cause unexpected behavior or information disclosure.

## Findings

- Security Sentinel flagged as P1
- All routes accept raw `req.params.contentId` and `req.params.commentId` without format validation
- Supabase will return empty results for non-UUID strings, but error messages could leak table/column names
- Pattern: critical-patterns.md requires input validation at system boundary

## Proposed Solutions

### Option A: Add Zod param validation middleware (Recommended)

Add UUID format validation to the route parameter schemas in `packages/backend/src/validators/community.ts`.

- Pros: Consistent with existing Zod validation pattern, early rejection
- Cons: None significant
- Effort: Small

## Acceptance Criteria

- [ ] All route params validated as UUID format before reaching service
- [ ] Invalid UUIDs return 400 with generic error message
- [ ] Tests verify rejection of non-UUID params
