-- Rollback: 20260216200100_epic009_cross_posts.sql
-- Drops the cross_posts table and all associated objects

BEGIN;

DROP TRIGGER IF EXISTS trigger_cross_posts_updated_at ON cross_posts;
DROP POLICY IF EXISTS "Creators can only access own cross-posts" ON cross_posts;
DROP INDEX IF EXISTS idx_cross_posts_creator;
DROP INDEX IF EXISTS idx_cross_posts_content;
DROP INDEX IF EXISTS idx_cross_posts_status;
DROP INDEX IF EXISTS idx_cross_posts_scheduled;
DROP TABLE IF EXISTS cross_posts CASCADE;

COMMIT;
