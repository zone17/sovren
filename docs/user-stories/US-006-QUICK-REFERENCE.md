# US-006: Database Connection Pooling - Quick Reference

**Status**: ✅ Production Ready
**Last Updated**: 2025-10-30

## Quick Start

### Import and Use

```typescript
import { getPool } from '@/database/pool';

const pool = getPool();

// Execute query
const users = await pool.query('SELECT * FROM users WHERE email = $1', ['user@example.com']);

// Execute transaction
const client = await pool.getClient();
try {
  await client.query('BEGIN');
  await client.query('UPDATE ...');
  await client.query('COMMIT');
} finally {
  client.release();
}
```

### Environment Variables

```bash
DATABASE_URL=postgresql://user:pass@host:5432/db
DB_POOL_MAX=20            # Optional, defaults based on NODE_ENV
DB_POOL_MIN=5             # Optional
DB_IDLE_TIMEOUT=30000     # Optional, ms
DB_CONNECTION_TIMEOUT=2000 # Optional, ms
DB_SSL=true               # Production
```

## Key Features

| Feature           | Description                                |
| ----------------- | ------------------------------------------ |
| Auto Pool Sizing  | Defaults: dev(10/2), test(5/1), prod(20/5) |
| Health Checks     | `/health/db` endpoint ready                |
| Metrics           | Real-time pool status tracking             |
| Leak Detection    | 30s threshold, auto-alert                  |
| Graceful Shutdown | 30s timeout, zero data loss                |
| SSL Support       | Production-ready security                  |

## Common Operations

### Check Pool Health

```typescript
const health = await pool.healthCheck();
// { healthy: true, latency: 12, poolMetrics: {...} }
```

### Get Pool Metrics

```typescript
const metrics = pool.getMetrics();
// { totalConnections, idleConnections, activeConnections, ... }
```

### Monitor Events

```typescript
pool.on('query', ({ sql, duration }) => console.log(`${duration}ms: ${sql}`));
pool.on('error', ({ error }) => console.error('Query failed:', error));
pool.on('potentialLeak', ({ message }) => alert(message));
```

## Performance Targets

- Simple queries: <1ms overhead
- 100+ concurrent: <5s total
- Connection acquisition: <100ms
- Zero leaks tested: 1000+ queries

## Files

| File                                  | Purpose             |
| ------------------------------------- | ------------------- |
| `src/database/pool.ts`                | Core implementation |
| `src/config/database-pool.config.ts`  | Configuration       |
| `src/database/__tests__/pool.test.ts` | Unit tests          |
| `docs/deployment/DATABASE_POOLING.md` | Full documentation  |

## Monitoring Queries

### Active Connections

```sql
SELECT pid, state, query_start, LEFT(query, 100)
FROM pg_stat_activity
WHERE datname = current_database()
ORDER BY query_start DESC;
```

### Long-Running (>30s)

```sql
SELECT pid, now() - query_start as duration, query
FROM pg_stat_activity
WHERE state = 'active'
  AND (now() - query_start) > interval '30 seconds';
```

### Connection Leaks

```sql
SELECT pid, state, now() - state_change as idle_duration
FROM pg_stat_activity
WHERE state = 'idle in transaction';
```

## Troubleshooting

| Issue            | Solution                             |
| ---------------- | ------------------------------------ |
| Pool saturated   | Increase `DB_POOL_MAX`               |
| Too many idle    | Decrease `DB_POOL_MIN`               |
| Connection leaks | Check for missing `client.release()` |
| Slow queries     | Add indexes, optimize SQL            |

## Architecture

```
Application → Pool (max: 20) → PostgreSQL
          ↓
    Metrics, Health, Events
```

**Dual Client Strategy**:

- Supabase: Auth, RLS, Realtime
- Pool: Direct SQL, Transactions, Bulk ops

## Resources

- **Full Docs**: `docs/deployment/DATABASE_POOLING.md`
- **Diagrams**: `docs/architecture/diagrams/us-006-*.mmd`
- **Implementation**: `US-006-DATABASE-POOLING-COMPLETE.md`

## Next Steps

1. Configure environment variables
2. Add health check to load balancer
3. Set up Grafana dashboards
4. Configure alerts (saturation, leaks, errors)
