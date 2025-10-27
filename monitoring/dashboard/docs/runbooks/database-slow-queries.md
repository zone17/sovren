# Runbook: Database Slow Queries

**Alert**: `DatabaseSlowQueries`
**Severity**: WARNING
**Team**: Infrastructure
**SLA**: 30 minutes to acknowledge, 2 hours to resolve

## Symptoms

Database queries are taking longer than 1 second. Payment processing is degraded but functional.

## Impact

- **Performance**: Slow response times for users
- **UX**: Delayed payment confirmations
- **Risk**: May escalate to complete failures if unchecked
- **SLO**: Latency SLO may be breached (P95 < 500ms)

## Immediate Actions (First 5 Minutes)

1. **Check Current Query Performance**:
   ```sql
   SELECT pid, now() - query_start as duration, state, query
   FROM pg_stat_activity
   WHERE state = 'active' AND query NOT ILIKE '%pg_stat_activity%'
   ORDER BY duration DESC
   LIMIT 10;
   ```

2. **Identify Slow Queries**:
   ```sql
   SELECT query, calls, total_time, mean_time, max_time
   FROM pg_stat_statements
   ORDER BY mean_time DESC
   LIMIT 10;
   ```

3. **Check Database Load**:
   ```sql
   SELECT count(*) as active_connections,
          count(*) FILTER (WHERE state = 'idle in transaction') as idle_in_transaction
   FROM pg_stat_activity;
   ```

## Investigation Steps

### Step 1: Identify Problematic Queries

```sql
-- Get queries with high execution time
SELECT substring(query, 1, 100) as query_snippet,
       calls,
       total_time / 1000 as total_seconds,
       mean_time / 1000 as mean_seconds,
       max_time / 1000 as max_seconds,
       rows
FROM pg_stat_statements
WHERE mean_time > 1000  -- More than 1 second
ORDER BY mean_time DESC
LIMIT 20;
```

```sql
-- Get currently running slow queries
SELECT pid,
       now() - query_start as duration,
       state,
       wait_event_type,
       wait_event,
       substring(query, 1, 200) as query_snippet
FROM pg_stat_activity
WHERE state = 'active'
  AND query_start < now() - interval '1 second'
  AND query NOT ILIKE '%pg_stat_activity%'
ORDER BY query_start;
```

### Step 2: Check for Missing Indexes

```sql
-- Find tables with sequential scans
SELECT schemaname, tablename,
       seq_scan,
       seq_tup_read,
       idx_scan,
       seq_tup_read / seq_scan as avg_seq_tup_read
FROM pg_stat_user_tables
WHERE seq_scan > 0
  AND seq_tup_read / seq_scan > 10000  -- Large sequential scans
ORDER BY seq_tup_read DESC
LIMIT 10;
```

```sql
-- Find unused indexes (candidates for removal)
SELECT schemaname, tablename, indexname,
       idx_scan,
       pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
WHERE idx_scan = 0
  AND indexrelname NOT LIKE '%pkey'
ORDER BY pg_relation_size(indexrelid) DESC;
```

### Step 3: Check for Lock Contention

```sql
-- Find blocking queries
SELECT blocked_locks.pid AS blocked_pid,
       blocked_activity.usename AS blocked_user,
       blocking_locks.pid AS blocking_pid,
       blocking_activity.usename AS blocking_user,
       blocked_activity.query AS blocked_statement,
       blocking_activity.query AS blocking_statement
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

### Step 4: Check Database Statistics

```sql
-- Check table bloat
SELECT schemaname, tablename,
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
       n_dead_tup,
       n_live_tup,
       round(n_dead_tup * 100.0 / NULLIF(n_live_tup + n_dead_tup, 0), 2) as dead_tuple_percent
FROM pg_stat_user_tables
WHERE n_live_tup > 0
ORDER BY n_dead_tup DESC
LIMIT 10;
```

```sql
-- Check when tables were last vacuumed/analyzed
SELECT schemaname, tablename,
       last_vacuum,
       last_autovacuum,
       last_analyze,
       last_autoanalyze,
       n_dead_tup
FROM pg_stat_user_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY last_autovacuum NULLS FIRST
LIMIT 10;
```

## Common Root Causes

| Cause | Symptoms | Solution |
|-------|----------|----------|
| Missing indexes | High seq_scan, large seq_tup_read | Add appropriate indexes |
| Table bloat | High dead tuples, slow queries | Run VACUUM FULL |
| Lock contention | Blocked queries, idle in transaction | Kill blocking queries, optimize transactions |
| Poor query design | High execution time, many rows returned | Optimize query, add filters |
| Outdated statistics | Query planner chooses wrong plan | Run ANALYZE |
| Connection pool exhaustion | Many idle connections | Increase pool size or kill idle |
| Hardware limits | High I/O wait, disk saturation | Scale database, optimize storage |

## Resolution Steps

### If Missing Indexes:

```sql
-- Example: Add index on frequently queried columns
CREATE INDEX CONCURRENTLY idx_payments_user_id_created_at
ON payments(user_id, created_at DESC)
WHERE status = 'completed';

-- Monitor index creation progress
SELECT query_start, state, query
FROM pg_stat_activity
WHERE query ILIKE '%CREATE INDEX%';
```

### If Table Bloat:

```sql
-- For small tables (manual vacuum)
VACUUM FULL ANALYZE payments;

-- For large tables (use pg_repack instead to avoid locks)
-- Install pg_repack extension first
CREATE EXTENSION pg_repack;

-- Repack table (online, no locks)
pg_repack -t payments -d payment_db
```

### If Lock Contention:

```sql
-- Kill blocking queries (use with caution!)
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle in transaction'
  AND query_start < now() - interval '5 minutes';
```

### If Outdated Statistics:

```sql
-- Update statistics for all tables
ANALYZE;

-- For specific problematic table
ANALYZE VERBOSE payments;

-- Increase statistics target for important columns
ALTER TABLE payments ALTER COLUMN user_id SET STATISTICS 1000;
ANALYZE payments;
```

### If Connection Pool Issues:

```bash
# Increase connection pool size in application
# config/database.yml or environment variables
export DB_POOL_SIZE=50  # Increase from 20

# Restart application
docker restart payment-api
```

## Verification

1. **Check Query Performance**:
   ```sql
   SELECT mean_time / 1000 as mean_seconds
   FROM pg_stat_statements
   WHERE query ILIKE '%your_optimized_query%'
   ORDER BY calls DESC
   LIMIT 1;
   ```

2. **Monitor Health Check**:
   ```bash
   curl http://payment-api:3000/health | jq '.components.database'
   # Should return: "healthy"
   ```

3. **Check Grafana**:
   - Navigate to Database Dashboard
   - Verify P95 query time is below 1s

## Escalation

If queries remain slow after 2 hours:

1. **Engage Database Admin**: Specialized expertise needed
2. **Consider Read Replicas**: Offload read traffic
3. **Plan Database Upgrade**: May need more resources
4. **Schedule Maintenance**: For major optimizations (VACUUM FULL, reindexing)

## Post-Incident

1. **Document Slow Queries**: Save query plans for analysis
   ```sql
   EXPLAIN (ANALYZE, BUFFERS) <slow_query>;
   ```

2. **Review Indexes**: Ensure proper indexing strategy
3. **Update Monitoring**: Add specific slow query alerts
4. **Code Review**: Check if ORM is generating inefficient queries
5. **Capacity Planning**: Review if database needs scaling

## Prevention

- **Query Review**: All queries reviewed before deployment
- **EXPLAIN ANALYZE**: Run on all new queries
- **Index Monitoring**: Track index usage and effectiveness
- **Auto-VACUUM**: Ensure autovacuum is properly configured
- **Connection Pooling**: Use pgBouncer for connection pooling
- **Monitoring**: Alert on slow queries before they impact users

## Useful Commands

```sql
-- Get query execution plan
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT ...;

-- Reset pg_stat_statements
SELECT pg_stat_statements_reset();

-- Check cache hit ratio
SELECT sum(heap_blks_read) as heap_read,
       sum(heap_blks_hit) as heap_hit,
       sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)) as cache_hit_ratio
FROM pg_statio_user_tables;

-- Check index usage
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;
```

## Related Alerts

- `DatabaseConnectionFailed` - May trigger if queries timeout completely
- `HighDatabaseConnections` - Often accompanies slow queries
- `SlowPaymentProcessing` - Result of slow database queries

## References

- [PostgreSQL Performance Tuning](https://www.postgresql.org/docs/current/performance-tips.html)
- [Database Optimization Guide](/docs/database-optimization.md)
- [Index Strategy Guide](/docs/index-strategy.md)
- [Query Analysis Tools](/docs/query-analysis.md)
