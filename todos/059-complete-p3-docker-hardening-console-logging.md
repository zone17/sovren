---
status: pending
priority: p3
issue_id: '059'
tags: [code-review, docker, security, observability]
dependencies: []
---

# Docker Hardening and Console Logging Issues

## Problem Statement

Multiple issues exist in Docker configuration and logging practices:

1. **Docker ICC Enabled**: Inter-Container Communication enabled (`com.docker.network.bridge.enable_icc: 'true'`) allows any container to reach any other container, bypassing network policies

2. **Redis Password Exposure**: Health check passes password via `-a` CLI argument, which is visible in process lists (`ps aux`)

3. **Console Logging in Production**: `deployment-monitoring.ts` uses `console.error`/`console.log` at 7 locations instead of structured logger, bypassing correlation ID and sanitization

4. **Unused Parameter Naming**: `next` parameter in error handler should be `_next` to indicate it's intentionally unused

5. **Emojis in Production Output**: Production console output includes emojis, reducing machine-readability

## Findings

**Locations**:

- `docker/security/docker-compose.secure.yml:323-324` (ICC enabled)
- `docker/security/docker-compose.secure.yml:248` (Redis password in CLI)
- `middleware/deployment-monitoring.ts:213,225-226,234,247,253,274` (console logging)
- `middleware/error-handler-middleware.ts:112,338,346` (console logging, unused param, emojis)

**Impact**:

**Security**:

- ICC enabled increases attack surface (lateral movement between containers)
- Redis password visible in process list during health checks

**Observability**:

- Console logging bypasses structured logging infrastructure
- Missing correlation IDs on deployment monitoring logs
- No log sanitization (potential PII leakage)
- Emojis break log parsing in SIEM/aggregation tools

## Proposed Solutions

### 1. Disable Docker ICC

**Change**: `docker/security/docker-compose.secure.yml:323-324`

```yaml
# Before
com.docker.network.bridge.enable_icc: 'true'

# After
com.docker.network.bridge.enable_icc: 'false'
```

**Test**: Verify explicit service-to-service communication still works (e.g., backend → redis, backend → postgres)

### 2. Secure Redis Health Check

**Change**: `docker/security/docker-compose.secure.yml:248`

```yaml
# Before
healthcheck:
  test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]

# After
healthcheck:
  test: |
    sh -c 'redis-cli -a "$REDIS_PASSWORD" ping'
```

Or use `REDISCLI_AUTH` environment variable:

```yaml
healthcheck:
  test: ['CMD-SHELL', 'redis-cli ping']
environment:
  REDISCLI_AUTH: '${REDIS_PASSWORD}'
```

### 3. Replace Console Logging with Structured Logger

**Change**: `middleware/deployment-monitoring.ts`

```typescript
// Before
console.error('Deployment monitoring error:', error);
console.log('Health check:', status);

// After
import { logger } from '../lib/logger';

logger.error('Deployment monitoring error', {
  error,
  correlationId: getCorrelationId(req),
});
logger.info('Health check', {
  status,
  correlationId: getCorrelationId(req),
});
```

Apply to all 7 console.\* locations in deployment-monitoring.ts.

### 4. Fix Unused Parameter and Remove Emojis

**Change**: `middleware/error-handler-middleware.ts`

```typescript
// Before
export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('⚠️ Error occurred:', err);

// After
export const errorHandler = (err: Error, req: Request, res: Response, _next: NextFunction) => {
  logger.error('Error occurred', { err, correlationId: getCorrelationId(req) });
```

Remove all emojis from production logging (lines 112, 338, 346).

## Technical Details

**Files Affected**:

- `docker/security/docker-compose.secure.yml`
- `middleware/deployment-monitoring.ts`
- `middleware/error-handler-middleware.ts`

**Dependencies**:

- Structured logger must be available (already exists at `lib/logger.ts`)
- `getCorrelationId` utility must be available

**Testing Required**:

- Docker ICC disabled: Verify backend can still reach redis/postgres
- Redis health check: Verify no password in `docker exec <container> ps aux`
- Structured logging: Verify logs appear in aggregation system with correlation IDs
- Error handling: Verify errors still propagate correctly

**Complexity**: Low (configuration + refactoring)

## Acceptance Criteria

- [ ] Docker ICC disabled in docker-compose.secure.yml
- [ ] Redis health check does not expose password in process list
- [ ] All `console.error`/`console.log` in deployment-monitoring.ts replaced with logger
- [ ] All logger calls include correlation ID
- [ ] Unused `next` parameter renamed to `_next`
- [ ] No emojis in production logging statements
- [ ] ESLint warnings resolved
- [ ] Docker health checks pass
- [ ] All tests pass
- [ ] Logs appear correctly in aggregation system

## Work Log

_No work logged yet_

## Resources

- PR #73: Post-Remediation Review
- Docker ICC documentation: https://docs.docker.com/network/drivers/bridge/#configure-the-default-bridge-network
- Redis CLI auth: https://redis.io/docs/ui/cli/
- Winston logger: https://github.com/winstonjs/winston
