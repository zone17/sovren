---
status: complete
priority: p1
issue_id: '266'
tags: [code-review, agent-native]
dependencies: []
---

# Missing Collaboration Respond Endpoint

## Problem Statement

ICollaborativeContentService defines respondToInvitation() but no route exposes it. Creator B cannot accept/decline collaboration invitations.

## Findings

- `packages/backend/src/routes/v2/collaboration.routes.ts` — only 3 routes, no respond
- `packages/backend/src/interfaces/community/ICollaborativeContentService.ts:13` — method exists in interface

## Proposed Solutions

### Option 1: Add respond route

**Approach:** Add PUT /api/v2/content/collaborations/:id/respond with { accept: boolean } body.
**Effort:** 30min **Risk:** Low

## Acceptance Criteria

- [ ] Endpoint exists and calls respondToInvitation
- [ ] Auth middleware applied
- [ ] Accepts boolean accept field

## Work Log

### 2026-02-18 - Code Review Discovery

**By:** Claude Code (13-agent parallel review)
