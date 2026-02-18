-- Add foreign key constraints for content references
-- creator_id is a NOSTR pubkey (TEXT), not a UUID FK to users table
-- content_id references the content table

ALTER TABLE cross_posts
  ADD CONSTRAINT fk_cross_posts_content
  FOREIGN KEY (content_id) REFERENCES content(id) ON DELETE CASCADE;

ALTER TABLE repurposed_content
  ADD CONSTRAINT fk_repurposed_content_source
  FOREIGN KEY (source_content_id) REFERENCES content(id) ON DELETE CASCADE;

-- Add composite FK from cross_posts to platform_connections
-- Ensures cross-posts can only be created for connected platforms
ALTER TABLE cross_posts
  ADD CONSTRAINT fk_cross_posts_platform_connection
  FOREIGN KEY (creator_id, platform)
  REFERENCES platform_connections(creator_id, platform)
  ON DELETE CASCADE;

-- Add CHECK constraint for NOSTR pubkey format (64 hex chars)
ALTER TABLE platform_connections
  ADD CONSTRAINT chk_creator_id_format
  CHECK (LENGTH(creator_id) = 64 AND creator_id ~ '^[0-9a-f]+$');

-- Down migration (execute manually to rollback):
-- BEGIN;
-- ALTER TABLE platform_connections DROP CONSTRAINT IF EXISTS chk_creator_id_format;
-- ALTER TABLE cross_posts DROP CONSTRAINT IF EXISTS fk_cross_posts_platform_connection;
-- ALTER TABLE repurposed_content DROP CONSTRAINT IF EXISTS fk_repurposed_content_source;
-- ALTER TABLE cross_posts DROP CONSTRAINT IF EXISTS fk_cross_posts_content;
-- COMMIT;
