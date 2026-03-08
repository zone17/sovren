---
status: pending
priority: p2
issue_id: 777
tags: [code-review, agent-native, authentication, api]
dependencies: []
---

# No API Key Authentication for Server-to-Server Integrations

## Problem Statement

Only auth mechanism is NOSTR signature challenge/response + JWT. No API key support despite being documented as "Coming Soon". Activity types API_KEY_CREATED/REVOKED exist but feature is unimplemented. Server-to-server and automated integrations must implement full NOSTR crypto flow.

## Findings

- **Agent-Native Agent**: P1 — docs/api/authentication.md lines 393-408
- Types reference exists at user-activity.ts lines 56-57

## Proposed Solutions

Implement X-API-Key header support in authenticate middleware with scope-based permissions. Add key generation/revocation endpoints.

## Acceptance Criteria

- [ ] API key auth supported via X-API-Key header
- [ ] Scoped permissions (read, write, admin)
- [ ] Key generation and revocation endpoints
