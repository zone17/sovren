---
status: pending
priority: p3
issue_id: '720'
tags: [code-review, backend, agent-native, feature-gap, slice-8]
dependencies: []
---

# Missing circle update/delete/members endpoints

## Problem Statement

The circles routes only have create, list, and join endpoints. There is no PATCH endpoint to update circle details, no DELETE endpoint to remove a circle, and no endpoint to list circle members. This means agents and the UI cannot manage circles after creation.

**Agent consensus: 1/9** (Agent-Native)

## Fix

In `packages/backend/src/routes/v2/circles.routes.ts`, add three new endpoints:

1. `PATCH /circles/:id` — Update circle name, description, niche, or max members (owner only)
2. `DELETE /circles/:id` — Delete a circle (owner only, cascade memberships)
3. `GET /circles/:id/members` — List circle members with pagination

Each endpoint needs proper auth middleware, ownership validation, and input sanitization.
