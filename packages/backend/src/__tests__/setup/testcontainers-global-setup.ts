import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { GenericContainer, StartedTestContainer } from 'testcontainers';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

// Disable Ryuk reaper — avoids Docker API issues locally and in CI
process.env.TESTCONTAINERS_RYUK_DISABLED = 'true';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Module-level refs for teardown (Vitest forks pool doesn't pass setup return to teardown)
let _pgContainer: StartedPostgreSqlContainer | null = null;
let _redisContainer: StartedTestContainer | null = null;

export async function setup(): Promise<void> {
  // Start containers in parallel
  const [pgContainer, redisContainer] = await Promise.all([
    new PostgreSqlContainer('postgres:16-alpine')
      .withDatabase('sovren_test')
      .withTmpFs({ '/var/lib/postgresql/data': 'rw' })
      .withCommand([
        'postgres',
        '-c',
        'fsync=off',
        '-c',
        'synchronous_commit=off',
        '-c',
        'shared_buffers=256MB',
        '-c',
        'work_mem=64MB',
        '-c',
        'wal_level=minimal',
        '-c',
        'max_wal_senders=0',
        '-c',
        'random_page_cost=1.1',
      ])
      .start(),
    new GenericContainer('redis:7-alpine').withExposedPorts(6379).start(),
  ]);

  _pgContainer = pgContainer;
  _redisContainer = redisContainer;

  // Bootstrap Supabase-specific stubs (bare PostgreSQL lacks these)
  const client = new pg.Client({
    connectionString: pgContainer.getConnectionUri(),
  });
  await client.connect();

  await client.query(`
    -- Extensions required by migrations
    CREATE EXTENSION IF NOT EXISTS "btree_gist";

    -- Supabase auth schema stubs
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid AS $$
      SELECT current_setting('request.jwt.claim.sub', true)::uuid;
    $$ LANGUAGE sql STABLE;
    CREATE OR REPLACE FUNCTION auth.role() RETURNS text AS $$
      SELECT COALESCE(current_setting('request.jwt.claim.role', true), 'anon');
    $$ LANGUAGE sql STABLE;

    -- Supabase-specific roles
    DO $$ BEGIN
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon NOLOGIN;
      END IF;
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated NOLOGIN;
      END IF;
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN
        CREATE ROLE service_role NOLOGIN;
      END IF;
    END $$;
  `);

  // Apply all migrations in order (glob + sort = deterministic, no hardcoded list)
  const migrationsDir = join(__dirname, '../../../../../supabase/migrations');
  if (!existsSync(migrationsDir)) {
    throw new Error(
      `Migration directory not found at ${migrationsDir}. ` +
        `Expected relative to testcontainers-global-setup.ts: supabase/migrations/`
    );
  }
  const migrationFiles = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql') && /^\d{14}_/.test(f))
    .sort();

  for (const file of migrationFiles) {
    const sql = readFileSync(join(migrationsDir, file), 'utf-8');
    try {
      await client.query(sql);
    } catch (err) {
      console.error(`Migration failed: ${file}`, err);
      throw err;
    }
  }
  await client.end();

  // Set env vars — forks propagate process.env to workers
  process.env.DATABASE_URL = pgContainer.getConnectionUri();
  process.env.REDIS_URL = `redis://${redisContainer.getHost()}:${redisContainer.getMappedPort(6379)}`;
}

export async function teardown(): Promise<void> {
  await Promise.all([_pgContainer?.stop({ timeout: 0 }), _redisContainer?.stop({ timeout: 0 })]);
  _pgContainer = null;
  _redisContainer = null;
}
