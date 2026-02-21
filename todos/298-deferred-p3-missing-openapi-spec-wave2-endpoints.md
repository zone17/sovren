---
status: deferred
priority: p3
issue_id: '298'
tags: [code-review, documentation, agent-native]
dependencies: []
---

# Missing OpenAPI Spec for Wave 2 Endpoints

## Problem Statement

Wave 2 adds 30+ new API endpoints but no OpenAPI/Swagger specification. External agents and integrations cannot discover or validate API contracts programmatically.

## Findings

- No `openapi.yaml` or equivalent for Wave 2 routes
- Existing endpoints may have partial specs

## Proposed Solutions

### Option 1: Generate OpenAPI spec from route definitions

**Approach:** Add JSDoc/swagger annotations to route handlers and generate spec with swagger-jsdoc.
**Effort:** 4-6h **Risk:** Low

## Acceptance Criteria

- [ ] OpenAPI spec covers all Wave 2 endpoints
- [ ] Spec validates against OpenAPI 3.0
- [ ] Available at /api-docs endpoint

## Work Log

### 2026-02-18 - Code Review Discovery

**By:** Claude Code (13-agent parallel review)
