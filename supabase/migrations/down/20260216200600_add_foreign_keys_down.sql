-- Rollback: 20260216200600_add_foreign_keys.sql
-- Removes foreign key constraints and check constraint added by the up migration

BEGIN;

ALTER TABLE platform_connections DROP CONSTRAINT IF EXISTS chk_creator_id_format;
ALTER TABLE cross_posts DROP CONSTRAINT IF EXISTS fk_cross_posts_platform_connection;
ALTER TABLE repurposed_content DROP CONSTRAINT IF EXISTS fk_repurposed_content_source;
ALTER TABLE cross_posts DROP CONSTRAINT IF EXISTS fk_cross_posts_content;

COMMIT;
