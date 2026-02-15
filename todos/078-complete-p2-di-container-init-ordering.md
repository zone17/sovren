---
status: pending
priority: p2
issue_id: 078
tags: [code-review, architecture, reliability]
dependencies: []
---

# DI Container Initialization Ordering Issue

## Problem Statement

`initializeContainer()` from `packages/backend/src/container/index.ts` is not called in the server startup path. Express middleware and routes may attempt to resolve services before the container is initialized, causing undefined or incomplete dependency injection.

## Findings

- **Architecture Strategist P1-003**: Container not initialized before Express app serves requests.

## Proposed Solutions

### Option A: Call initializeContainer() in server startup (Recommended)

Add `await initializeContainer()` to the server startup sequence before registering routes.
**Pros:** Ensures DI is ready before any request handling
**Cons:** None
**Effort:** Small | **Risk:** Low

## Acceptance Criteria

- [ ] `initializeContainer()` called before routes are registered
- [ ] Server startup fails fast if container init fails
- [ ] All service resolutions work correctly
