-- Add missing updated_at triggers for Epic 009 tables
-- The baseline schema defines update_updated_at() function and uses it for
-- users, content, payments, and comments tables. The Epic 009 tables
-- cross_posts and repurposed_content have updated_at columns but were
-- missing the corresponding triggers, relying on application-level
-- timestamp setting which is error-prone.

-- cross_posts: auto-update updated_at on row modification
CREATE TRIGGER trigger_cross_posts_updated_at
    BEFORE UPDATE ON cross_posts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- repurposed_content: auto-update updated_at on row modification
CREATE TRIGGER trigger_repurposed_content_updated_at
    BEFORE UPDATE ON repurposed_content
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Down migration (execute manually to rollback):
-- BEGIN;
-- DROP TRIGGER IF EXISTS trigger_cross_posts_updated_at ON cross_posts;
-- DROP TRIGGER IF EXISTS trigger_repurposed_content_updated_at ON repurposed_content;
-- COMMIT;
