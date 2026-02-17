---
status: pending
priority: p1
issue_id: '147'
tags: [code-review, pr-82, phase-7, security, routing, critical-bug]
dependencies: []
---

# V2 Routes Not Mounted in app.ts

## Problem Statement

The v2 router (wellness + shield endpoints) is defined in `packages/backend/src/routes/v2/index.ts` but is never mounted in `packages/backend/src/app.ts`. All 24 Phase 7 API endpoints are unreachable. This means no wellness or content shield functionality works at all.

## Findings

- `packages/backend/src/routes/v2/index.ts` exports v2Router with wellness and shield routes
- `packages/backend/src/app.ts` (lines 201-213) — no `app.use('/api/v2', v2Router)` line exists
- All 14 wellness + 10 shield endpoints return 404
- Security agents flagged: without mounting, middleware chain (authenticate, requireCreator, validate) is bypassed if routes are accessed another way
- Flagged by: security-sentinel, architecture-strategist

## Proposed Solutions

### Option 1: Mount v2Router in app.ts (Recommended)

**Approach:** Add `import { v2Router } from './routes/v2'` and `app.use('/api/v2', v2Router)` to app.ts after existing v1 route mounting.
**Pros:** Simple one-line fix, follows existing pattern for v1 routes
**Cons:** None
**Effort:** 15 minutes
**Risk:** Low

## Technical Details

**Affected files:**

- `packages/backend/src/app.ts` — add v2Router import and mount
- `packages/backend/src/routes/v2/index.ts` — already exports v2Router

## Acceptance Criteria

- [ ] v2Router is imported in app.ts
- [ ] `app.use('/api/v2', v2Router)` is present
- [ ] All 24 endpoints respond (not 404)
- [ ] Middleware chain (authenticate, requireCreator, validate) is applied

## Resources

- **PR:** #82
- **Agents:** security-sentinel, architecture-strategist

## Work Log

### 2026-02-14 - Discovery

**By:** Claude Code Review (8-agent synthesis)
**Actions:** Identified v2 routes not mounted during security and architecture review of PR #82
