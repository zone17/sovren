-- Rollback: 20260217000000_unify_platform_enum.sql
-- Reverts platform CHECK constraints to exclude 'nostr' from 3 tables

BEGIN;

ALTER TABLE platform_connections DROP CONSTRAINT IF EXISTS platform_connections_platform_check;
ALTER TABLE platform_connections
  ADD CONSTRAINT platform_connections_platform_check
  CHECK (platform IN ('mastodon','bluesky','twitter','youtube'));

ALTER TABLE cross_posts DROP CONSTRAINT IF EXISTS cross_posts_platform_check;
ALTER TABLE cross_posts
  ADD CONSTRAINT cross_posts_platform_check
  CHECK (platform IN ('mastodon','bluesky','twitter','youtube'));

ALTER TABLE repurposed_content DROP CONSTRAINT IF EXISTS repurposed_content_platform_check;
ALTER TABLE repurposed_content
  ADD CONSTRAINT repurposed_content_platform_check
  CHECK (platform IN ('mastodon','bluesky','twitter','youtube'));

COMMIT;
