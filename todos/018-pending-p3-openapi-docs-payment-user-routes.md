---
status: pending
priority: p3
issue_id: 018
tags: [code-review, agent-native]
dependencies: []
---

# OpenAPI Docs for Payment and User Routes

## Problem Statement

Content routes have detailed OpenAPI JSDoc blocks but payment and user routes lack them. No machine-readable API documentation (OpenAPI/Swagger) exists.

## Findings

Architecture-strategist found inconsistent documentation. Agent-native reviewer flagged missing OpenAPI spec as barrier to agent consumption. ADR-011 exists for OpenAPI documentation but payment/user routes don't follow it.

## Proposed Solutions

### Option A: Add OpenAPI annotations and generate swagger.json

**Effort:** Medium
**Risk:** Low

Add OpenAPI JSDoc annotations to payment and user routes matching content route pattern. Generate swagger.json.

## Technical Details

**Affected Files:** packages/backend/src/routes/v1/payment.routes.ts, packages/backend/src/routes/v1/user.routes.ts

## Acceptance Criteria

- [ ] All v1 route files have OpenAPI annotations
- [ ] Generated swagger.json validates
- [ ] Swagger UI accessible at /api-docs

## Work Log

- 2026-02-11: Created from /workflows:review multi-agent code review
