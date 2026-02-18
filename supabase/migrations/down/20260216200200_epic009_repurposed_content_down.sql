-- Rollback: 20260216200200_epic009_repurposed_content.sql
-- Drops the repurposed_content table and all associated objects

BEGIN;

DROP TRIGGER IF EXISTS trigger_repurposed_content_updated_at ON repurposed_content;
DROP POLICY IF EXISTS "Creators can only access own repurposed content" ON repurposed_content;
DROP INDEX IF EXISTS idx_repurposed_creator;
DROP INDEX IF EXISTS idx_repurposed_source;
DROP TABLE IF EXISTS repurposed_content CASCADE;

COMMIT;
