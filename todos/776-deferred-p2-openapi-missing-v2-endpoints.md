---
status: pending
priority: p2
issue_id: 776
tags: [code-review, agent-native, api, documentation]
dependencies: []
---

# OpenAPI Spec Missing 60+ v2 Endpoints

## Problem Statement

The OpenAPI spec at docs/api/openapi.yaml covers only 21 v1 paths. All v2 endpoints (discovery, comments, wellness, shield, platforms, distribute, inbox, follow, notifications, circles, mentorship, business) are missing. Agents using the spec see only ~30% of available capabilities.

## Findings

- **Agent-Native Agent**: P1 — ~60 routes missing from OpenAPI spec
- The /api root endpoint also omits v2 routes

## Proposed Solutions

1. Add @openapi JSDoc annotations to all v2 route files
2. Wire up swagger-jsdoc + swagger-ui-express to serve spec at /api/docs
3. Update /api root endpoint to list all v2 routes

## Acceptance Criteria

- [ ] All v2 endpoints documented in OpenAPI spec
- [ ] /api/docs serves interactive documentation
- [ ] /api root response lists all endpoints
