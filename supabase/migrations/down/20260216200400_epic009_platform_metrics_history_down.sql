-- Rollback: 20260216200400_epic009_platform_metrics_history.sql
-- Drops the platform_metrics_history table and all associated objects

BEGIN;

DROP POLICY IF EXISTS "Creators can only access own metrics" ON platform_metrics_history;
DROP INDEX IF EXISTS idx_platform_metrics_creator;
DROP INDEX IF EXISTS idx_platform_metrics_recorded;
DROP TABLE IF EXISTS platform_metrics_history CASCADE;

COMMIT;
