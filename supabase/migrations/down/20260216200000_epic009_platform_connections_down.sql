-- Rollback: 20260216200000_epic009_platform_connections.sql
-- Drops the platform_connections table and all associated objects

BEGIN;

DROP POLICY IF EXISTS "Creators can only access own connections" ON platform_connections;
DROP INDEX IF EXISTS idx_platform_connections_creator;
DROP INDEX IF EXISTS idx_platform_connections_status;
DROP INDEX IF EXISTS idx_platform_connections_expires;
DROP TABLE IF EXISTS platform_connections CASCADE;

COMMIT;
