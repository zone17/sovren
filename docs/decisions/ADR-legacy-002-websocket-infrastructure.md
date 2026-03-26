# ADR-002: WebSocket Infrastructure - Express-integrated ws with Redis Pub/Sub

**Status:** Proposed
**Date:** 2026-02-11
**Decision Makers:** Architecture Team
**Relates To:** FR-003 (Real-time WebSocket Infrastructure)

## Context

Sovren needs real-time event delivery for:

- Payment confirmation notifications (supporter sees payment settled within 3 seconds)
- New content notifications (subscriber notified within 5 seconds of publish)
- Subscription status updates (access granted immediately on payment)
- Relay health monitoring (admin dashboard)

Requirements from FR-003:

- < 500ms p95 latency with 1,000+ concurrent connections
- Missed event delivery on reconnect
- Horizontal scaling support

### Options Evaluated

| Criteria              | ws + Express (HTTP Upgrade) | Socket.IO                        | Standalone WS Server   | Supabase Realtime                    |
| --------------------- | --------------------------- | -------------------------------- | ---------------------- | ------------------------------------ |
| Protocol overhead     | Minimal (raw WS)            | Higher (polling fallback, rooms) | Minimal                | Supabase-managed                     |
| Horizontal scaling    | Redis pub/sub (manual)      | Redis adapter (built-in)         | Redis pub/sub (manual) | Built-in                             |
| Reconnection handling | Manual                      | Automatic                        | Manual                 | Automatic                            |
| Bundle size impact    | None (backend only)         | ~60KB client                     | None                   | Supabase SDK already included        |
| Auth integration      | Share JWT from Express      | Share JWT from Express           | Separate auth flow     | Supabase auth (different from NOSTR) |
| Existing codebase fit | Express already used        | New dependency                   | New deployment unit    | supabase-realtime-service.ts exists  |
| Binary support        | Yes                         | Yes                              | Yes                    | Limited                              |
| Complexity            | Low-Medium                  | Low                              | Medium-High            | Low                                  |

## Decision

**Use the `ws` library integrated with the existing Express HTTP server, with Redis pub/sub for horizontal scaling.**

Specifically:

1. **ws** library handles WebSocket connections via HTTP Upgrade on the existing Express server (no separate port or process)
2. **Redis pub/sub** broadcasts events across multiple backend instances for horizontal scaling
3. **JWT authentication** on the WebSocket handshake reuses the existing `authenticate` middleware logic
4. **EventBus integration**: Backend EventBus events (payment.confirmed, content.published, subscription.activated) are bridged to WebSocket channels
5. **Missed event buffer**: Redis Streams (or a short-lived list) stores recent events per user for delivery on reconnect

## Rationale

### Why Not Socket.IO

Socket.IO adds unnecessary complexity for our use case:

- We do not need HTTP long-polling fallback (all target browsers support WebSocket natively)
- The rooms/namespaces abstraction adds overhead we can handle with simple topic subscriptions
- The ~60KB client bundle is unnecessary weight for a PWA targeting mobile networks
- The built-in Redis adapter is convenient but locks us into Socket.IO's event format

### Why Not a Standalone WS Server

A separate WebSocket server would:

- Require a second deployment unit (more Docker containers, more operational complexity)
- Need its own authentication flow (cannot share Express middleware directly)
- Complicate the modular monolith architecture (adding a network boundary where none is needed)
- Violate the current architecture principle of a single deployable backend unit

### Why Not Supabase Realtime

Supabase Realtime is already partially integrated (`supabase-realtime-service.ts` exists in both backend and frontend) but:

- It uses Supabase auth, not our NOSTR JWT auth -- would require an auth bridge
- It operates on database row changes, not application-level events (payment.confirmed is not a row change, it is a multi-step workflow)
- It adds a dependency on Supabase's realtime infrastructure for core functionality
- However, it **should continue to be used** for database-level change subscriptions (e.g., profile updates) where it is already integrated

### Why ws + Express Fits

- **Zero new deployment units**: WebSocket connections upgrade from the same HTTP server, sharing port 3001
- **Auth reuse**: JWT validation logic from `middleware/auth.ts` is directly reusable on the WS handshake
- **EventBus bridge**: The existing in-memory EventBus can emit to WebSocket channels with a simple subscriber
- **Redis pub/sub for scaling**: When running multiple API containers behind Nginx, Redis pub/sub ensures all instances receive events
- **Lightweight**: `ws` is the most mature, lowest-overhead WebSocket library for Node.js

## Implementation Sketch

```
Express Server (port 3001)
  |
  |-- HTTP routes (/api/v1/*)
  |-- WS upgrade (/ws)
       |
       |-- JWT auth on upgrade handshake
       |-- Subscribe to topics: "user:{userId}", "content:{creatorId}", "payment:{paymentHash}"
       |
       |-- EventBus.on("payment.confirmed") --> Redis PUBLISH --> All WS servers
       |-- EventBus.on("content.published") --> Redis PUBLISH --> All WS servers
       |-- Redis SUBSCRIBE --> Deliver to connected clients
       |
       |-- On reconnect: Deliver missed events from Redis Stream buffer (last 5 minutes)
```

## Consequences

### Positive

- No new deployment units, ports, or infrastructure components
- Shares authentication with the REST API
- `ws` is battle-tested (used by Next.js, webpack-dev-server, and many production systems)
- Redis pub/sub is already planned for cache layer scaling
- Simple bridging from EventBus to WebSocket channels

### Negative

- Manual reconnection handling on the client (must implement exponential backoff)
- Manual missed-event delivery (Redis Streams buffer adds some complexity)
- `ws` does not provide rooms/namespaces out of the box (implement with topic-based Map)

### Neutral

- Supabase Realtime continues to be used for database-level subscriptions alongside this WebSocket infrastructure
- Client-side code needs a small WebSocket manager (can be added to the existing `services/` directory in the frontend)

## References

- [ws library documentation](https://github.com/websockets/ws)
- [Redis Pub/Sub documentation](https://redis.io/docs/manual/pubsub/)
- FR-003 requirements in `/docs/requirements.md`
