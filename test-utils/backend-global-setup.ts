/**
 * Global setup for backend test suite.
 * Verifies Supabase and Redis are running before tests start.
 */
import { execSync } from 'child_process';
import { resolve } from 'path';

// Resolve project root relative to this file (test-utils/ is one level below root)
const PROJECT_ROOT = resolve(__dirname, '..');

export async function setup() {
  // 1. Verify Supabase is running
  try {
    const status = execSync('supabase status -o env 2>/dev/null', {
      cwd: PROJECT_ROOT,
      encoding: 'utf8',
    });
    if (!status.includes('API_URL')) {
      throw new Error('Supabase not running');
    }
  } catch {
    // Fallback: check if the API is reachable directly
    try {
      execSync('curl -sf http://127.0.0.1:54321/rest/v1/ -o /dev/null', {
        encoding: 'utf8',
        timeout: 5000,
      });
    } catch {
      console.error(
        '\n❌ Supabase is not running. Start it with: supabase start\n'
      );
      process.exit(1);
    }
  }

  // 2. Skip full DB reset — use truncateAll() in individual tests for isolation.
  // Full resets kill the DB container for 20+ seconds and break parallel agents.

  // 3. Verify Redis on test port
  try {
    execSync('docker exec redis-test redis-cli PING', {
      encoding: 'utf8',
      timeout: 5000,
    });
  } catch {
    console.error(
      '\n❌ Redis test container not running. Start it with:\n' +
      '   docker run -d --name redis-test -p 6380:6379 redis:7-alpine\n'
    );
    process.exit(1);
  }

  // 4. Set environment variables for test suite
  process.env.SUPABASE_URL = 'http://127.0.0.1:54321';
  process.env.SUPABASE_ANON_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
  process.env.SUPABASE_SERVICE_ROLE_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
  process.env.JWT_SECRET = 'super-secret-jwt-token-with-at-least-32-characters-long';
  process.env.REDIS_URL = 'redis://localhost:6380';

  console.log('✓ Backend test infrastructure ready (Supabase + Redis)');
}

export async function teardown() {
  // Leave services running for fast re-runs
  // CI should clean up via docker-compose down
}
