---
status: deferred
priority: p3
issue_id: '297'
tags: [code-review, agent-native, api]
dependencies: []
---

# Missing CRUD Endpoints for Circles and Mentorship

## Problem Statement

Circle and Mentorship routes only expose create/list/join operations. Missing: update circle settings, leave circle, cancel mentorship, update mentorship status. Agents cannot perform these actions.

## Findings

- `packages/backend/src/routes/v2/circle.routes.ts` — only POST /create, GET /, POST /:id/join
- `packages/backend/src/routes/v2/mentorship.routes.ts` — only POST /request, GET /

## Proposed Solutions

### Option 1: Add missing CRUD routes

**Approach:** Add PUT/DELETE endpoints for circles (update/leave) and mentorship (cancel/update status).
**Effort:** 2-3h **Risk:** Low

## Acceptance Criteria

- [ ] Circle update and leave endpoints exist
- [ ] Mentorship cancel and status update endpoints exist
- [ ] All endpoints have auth middleware

## Work Log

### 2026-02-18 - Code Review Discovery

**By:** Claude Code (13-agent parallel review)
