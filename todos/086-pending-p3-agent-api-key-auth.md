---
status: pending
priority: p3
issue_id: 086
tags: [code-review, agent-native, feature]
dependencies: []
---

# No API Key / Service Token Authentication for Agents

## Problem Statement

The platform has no API key or service token authentication mechanism. All auth requires JWT via NOSTR signature. Agents and automated systems cannot authenticate without simulating human-like NOSTR key signing flows.

## Findings

- **Agent-Native P1-1**: No programmatic auth for agents.
- **Agent-Native P1-2**: Rate limiting is IP-based, not per-key (no key exists).
- **Agent-Native P1-3**: No webhook subscription API for event-driven agent workflows.

## Proposed Solutions

### Option A: Add API key authentication alongside NOSTR JWT

Create an API key table, issue keys per user, accept `X-API-Key` header alongside `Authorization: Bearer`.
**Effort:** Large | **Risk:** Low

### Option B: Add to roadmap as separate feature

Track as a feature request for the agent-native platform milestone.
**Effort:** None now | **Risk:** Low

## Acceptance Criteria

- [ ] Decision made: implement now or defer to roadmap
- [ ] If implementing: API key CRUD endpoints exist
- [ ] If implementing: Rate limiting supports per-key limits
