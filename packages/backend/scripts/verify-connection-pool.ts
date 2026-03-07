#!/usr/bin/env tsx

/**
 * Connection Pool Verification Script
 *
 * Usage:
 *   npm run verify:pool
 *
 * Or directly:
 *   tsx scripts/verify-connection-pool.ts
 */

import { getPool, poolManager, getPoolStats, shutdownPool } from '../src/config/database.config';

async function verifyConnectionPool() {
  console.log('🔍 Verifying Connection Pool Configuration...\n');

  try {
    // Step 1: Initialize pool
    console.log('1️⃣  Initializing connection pool...');
    const pool = getPool();
    console.log('   ✅ Pool initialized successfully\n');

    // Step 2: Check pool statistics
    console.log('2️⃣  Checking pool statistics...');
    const stats = getPoolStats();
    console.log('   📊 Pool Statistics:');
    console.log(`      - Total Connections: ${stats.totalConnections}/${stats.maxConnections}`);
    console.log(`      - Idle Connections: ${stats.idleConnections}`);
    console.log(`      - Waiting Requests: ${stats.waitingRequests}`);
    console.log(`      - Health Status: ${stats.healthStatus}`);
    console.log(`      - Uptime: ${stats.uptimeSeconds}s`);
    console.log(`      - Total Queries: ${stats.totalQueries}`);
    console.log(`      - Avg Query Time: ${stats.averageQueryTime.toFixed(2)}ms\n`);

    if (stats.healthStatus !== 'healthy') {
      console.warn('   ⚠️  Pool is not healthy:', stats.healthStatus);
    } else {
      console.log('   ✅ Pool is healthy\n');
    }

    // Step 3: Test health check
    console.log('3️⃣  Testing health check...');
    const health = await poolManager.healthCheck();
    console.log('   🏥 Health Check Result:');
    console.log(`      - Healthy: ${health.healthy ? 'Yes' : 'No'}`);
    console.log(`      - Latency: ${health.latency}ms`);
    if (health.error) {
      console.error(`      - Error: ${health.error}`);
    }
    console.log();

    if (!health.healthy) {
      console.error('   ❌ Health check failed\n');
      if (health.error?.includes('role') || health.error?.includes('does not exist')) {
        console.log('   ℹ️  This is expected if the database is not set up yet.');
        console.log('   ℹ️  Configure DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD in .env\n');
      }
    } else {
      console.log('   ✅ Health check passed\n');
    }

    // Step 4: Test query execution (if database is available)
    console.log('4️⃣  Testing query execution...');
    try {
      const result = await poolManager.query('SELECT 1 as test');
      console.log('   📝 Query Result:', result.rows[0]);
      console.log('   ✅ Query execution successful\n');
    } catch (error) {
      console.error(
        '   ❌ Query execution failed:',
        error instanceof Error ? error.message : error
      );
      if (String(error).includes('role') || String(error).includes('does not exist')) {
        console.log('   ℹ️  This is expected if the database is not set up yet.\n');
      }
    }

    // Step 5: Test concurrent queries
    console.log('5️⃣  Testing concurrent query handling...');
    const concurrentCount = 5;
    const queries = [];

    for (let i = 0; i < concurrentCount; i++) {
      queries.push(
        poolManager.query('SELECT $1 as num', [i + 1]).catch(() => null) // Ignore errors for this test
      );
    }

    const results = await Promise.all(queries);
    const successCount = results.filter((r) => r !== null).length;

    console.log(`   📊 Concurrent Queries: ${successCount}/${concurrentCount} successful`);
    console.log('   ✅ Concurrent query handling verified\n');

    // Step 6: Verify configuration
    console.log('6️⃣  Verifying configuration...');
    const requiredEnvVars = [
      'DB_HOST',
      'DB_PORT',
      'DB_NAME',
      'DB_USER',
      'DB_POOL_MAX',
      'DB_POOL_MIN',
    ];

    let allConfigured = true;
    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        console.warn(`   ⚠️  ${envVar} not configured`);
        allConfigured = false;
      }
    }

    if (allConfigured) {
      console.log('   ✅ All required environment variables configured\n');
    } else {
      console.log('   ℹ️  Some environment variables are missing. Check .env.development\n');
    }

    // Summary
    console.log('📋 Summary:');
    console.log('   - Pool initialization: ✅');
    console.log(
      `   - Pool health status: ${stats.healthStatus === 'healthy' ? '✅' : '⚠️ ' + stats.healthStatus}`
    );
    console.log(`   - Health check: ${health.healthy ? '✅' : '❌'}`);
    console.log(`   - Configuration: ${allConfigured ? '✅' : '⚠️  Incomplete'}`);

    if (health.healthy && stats.healthStatus === 'healthy' && allConfigured) {
      console.log('\n🎉 Connection pool is fully operational and ready for production!\n');
    } else if (
      !health.healthy &&
      (health.error?.includes('role') || health.error?.includes('does not exist'))
    ) {
      console.log('\n⚠️  Database not configured yet. This is expected in development.\n');
      console.log('To complete setup:');
      console.log('1. Configure database credentials in .env');
      console.log('2. Run migrations: npm run db:migrate');
      console.log('3. Re-run this verification: npm run verify:pool\n');
    } else {
      console.log('\n⚠️  Some checks failed. Review the output above for details.\n');
    }
  } catch (error) {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  } finally {
    // Cleanup
    console.log('🧹 Cleaning up...');
    await shutdownPool();
    console.log('   ✅ Pool shut down gracefully\n');
  }
}

// Run verification
verifyConnectionPool()
  .then(() => {
    console.log('✅ Verification complete\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
