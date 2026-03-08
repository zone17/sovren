---
status: pending
priority: p2
issue_id: 773
tags: [code-review, architecture, error-handling, observability]
dependencies: []
---

# Inconsistent Error Handling — Legacy vs Modern Patterns

## Problem Statement

Two patterns coexist: modern `asyncHandler + next(error)` and legacy inline `try/catch + console.error`. Auth, user, and payment route errors using legacy pattern are invisible to Sentry. Multiple routes use console.error with full error objects (40+ instances).

## Findings

- **Architecture Agent**: P1-03 — auth.ts, users.ts use Pattern B (legacy)
- **Security Agent**: P2-06 — 40+ console.error instances across routes
- **Agent-Native Agent**: P2 — auth routes bypass global error handler

### Affected Routes

- auth.ts: lines 48, 112, 198, 249, 274
- users.ts: lines 117, 155, 220, 275, 310, 371, 405
- ai-recommendations.ts: 9 instances
- unified-sessions.ts: 12 instances

## Proposed Solutions

Replace all inline try/catch with `asyncHandler` + `next(error)`. Replace console.error with structured logger.

## Acceptance Criteria

- [ ] All route handlers use asyncHandler pattern
- [ ] Zero console.error in route files
- [ ] All errors visible in Sentry/structured logs
