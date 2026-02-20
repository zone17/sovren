# Troubleshooting Guide

**Epic 005 Backend Service Refactoring - Common Issues and Solutions**

---

## Development Issues

### Database Connection Failed

**Symptoms**:

```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Solutions**:

```bash
# 1. Check PostgreSQL is running
pg_isready

# 2. Start PostgreSQL
brew services start postgresql@14  # macOS
sudo systemctl start postgresql    # Linux

# 3. Verify connection string
psql $DATABASE_URL

# 4. Check firewall/network
telnet localhost 5432
```

---

### Redis Connection Failed

**Symptoms**:

```
Error: connect ECONNREFUSED 127.0.0.1:6379
```

**Solutions**:

```bash
# 1. Check Redis is running
redis-cli ping

# 2. Start Redis
brew services start redis  # macOS
sudo systemctl start redis # Linux

# 3. Check configuration
redis-cli CONFIG GET bind
redis-cli CONFIG GET requirepass
```

---

### Port Already in Use

**Symptoms**:

```
Error: listen EADDRINUSE: address already in use :::3001
```

**Solutions**:

```bash
# Find process using port
lsof -i :3001
# Or
netstat -ano | grep 3001

# Kill process
kill -9 <PID>

# Or change port
PORT=3002 npm run dev
```

---

## Testing Issues

### Test Failures

**Symptoms**: Tests fail locally but pass in CI

**Solutions**:

```bash
# 1. Clear Vitest cache
npx vitest run --clearCache

# 2. Delete node_modules
rm -rf node_modules package-lock.json
npm install

# 3. Check Node version matches CI
node --version

# 4. Run with same config as CI
npm run test:ci
```

---

### Flaky Tests

**Symptoms**: Tests pass/fail inconsistently

**Solutions**:

```typescript
// ✅ GOOD: Proper async handling
it('should complete payment', async () => {
  const payment = await service.createPayment(data);
  await waitFor(() => expect(payment.status).toBe('completed'));
});

// ❌ BAD: Race condition
it('should complete payment', async () => {
  const payment = await service.createPayment(data);
  setTimeout(() => {
    expect(payment.status).toBe('completed'); // Flaky!
  }, 100);
});
```

---

### Low Test Coverage

**Symptoms**: Coverage below threshold

**Solutions**:

```bash
# 1. Generate coverage report
npm run test:coverage

# 2. Find uncovered lines
open coverage/lcov-report/index.html

# 3. Add tests for uncovered code
npm test -- --collectCoverageFrom='src/services/MyService.ts'
```

---

## Performance Issues

### Slow Queries

**Symptoms**: API responses take > 1s

**Solutions**:

```sql
-- 1. Analyze query
EXPLAIN ANALYZE SELECT * FROM payments WHERE user_id = 'abc';

-- 2. Check for missing indexes
SELECT schemaname, tablename, indexname
FROM pg_indexes
WHERE tablename = 'payments';

-- 3. Add index if needed
CREATE INDEX idx_payments_user_id ON payments(user_id);
```

---

### Memory Leaks

**Symptoms**: Memory usage grows over time

**Solutions**:

```bash
# 1. Profile with Node.js inspector
node --inspect dist/server.js

# 2. Take heap snapshots in Chrome DevTools
# 3. Look for growing arrays/objects

# Common causes:
# - Event listeners not removed
# - Caches without TTL
# - Global variables accumulating data
```

---

### High CPU Usage

**Symptoms**: CPU at 100% constantly

**Solutions**:

```bash
# 1. Profile with clinic.js
npx clinic doctor -- node dist/server.js

# 2. Check for infinite loops
# 3. Review regex patterns (can be slow)
# 4. Check for missing await on async functions
```

---

## Integration Issues

### Lightning Node Unreachable

**Symptoms**:

```
Error: 14 UNAVAILABLE: failed to connect to all addresses
```

**Solutions**:

```bash
# 1. Check LND is running
lncli getinfo

# 2. Verify TLS certificate
ls ~/.lnd/tls.cert

# 3. Check macaroon permissions
lncli bakemacaroon info

# 4. Test REST API
curl --insecure https://localhost:8080/v1/getinfo
```

---

### NOSTR Relay Connection Issues

**Symptoms**: Events not publishing

**Solutions**:

```typescript
// 1. Test relay connection
const testConnection = async () => {
  const relay = new Relay('wss://relay.damus.io');
  await relay.connect();
  console.log('Connected:', relay.url);
};

// 2. Use multiple relays for redundancy
const RELAYS = ['wss://relay.damus.io', 'wss://nostr.wine', 'wss://relay.nostr.band'];

// 3. Implement retry logic
const publishWithRetry = async (event, maxRetries = 3) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await relay.publish(event);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await delay(1000 * Math.pow(2, i));
    }
  }
};
```

---

## Production Issues

### High Error Rate

**Symptoms**: 500 errors spike in production

**Solutions**:

```bash
# 1. Check logs
kubectl logs -f deployment/backend --tail=100

# 2. Check Sentry for error patterns
# 3. Review recent deployments
kubectl rollout history deployment/backend

# 4. Rollback if needed
kubectl rollout undo deployment/backend
```

---

### Database Deadlocks

**Symptoms**:

```
ERROR: deadlock detected
```

**Solutions**:

```sql
-- 1. Check for long-running queries
SELECT pid, now() - pg_stat_activity.query_start AS duration, query
FROM pg_stat_activity
WHERE state != 'idle' AND now() - pg_stat_activity.query_start > interval '1 minute';

-- 2. Kill long-running query
SELECT pg_cancel_backend(pid);

-- 3. Prevent deadlocks:
-- - Always acquire locks in same order
-- - Use shorter transactions
-- - Add appropriate indexes
```

---

### Cache Coherency Issues

**Symptoms**: Stale data shown to users

**Solutions**:

```typescript
// 1. Implement cache invalidation
await this.cache.delete(`user:${userId}:profile`);

// 2. Use cache versioning
const version = (await this.cache.get('cache:version')) || 1;
const key = `user:${userId}:profile:v${version}`;

// 3. Set appropriate TTLs
await this.cache.set(key, data, 300); // 5 minutes

// 4. Use write-through caching
await this.repository.update(id, data);
await this.cache.set(key, data, ttl);
```

---

## TypeScript Issues

### Type Errors

**Symptoms**:

```
error TS2345: Argument of type 'X' is not assignable to parameter of type 'Y'
```

**Solutions**:

```bash
# 1. Check TypeScript version
npx tsc --version

# 2. Clean build artifacts
rm -rf dist/ *.tsbuildinfo

# 3. Rebuild
npm run build

# 4. Check tsconfig.json paths
```

---

### Import Errors

**Symptoms**:

```
Cannot find module '@/services/MyService'
```

**Solutions**:

```json
// tsconfig.json - verify paths
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["packages/backend/src/*"]
    }
  }
}
```

---

## Getting Help

### Escalation Path

1. **Level 1**: Check this troubleshooting guide
2. **Level 2**: Search existing GitHub issues
3. **Level 3**: Ask in team Slack #engineering
4. **Level 4**: Create detailed GitHub issue
5. **Level 5**: Escalate to tech lead

### Creating Good Issues

```markdown
**Environment**: Development / Staging / Production
**Node Version**: 18.16.0
**Package Version**: 2.0.0

**Description**:
Clear description of the problem

**Steps to Reproduce**:

1. Run command X
2. Observe error Y

**Expected Behavior**:
What should happen

**Actual Behavior**:
What actually happens

**Logs/Screenshots**:
Relevant error messages or screenshots

**Attempted Solutions**:
What you've already tried
```

---

**Last Updated**: 2025-10-27
**Epic**: Epic 005 - Backend Service Refactoring
**Story**: US-E5-039 - Developer Documentation
