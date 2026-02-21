---
status: complete
priority: p1
issue_id: '265'
tags: [code-review, agent-native, bug]
dependencies: []
---

# Missing Template UPDATE/DELETE Backend Routes

## Problem Statement

Frontend TemplateManager calls PUT/DELETE /api/v2/inbox/templates/:id but these routes don't exist. Edit/Delete buttons produce 404s at runtime.

## Findings

- `packages/backend/src/routes/v2/inbox.routes.ts` — only GET and POST for templates
- `packages/frontend/src/features/multi-platform/services/inboxApi.ts:50-56` — calls PUT and DELETE

## Proposed Solutions

### Option 1: Add PUT and DELETE routes

**Approach:** Add routes to inbox.routes.ts with authenticate, requireCreator, mutationRateLimiter.
**Effort:** 1-2h **Risk:** Low

## Acceptance Criteria

- [ ] PUT /api/v2/inbox/templates/:id works
- [ ] DELETE /api/v2/inbox/templates/:id works
- [ ] Service methods exist for update and delete

## Work Log

### 2026-02-18 - Code Review Discovery

**By:** Claude Code (13-agent parallel review)
