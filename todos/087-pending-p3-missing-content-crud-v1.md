---
status: pending
priority: p3
issue_id: 087
tags: [code-review, agent-native, api]
dependencies: []
---

# Missing Content Listing and CRUD in v1 API

## Problem Statement

The v1 API routes lack content listing, content-by-ID retrieval, content deletion, and user registration endpoints. Agents cannot discover or manage content programmatically.

## Findings

- **Agent-Native P1-4**: No content listing or content-by-ID in v1 API.
- **Agent-Native P3-11/12**: No content delete or user registration endpoints.
- Overlaps with existing todo 012 (missing v1 API endpoints).

## Proposed Solutions

Add RESTful content CRUD endpoints to v1 API. See todo 012 for details.
**Effort:** Medium | **Risk:** Low

## Acceptance Criteria

- [ ] GET /api/v1/content (list with pagination)
- [ ] GET /api/v1/content/:id (single content)
- [ ] DELETE /api/v1/content/:id (owner-only)
