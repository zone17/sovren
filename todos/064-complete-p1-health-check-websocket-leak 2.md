---
status: pending
priority: p1
issue_id: 064
tags: [code-review, performance, resource-leak]
dependencies: []
---

# Health Check WebSocket Leak

## Problem Statement

The NOSTR health check in `packages/backend/src/routes/health.ts` creates a new WebSocket connection on every probe invocation and never closes it. With health probes running every 10-30 seconds, this leaks WebSocket connections continuously, eventually exhausting file descriptors or memory.

## Findings

- **Performance Oracle P1-004**: New WS created per health probe, never closed. At 10s intervals = 8,640 leaked connections/day.
- **Architecture Strategist P3**: Health probes should be lightweight, not open new connections.

## Proposed Solutions

### Option A: Close WebSocket after probe (Recommended)

Add `ws.close()` in a finally block or after the check completes/times out.
**Pros:** Minimal change, fixes the leak immediately
**Cons:** Still opens a connection per probe (slow)
**Effort:** Small
**Risk:** Low

### Option B: Cache a persistent WS connection for health checks

Maintain a single WS connection for health probes, reconnect only on failure.
**Pros:** Faster health checks, no connection churn
**Cons:** More complex lifecycle management
**Effort:** Medium
**Risk:** Low

## Technical Details

- **Affected files:** `packages/backend/src/routes/health.ts`
- **Components:** NOSTR health check endpoint
- **Runtime impact:** File descriptor / connection leak in production

## Acceptance Criteria

- [ ] WebSocket connections are properly closed after each health probe
- [ ] No connection leak under repeated health check calls
- [ ] Health check still accurately reports NOSTR relay status

## Work Log

| Date       | Action                          | Learnings                        |
| ---------- | ------------------------------- | -------------------------------- |
| 2026-02-13 | Created from full PR #73 review | Performance Oracle flagged as P1 |

## Resources

- PR #73 full review
- Performance Oracle agent report
