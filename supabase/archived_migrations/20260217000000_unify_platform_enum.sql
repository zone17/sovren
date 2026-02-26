-- Unify platform CHECK constraints across all Epic 009 tables
-- Previously, inbox_messages and platform_metrics_history included 'nostr'
-- but platform_connections, cross_posts, and repurposed_content did not.
-- This migration adds 'nostr' to the remaining 3 tables for consistency.
-- JOINs between these tables on the platform column will no longer silently
-- drop nostr rows or produce unexpected NULLs.
--
-- Note: The application layer still controls which platforms support publishing
-- vs receive-only. The DB enum is unified for data integrity in joins.

-- platform_connections: drop old constraint, add new with 'nostr'
ALTER TABLE platform_connections
  DROP CONSTRAINT IF EXISTS platform_connections_platform_check;
ALTER TABLE platform_connections
  ADD CONSTRAINT platform_connections_platform_check
  CHECK (platform IN ('mastodon','bluesky','twitter','youtube','nostr'));

-- cross_posts: drop old constraint, add new with 'nostr'
ALTER TABLE cross_posts
  DROP CONSTRAINT IF EXISTS cross_posts_platform_check;
ALTER TABLE cross_posts
  ADD CONSTRAINT cross_posts_platform_check
  CHECK (platform IN ('mastodon','bluesky','twitter','youtube','nostr'));

-- repurposed_content: drop old constraint, add new with 'nostr'
ALTER TABLE repurposed_content
  DROP CONSTRAINT IF EXISTS repurposed_content_platform_check;
ALTER TABLE repurposed_content
  ADD CONSTRAINT repurposed_content_platform_check
  CHECK (platform IN ('mastodon','bluesky','twitter','youtube','nostr'));

-- Down migration (execute manually to rollback):
-- BEGIN;
-- ALTER TABLE platform_connections DROP CONSTRAINT IF EXISTS platform_connections_platform_check;
-- ALTER TABLE platform_connections ADD CONSTRAINT platform_connections_platform_check CHECK (platform IN ('mastodon','bluesky','twitter','youtube'));
-- ALTER TABLE cross_posts DROP CONSTRAINT IF EXISTS cross_posts_platform_check;
-- ALTER TABLE cross_posts ADD CONSTRAINT cross_posts_platform_check CHECK (platform IN ('mastodon','bluesky','twitter','youtube'));
-- ALTER TABLE repurposed_content DROP CONSTRAINT IF EXISTS repurposed_content_platform_check;
-- ALTER TABLE repurposed_content ADD CONSTRAINT repurposed_content_platform_check CHECK (platform IN ('mastodon','bluesky','twitter','youtube'));
-- COMMIT;
