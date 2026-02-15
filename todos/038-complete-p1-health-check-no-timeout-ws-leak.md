---
status: pending
priority: p1
issue_id: '038'
tags: [code-review, security, reliability, health-check]
dependencies: []
---

# Health Check No Timeout and WebSocket Leak

## Problem Statement

Two critical issues in the health check endpoint:

1. Database health check has no timeout - a hung Supabase connection blocks the readiness probe indefinitely, causing Kubernetes cascading restart loops
2. Nostr WebSocket health check leaks connections - missing `ws.close()` in error handler

## Findings

**Location**: `/Users/fp/Desktop/Sovren/packages/backend/src/routes/health.ts:183-219` (DB check), Nostr WebSocket check (WS leak)

**Found by**: Performance Oracle, Data Integrity Guardian

**Issue 1 - Database Timeout**:
The database health check runs `SELECT 1` without a timeout wrapper. If Supabase enters a hung state (network partition, connection pool exhaustion, regional outage), the query blocks indefinitely:

- Kubernetes readiness probe times out (default 1s)
- Pod marked unhealthy, removed from service
- New requests routed to remaining pods
- They hit the same DB issue, cascade failure

**Issue 2 - WebSocket Leak**:
The Nostr relay health check creates WebSocket connections but fails to close them in error handlers:

```typescript
ws.on('error', (error) => {
  // No ws.close() here - connection leaks
  resolve({ status: 'error', message: error.message });
});
```

Over time, leaked sockets exhaust file descriptors and memory.

**Current code pattern**:

```typescript
// No timeout protection
const result = await supabase.from('_health').select('1').single();

// No cleanup on error
ws.on('error', (error) => {
  resolve({ status: 'error', message: error.message });
});
```

## Proposed Solutions

### Option 1: Promise.race with Timeout + allSettled (Recommended)

Wrap DB query with `Promise.race` and 5s timeout. Add `ws.close()` to all error handlers. Run all checks with `Promise.allSettled` instead of sequential execution.

**Pros**:

- Prevents indefinite blocking
- Fast-fail behavior for orchestration systems
- Parallel checks reduce total latency
- Resource cleanup guaranteed

**Cons**:

- Query may still run in background after timeout (Postgres limitation)
- Slightly more complex control flow

**Implementation**:

```typescript
const dbCheck = Promise.race([
  supabase.from('_health').select('1').single(),
  new Promise((_, reject) => setTimeout(() => reject(new Error('DB health check timeout')), 5000)),
]);

ws.on('error', (error) => {
  ws.close();
  resolve({ status: 'error', message: error.message });
});

const checks = await Promise.allSettled([dbCheck, redisCheck, nostrCheck]);
```

### Option 2: Supabase Client-Level Timeout

Configure timeout at the Supabase client level.

**Pros**:

- Applies to all queries
- Centralized configuration

**Cons**:

- Affects application queries, not just health checks
- May not be granular enough
- Doesn't solve WebSocket leak

### Option 3: AbortController Pattern

Use AbortController for query cancellation.

**Pros**:

- True cancellation (not just timeout)
- Modern pattern

**Cons**:

- Requires Supabase client support for AbortSignal
- More complex implementation
- Still doesn't solve WebSocket leak

## Technical Details

**Root cause 1 - DB Timeout**:

- No timeout boundary around I/O operations
- Kubernetes readiness probe has 1s default timeout
- Application health check has infinite timeout
- Mismatch creates cascading failures

**Root cause 2 - WS Leak**:

- Error handlers resolve promise without cleanup
- WebSocket remains in CLOSING or CLOSED state but not released
- File descriptors and memory accumulate

**Impact**:

- DB timeout: Production outages during DB degradation events
- WS leak: Gradual resource exhaustion, requires pod restart
- Both issues compound under load

**Kubernetes behavior**:

1. Readiness probe fails (timeout)
2. Pod removed from endpoints
3. Traffic shifts to other pods
4. They fail the same way
5. All pods marked unhealthy
6. Service becomes unavailable

## Acceptance Criteria

- [ ] Database health check has 5 second timeout
- [ ] Timeout returns specific error (not generic failure)
- [ ] All WebSocket connections closed in both success and error paths
- [ ] Health checks run in parallel via `Promise.allSettled`
- [ ] Individual check failures don't block other checks
- [ ] Overall health check completes in <6 seconds worst case
- [ ] Load test confirms no file descriptor leaks
- [ ] Integration test simulates hung DB connection

## Work Log

_No work logged yet_

## Resources

- Kubernetes health check best practices: https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/
- WebSocket cleanup patterns: https://developer.mozilla.org/en-US/docs/Web/API/WebSocket
- Promise timeout patterns: https://advancedweb.hu/how-to-add-timeout-to-a-promise-in-javascript/
- Related file: `/Users/fp/Desktop/Sovren/packages/backend/src/routes/health.ts`
