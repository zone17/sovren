# Todo 220: Metrics Health Endpoint Leaks process.pid

- **Priority**: P2
- **Category**: Security / Information Disclosure
- **Status**: Pending
- **Found by**: Security review of commit d928918

## Problem

The `/api/v1/metrics/health` endpoint returns `process.pid` in the JSON response:

```typescript
// packages/backend/src/routes/v1/metrics.routes.ts:82
process: {
  pid: process.pid,
  nodeVersion: process.version,
},
```

While the endpoint requires authentication (`authenticate` middleware), the PID is an implementation detail that aids OS-level reconnaissance:

- On Linux, `/proc/{pid}/` exposes process environment, memory maps, file descriptors
- PID knowledge enables targeted signal-based attacks (SIGKILL, SIGTERM)
- Security scanners flag PID exposure as CWE-200 (Information Exposure) and OWASP A01:2021

The `nodeVersion` is borderline but less actionable since Node.js versions are easily inferred from headers. The PID, however, is specific to the running process instance.

## Fix

Remove `pid` from the health response. Keep `nodeVersion` for debugging utility.

```typescript
process: {
  nodeVersion: process.version,
},
```

## Files

- `packages/backend/src/routes/v1/metrics.routes.ts:80-83`

## Risk Assessment

- **Likelihood**: Low (requires valid JWT to access)
- **Impact**: Low-Medium (aids lateral movement if server is already partially compromised)
- **Overall**: P2 -- should fix but not blocking
