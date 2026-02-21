---
status: complete
priority: p2
issue_id: '270'
tags: [code-review, security, validation]
dependencies: []
---

# Missing Input Validation on EPIC-010 Routes

## Problem Statement

EPIC-010 (Creator Network) routes use inline typeof/truthiness checks instead of Zod schemas. EPIC-011 has proper Zod validators in finance.ts but EPIC-010 has none, creating inconsistent security posture.

## Findings

- `packages/backend/src/routes/v2/circle.routes.ts` — inline `if (!req.body.name)` checks
- `packages/backend/src/routes/v2/mentorship.routes.ts` — same pattern
- `packages/backend/src/routes/v2/collaboration.routes.ts` — same pattern
- `packages/backend/src/routes/v2/marketplace.routes.ts` — same pattern
- `packages/backend/src/validators/finance.ts` — proper Zod pattern exists for EPIC-011

## Proposed Solutions

### Option 1: Add Zod schemas for EPIC-010

**Approach:** Create `validators/community.ts` with Zod schemas for all EPIC-010 endpoints, matching the finance.ts pattern.
**Effort:** 2-3h **Risk:** Low

## Acceptance Criteria

- [ ] Zod schemas exist for all EPIC-010 route inputs
- [ ] Routes use validateRequest middleware
- [ ] Error responses match EPIC-011 format

## Work Log

### 2026-02-18 - Code Review Discovery

**By:** Claude Code (13-agent parallel review)
