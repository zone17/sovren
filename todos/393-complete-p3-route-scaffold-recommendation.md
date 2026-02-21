---
status: pending
priority: p3
issue_id: 393
tags:
  - code-review
  - tooling
  - process
dependencies: []
---

# Route Scaffold/Template to Eliminate Repeated Fix Cycles

## Problem Statement

Git history reveals that every route file went through the same 4-commit fix cycle: add createApiResponse, add rate limiter, add validation, fix middleware order. This repeated pattern across all v2 routes indicates a missing scaffold or template. A route generator would eliminate this entire class of findings for future routes.

## Findings

**Source agents:** git-history-agent, code-review-agent

**Evidence:**

- File: `packages/backend/src/routes/v2/*.ts`
- Issue: Every route file in v2 required 4 sequential fix commits to reach the correct pattern. This suggests the correct route structure is non-obvious and developers (human or AI) consistently miss required middleware, validation, rate limiting, and response formatting on first pass.

## Proposed Solutions

### Option A: Plop template generator

- **Approach:** Create a Plop.js generator that scaffolds new route files with all required middleware (rate limiter, validation, auth), createApiResponse wrapper, proper middleware ordering, and TypeScript types pre-configured. Run with `npm run generate:route`.
- **Effort:** Medium
- **Risk:** Low

### Option B: Route factory function

- **Approach:** Create a `createRoute()` factory function that enforces the correct middleware chain programmatically. Each route file would call the factory with its specific handler, validation schema, and rate limit config. The factory handles ordering and composition.
- **Effort:** Medium
- **Risk:** Low

### Option C: Reference template file

- **Approach:** Create a `_route-template.ts` reference file with comments explaining each required section. Less automated but still reduces errors.
- **Effort:** Small
- **Risk:** Low (but less effective than A or B)

## Recommended Action

_To be filled during triage_

## Technical Details

**Affected files:**

- `packages/backend/src/routes/v2/*.ts` (all existing route files as reference)
- New: route scaffold script or template

## Acceptance Criteria

- [ ] Route scaffold/template/generator created
- [ ] New routes generated from scaffold include all required patterns (createApiResponse, rate limiter, validation, middleware order)
- [ ] Documentation on how to create new routes using the scaffold
- [ ] At least one existing route verified to match scaffold output

## Work Log

| Date       | Action  | Notes                      |
| ---------- | ------- | -------------------------- |
| 2026-02-19 | Created | PR #86 code review finding |

## Resources

- PR: https://github.com/zone17/sovren/pull/86
