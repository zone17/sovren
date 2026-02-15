# Database Connection Pooling

**Status**: ✅ Production Ready
**Version**: 1.0.0
**Last Updated**: 2025-10-30

## Overview

Sovren implements production-grade PostgreSQL connection pooling using the `pg` Pool for direct database access alongside Supabase client operations. This dual-client architecture provides:

- **Fine-Grained Control**: Direct PostgreSQL access for advanced features (transactions, custom queries)
- **Performance**: Optimized pool sizing prevents connection exhaustion
- **Reliability**: Health checks, connection validation, automatic retry
- **Observability**: Comprehensive metrics and monitoring
- **Safety**: Graceful shutdown, connection leak detection

## Architecture

### Dual Client Strategy

```
┌─────────────────────────────────────────┐
│         Application Layer               │
├─────────────────────────────────────────┤
│                                         │
│  ┌──────────────┐    ┌──────────────┐  │
│  │   Supabase   │    │  PostgreSQL  │  │
│  │    Client    │    │     Pool     │  │
│  │              │    │              │  │
│  │ - Auth       │    │ - Direct SQL │  │
│  │ - Realtime   │    │ - Trans.     │  │
│  │ - RLS        │    │ - Advanced   │  │
│  └──────────────┘    └──────────────┘  │
│         │                    │          │
└─────────┼────────────────────┼──────────┘
          │                    │
          └────────┬───────────┘
                   │
         ┌─────────▼─────────┐
         │   PostgreSQL DB    │
         └────────────────────┘
```

**WHY**: Each client serves different purposes:
- **Supabase**: Row-level security, auth, realtime subscriptions
- **Pool**: Direct SQL, transactions, bulk operations, migrations

## Configuration

### Environment Variables

```bash
# Primary connection
DATABASE_URL=postgresql://user:password@host:5432/database

# Pool size (optional, has smart defaults)
DB_POOL_MAX=20              # Maximum connections
DB_POOL_MIN=5               # Minimum connections

# Timeouts (milliseconds)
DB_IDLE_TIMEOUT=30000       # Idle connection timeout
DB_CONNECTION_TIMEOUT=2000  # Connection acquisition timeout
DB_STATEMENT_TIMEOUT=30000  # Query execution timeout

# SSL (production)
DB_SSL=true                            # Enable SSL
DB_SSL_REJECT_UNAUTHORIZED=true        # Verify certificates
```

### Environment-Specific Defaults

| Setting | Development | Test | Production |
|---------|-------------|------|------------|
| max | 10 | 5 | 20 |
| min | 2 | 1 | 5 |
| idleTimeoutMillis | 10000 | 1000 | 30000 |
| connectionTimeoutMillis | 5000 | 2000 | 2000 |
| SSL | false | false | required |

## Usage

### Basic Query

```typescript
import { getPool } from '@/database/pool';

const pool = getPool();

// Simple query
const users = await pool.query(
  'SELECT * FROM users WHERE email = $1',
  ['user@example.com']
);
```

### Transactions

```typescript
const pool = getPool();
const client = await pool.getClient();

try {
  await client.query('BEGIN');

  // Transfer funds between accounts
  await client.query(
    'UPDATE accounts SET balance = balance - $1 WHERE id = $2',
    [100, fromAccountId]
  );

  await client.query(
    'UPDATE accounts SET balance = balance + $1 WHERE id = $2',
    [100, toAccountId]
  );

  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release(); // CRITICAL: Always release!
}
```

### Bulk Operations

```typescript
// Efficient bulk insert
const pool = getPool();
const client = await pool.getClient();

try {
  await client.query('BEGIN');

  const stmt = 'INSERT INTO posts (user_id, content) VALUES ($1, $2)';

  for (const post of posts) {
    await client.query(stmt, [post.userId, post.content]);
  }

  await client.query('COMMIT');
} finally {
  client.release();
}
```

### Health Checks

```typescript
// Kubernetes readiness probe
app.get('/health/db', async (req, res) => {
  const pool = getPool();
  const health = await pool.healthCheck();

  if (health.healthy) {
    res.status(200).json(health);
  } else {
    res.status(503).json(health);
  }
});
```

## Monitoring

### Pool Metrics

```typescript
import { getPool } from '@/database/pool';

const pool = getPool();
const metrics = pool.getMetrics();

console.log({
  totalConnections: metrics.totalConnections,
  idleConnections: metrics.idleConnections,
  activeConnections: metrics.activeConnections,
  waitingRequests: metrics.waitingRequests,
  averageQueryDuration: metrics.averageQueryDuration,
  totalQueries: metrics.totalQueries,
  errorRate: metrics.errorRate,
  connectionErrors: metrics.connectionErrorCount,
});
```

### Monitoring Queries

#### Active Connections

```sql
-- See all active database connections
SELECT
  pid,
  usename,
  application_name,
  client_addr,
  state,
  query_start,
  state_change,
  wait_event_type,
  wait_event,
  LEFT(query, 100) as query_preview
FROM pg_stat_activity
WHERE datname = current_database()
ORDER BY query_start DESC;
```

#### Connection Pool Status

```sql
-- Check connection counts by state
SELECT
  state,
  COUNT(*) as count,
  MAX(EXTRACT(EPOCH FROM (now() - query_start))) as max_duration_seconds
FROM pg_stat_activity
WHERE datname = current_database()
GROUP BY state;
```

#### Long-Running Queries

```sql
-- Find queries running longer than 30 seconds
SELECT
  pid,
  now() - query_start as duration,
  usename,
  query
FROM pg_stat_activity
WHERE state = 'active'
  AND datname = current_database()
  AND (now() - query_start) > interval '30 seconds'
ORDER BY duration DESC;
```

#### Blocked Queries

```sql
-- Find blocked queries (locks)
SELECT
  blocked_locks.pid AS blocked_pid,
  blocked_activity.usename AS blocked_user,
  blocking_locks.pid AS blocking_pid,
  blocking_activity.usename AS blocking_user,
  blocked_activity.query AS blocked_query,
  blocking_activity.query AS blocking_query
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks
  ON blocking_locks.locktype = blocked_locks.locktype
  AND blocking_locks.database IS NOT DISTINCT FROM blocked_locks.database
  AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
  AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
  AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
  AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
  AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
  AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
  AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
  AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
  AND blocking_locks.pid != blocked_locks.pid
JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.granted;
```

#### Connection Leak Detection

```sql
-- Find idle connections in transaction (potential leaks)
SELECT
  pid,
  usename,
  application_name,
  state,
  state_change,
  now() - state_change as idle_duration,
  query
FROM pg_stat_activity
WHERE state = 'idle in transaction'
  AND datname = current_database()
ORDER BY state_change;
```

### Event Monitoring

```typescript
import { getPool } from '@/database/pool';

const pool = getPool();

// Query performance
pool.on('query', ({ sql, duration, rows }) => {
  if (duration > 1000) {
    console.warn(`Slow query (${duration}ms):`, sql.substring(0, 100));
  }
});

// Connection errors
pool.on('connectionError', ({ error }) => {
  console.error('Database connection error:', error);
  // Alert monitoring system
});

// Potential leaks
pool.on('potentialLeak', ({ duration, message }) => {
  console.error('POTENTIAL CONNECTION LEAK:', message);
  // Alert on-call engineer
});

// Pool events
pool.on('connect', () => console.log('New connection created'));
pool.on('acquire', () => console.log('Connection acquired from pool'));
pool.on('remove', () => console.log('Connection removed from pool'));
```

## Performance Tuning

### Calculating Optimal Pool Size

**Formula**: `connections = ((core_count * 2) + effective_spindle_count)`

For typical web applications:
- **CPU-bound**: `core_count * 2`
- **I/O-bound**: `core_count * 4`

```typescript
import { calculateOptimalPoolSize } from '@/config/database-pool.config';

// For 4-core server with I/O-bound workload
const { max, min } = calculateOptimalPoolSize(4, 'io');
// max: 16, min: 4
```

### Pool Size Recommendations

| Server Size | Workload | Max | Min | Notes |
|-------------|----------|-----|-----|-------|
| 1 CPU | Mixed | 8 | 2 | Development/small apps |
| 2 CPU | I/O | 12 | 3 | Small production |
| 4 CPU | I/O | 20 | 5 | **Default** |
| 8 CPU | I/O | 35 | 8 | High traffic |
| 16 CPU | I/O | 65 | 16 | Enterprise scale |

### Common Issues and Solutions

#### 1. Pool Saturation (Waiting Requests)

**Symptom**: High `waitingRequests` in metrics

**Solutions**:
- Increase `max` pool size
- Optimize slow queries (add indexes)
- Implement query result caching
- Use read replicas for read-heavy workloads

#### 2. Too Many Idle Connections

**Symptom**: High `idleConnections`, low `activeConnections`

**Solutions**:
- Decrease `min` pool size
- Decrease `idleTimeoutMillis` to recycle faster
- Check if workload is bursty vs sustained

#### 3. Connection Leaks

**Symptom**: `potentialLeak` events, increasing `totalConnections`

**Solutions**:
- Always use `try/finally` when acquiring clients
- Set shorter `connectionTimeoutMillis` to detect faster
- Review code for missing `client.release()` calls

#### 4. High Query Latency

**Symptom**: High `averageQueryDuration`

**Solutions**:
- Add database indexes
- Use `EXPLAIN ANALYZE` to identify slow queries
- Consider query result caching
- Optimize query structure (avoid N+1)

## Graceful Shutdown

### Server Shutdown

```typescript
import { getPool } from '@/database/pool';

async function shutdownServer() {
  const pool = getPool();

  // Stop accepting new requests
  await server.close();

  // Drain database connections (30 second timeout)
  await pool.gracefulShutdown(30000);

  process.exit(0);
}

process.on('SIGTERM', shutdownServer);
process.on('SIGINT', shutdownServer);
```

### Kubernetes PreStop Hook

```yaml
lifecycle:
  preStop:
    exec:
      command: ["/bin/sh", "-c", "sleep 5"] # Allow time for graceful shutdown
```

## Security

### SSL Configuration

**Production**: Always use SSL with certificate verification

```typescript
const pool = createDatabasePool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: true,
    ca: fs.readFileSync('/path/to/ca-certificate.crt').toString(),
  },
});
```

### Connection String Security

**Never** commit connection strings to version control!

```bash
# ❌ WRONG
DATABASE_URL=postgresql://admin:password123@db.example.com/prod

# ✅ CORRECT - Use secrets manager
DATABASE_URL=$(aws secretsmanager get-secret-value --secret-id db/production --query SecretString --output text)
```

## Testing

### Unit Tests

```bash
npm test -- pool.test.ts
```

### Load Tests

Requires real PostgreSQL database:

```bash
export DATABASE_URL=postgresql://localhost/test
npm test -- pool-load.integration.test.ts
```

**Test Coverage**:
- ✅ 100+ concurrent queries
- ✅ Connection limits enforcement
- ✅ Query timeout handling
- ✅ Graceful shutdown under load
- ✅ Memory leak detection

## Troubleshooting

### Enable Debug Logging

```typescript
import { getPool } from '@/database/pool';

const pool = getPool();

pool.on('query', ({ sql, duration }) => {
  console.log(`[${duration}ms] ${sql}`);
});

pool.on('error', ({ sql, error }) => {
  console.error('Query error:', { sql, error });
});
```

### Check Pool Health

```bash
curl http://localhost:3000/health/db
```

### Manual Connection Test

```bash
psql $DATABASE_URL -c "SELECT version();"
```

## Migration from Direct Connections

If you have existing code using direct `pg.Client`:

```typescript
// ❌ OLD - Direct client
import { Client } from 'pg';

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const result = await client.query('SELECT * FROM users');
await client.end();

// ✅ NEW - Use pool
import { getPool } from '@/database/pool';

const pool = getPool();
const result = await pool.query('SELECT * FROM users');
// No need to connect/disconnect - pool handles it
```

## Resources

- [PostgreSQL Connection Pooling Best Practices](https://wiki.postgresql.org/wiki/Number_Of_Database_Connections)
- [HikariCP Connection Pool Sizing](https://github.com/brettwooldridge/HikariCP/wiki/About-Pool-Sizing)
- [node-pg Pool Documentation](https://node-postgres.com/features/pooling)

## Support

For issues or questions:
- Check [Troubleshooting](#troubleshooting) section
- Review pool metrics and monitoring queries
- Contact DevOps team for production issues
