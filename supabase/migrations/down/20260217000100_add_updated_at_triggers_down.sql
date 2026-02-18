-- Rollback: 20260217000100_add_updated_at_triggers.sql
-- Removes updated_at triggers from cross_posts and repurposed_content

BEGIN;

DROP TRIGGER IF EXISTS trigger_cross_posts_updated_at ON cross_posts;
DROP TRIGGER IF EXISTS trigger_repurposed_content_updated_at ON repurposed_content;

COMMIT;
