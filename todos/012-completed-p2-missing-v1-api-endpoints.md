---
status: completed
priority: p2
issue_id: 012
tags: [code-review, agent-native]
dependencies: []
---

# Missing v1 API Endpoints for Agent-Native Support

## Problem Statement

Only 22 of 34 capabilities (65%) have v1 API equivalents. 12 UI-only capabilities with no mounted API. Missing: content CRUD (GET/:id, PUT/:id, DELETE/:id), subscription tier CRUD, content discovery feed.

## Findings

Agent-native-reviewer scored 65% agent-native. Missing endpoints: content individual get/update/delete, subscription tier management, content discovery feed, creator analytics API, notification preferences API, content moderation API.

## Proposed Solutions

### Option A: Add Missing v1 Endpoints Following Established Pattern

**Pros:** Complete API coverage for agent integration, consistent v1 route pattern, enables headless operation
**Cons:** Large effort to implement all missing endpoints
**Effort:** Large
**Risk:** Low

## Technical Details

**Affected Files:**

- packages/backend/src/routes/v1/content.routes.ts (missing GET/:id, PUT/:id, DELETE/:id)
- New files needed:
  - packages/backend/src/routes/v1/subscription-tiers.routes.ts
  - packages/backend/src/routes/v1/discovery.routes.ts
  - packages/backend/src/routes/v1/analytics.routes.ts
  - packages/backend/src/routes/v1/notifications.routes.ts
  - packages/backend/src/routes/v1/moderation.routes.ts

## Acceptance Criteria

- [ ] All 34 capabilities accessible via v1 API
- [ ] Content individual get/update/delete endpoints implemented
- [ ] Subscription tier CRUD endpoints implemented
- [ ] Content discovery feed endpoint implemented
- [ ] Creator analytics API endpoints implemented
- [ ] Notification preferences API endpoints implemented
- [ ] Content moderation API endpoints implemented
- [ ] OpenAPI documentation generated for each endpoint
- [ ] All endpoints follow DI + controller + validators pattern
- [ ] Tests achieve 80%+ coverage for new endpoints

## Work Log

- 2026-02-11: Created from /workflows:review multi-agent code review
