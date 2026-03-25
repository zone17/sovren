---
status: pending
priority: p3
issue_id: 782
tags: [code-review, agent-native, sse, websocket]
dependencies: []
---

# No Event Streaming (SSE/WebSocket) for API Consumers

## Problem Statement

No real-time event streaming mechanism exists. Agents must poll for all state changes. No WebSocket or SSE endpoint exposed to API consumers.

## Findings

- **Agent-Native Agent**: P1 (scored 1/10 for event streaming)

## Proposed Solutions

Add SSE endpoint at /api/v2/events/stream with auth and event type filtering. SSE is simpler than WebSocket for server-to-client events.

## Acceptance Criteria

- [ ] SSE endpoint available for authenticated consumers
- [ ] Supports event type filtering
