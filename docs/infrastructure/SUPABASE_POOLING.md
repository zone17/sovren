# Supabase Connection Pooling Configuration

## Overview

Supabase uses **PgBouncer** for automatic connection pooling on all projects. This guide explains how pooling is currently configured and when to use different endpoints.

## Current Setup: Supabase JS Client

The backend uses the **Supabase JavaScript client** (`@supabase/supabase-js`), which communicates via the **PostgREST HTTP API**. This approach has the following characteristics:

- **Pooling Type**: Built-in via PgBouncer on Supabase infrastructure
- **Connection Style**: HTTP (stateless) — each request is independent
- **Max Connections**: Managed automatically by PgBouncer on the Supabase side
- **Latency**: ~50-100ms per request (HTTP overhead)
- **Scalability**: Designed for serverless and cloud-native workloads

### Why HTTP-Based Pooling Works

PostgREST (HTTP layer) uses PgBouncer on the backend to:
1. Maintain a pool of persistent PostgreSQL connections
2. Reuse connections across HTTP requests
3. Prevent connection exhaustion
4. Handle connection timeouts automatically

**No local connection management needed** — the client library sends SQL through HTTP, and Supabase handles pooling server-side.

## Endpoints Explained

### Primary Endpoint (HTTP PostgREST)
```
https://{project}.supabase.co
```

- **Used by**: Supabase JS client, API clients
- **Protocol**: HTTP/REST
- **Pooling**: Built-in via PgBouncer
- **Best for**: Web apps, mobile apps, serverless functions
- **Current usage**: All backend API calls through `client.from().select().etc()`

### Pooler Endpoint (Raw SQL via PgBouncer)
```
db.{project}.supabase.co:6543
```

- **Used by**: Raw PostgreSQL connections (migrations, direct `pg` client)
- **Protocol**: PostgreSQL wire protocol
- **Pooling**: Yes, via PgBouncer (add `?pgbouncer=true` to connection string)
- **Best for**: Database migrations, direct SQL scripts, bulk operations
- **Current usage**: None — migrations should eventually use this for consistency

## Configuration in `database.ts`

```typescript
const DatabaseConfigSchema = z.object({
  supabaseUrl: z.string().url('Invalid Supabase URL'),
  supabaseKey: z.string().min(1, 'Supabase anon key is required'),
  maxConnections: z.number().min(1).max(100).default(20),
  connectionTimeout: z.number().min(1000).max(30000).default(10000),
});
```

### Dead Configuration Note

The `maxConnections` and `connectionTimeout` parameters are **parsed from environment variables but NOT used** in the current implementation:

```typescript
const config = {
  supabaseUrl: process.env.SUPABASE_URL || 'https://development.supabase.co',
  supabaseKey: process.env.SUPABASE_ANON_KEY || 'development-key',
  maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '20'),      // ⚠️ Not used
  connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT || '10000'), // ⚠️ Not used
};
```

These values are validated but never passed to the Supabase client because:
1. The Supabase JS client doesn't accept connection parameters
2. Pooling is managed entirely on Supabase's infrastructure (PgBouncer)
3. HTTP requests are stateless — connection pooling is transparent

**Recommendation**: Remove these dead parameters in a future refactor, or document them as legacy from a potential future raw `pg` client implementation.

## When to Use Each Endpoint

### ✅ Use PostgREST (Current)
- Building REST APIs
- Mobile or web client connections
- Serverless functions
- Load-balanced microservices
- Any scenario where HTTP is acceptable

**Current usage**: All backend API calls via Supabase JS client

### ⚠️ Use PgBouncer Pooler Endpoint
- Raw PostgreSQL driver needed (e.g., `pg` package)
- Direct SQL execution outside REST API
- Database migrations (if using raw SQL tools)
- Bulk inserts/updates with high concurrency
- LISTEN/NOTIFY message queues

**Not currently used** — would only apply if moving away from HTTP-based API layer.

## Connection String Format (If Using Raw `pg` Client)

If the backend ever migrates to raw PostgreSQL connections via the `pg` package:

```typescript
// Without PgBouncer mode (direct connection)
postgresql://postgres:password@db.project.supabase.co:5432/postgres

// With PgBouncer mode (recommended for pooling)
postgresql://postgres:password@db.project.supabase.co:6543/postgres?pgbouncer=true
```

**Add `?pgbouncer=true` query parameter** to use PgBouncer's transaction-pooling mode on the wire protocol.

## Monitoring Connection Health

The `SupabaseDatabase` class includes health checking:

```typescript
async getConnectionInfo(): Promise<{
  connected: boolean;
  latency: number;
  activeConnections: number;
}> {
  // Queries a dummy health-check table via PostgREST
  const { error } = await this.client.from('_health_check').select('1').limit(1).maybeSingle();
  // ...
}
```

Use this endpoint to:
- Monitor PostgREST API availability
- Measure HTTP request latency
- Track connection errors

## Performance Tuning

### Current Optimization
- **Auto-refresh tokens**: Disabled (`persistSession: false`) for stateless backend
- **Schema selection**: Explicit `public` schema to avoid ambiguity
- **Custom headers**: Client info headers for debugging

### Future Optimization Points
1. **Enable HTTP/2**: Supabase supports HTTP/2 for multiplexing
2. **Connection pooling metrics**: Add Prometheus metrics for HTTP request latency
3. **Cache policy**: Implement caching for read-heavy queries
4. **Prepared statements**: If migrating to raw `pg` client, use prepared statements to reduce parser load

## Summary

| Aspect | Current | Notes |
|--------|---------|-------|
| **Protocol** | HTTP (PostgREST) | Stateless, scalable |
| **Pooling** | PgBouncer (server-side) | Automatic, no client config needed |
| **Max Connections** | Managed by Supabase | Not configurable per-client |
| **Config Parameters** | `maxConnections`, `connectionTimeout` | Parsed but unused (dead code) |
| **Migration Path** | None needed currently | Only if switching to raw `pg` client |
| **Health Check** | `_health_check` table query | Available in `getConnectionInfo()` |

---

**See also**:
- Supabase JS Client: https://supabase.com/docs/reference/javascript/introduction
- PgBouncer Configuration: https://www.pgbouncer.org/config.html
- PostgREST API: https://postgrest.org/
