-- EPIC-009: Inbox Messages Table
-- Cached messages from external platforms for unified inbox

CREATE TABLE IF NOT EXISTS inbox_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('mastodon','bluesky','twitter','youtube','nostr')),
  platform_message_id TEXT NOT NULL,
  author TEXT NOT NULL,
  author_avatar_url TEXT,
  content TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('comment','reply','dm','mention')),
  parent_post_id TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  platform_created_at TIMESTAMPTZ NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(creator_id, platform, platform_message_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_inbox_creator ON inbox_messages(creator_id);
CREATE INDEX IF NOT EXISTS idx_inbox_creator_unread ON inbox_messages(creator_id, is_read)
  WHERE is_read = false AND is_archived = false;
CREATE INDEX IF NOT EXISTS idx_inbox_creator_platform ON inbox_messages(creator_id, platform);
CREATE INDEX IF NOT EXISTS idx_inbox_fetched ON inbox_messages(fetched_at DESC);

-- NOTE: RLS policies use current_setting('app.current_user_id', true) for defense-in-depth.
-- The backend uses the Supabase service role key which bypasses RLS.
-- These policies protect against direct database access (e.g., Supabase Dashboard, SQL editor).
-- For application-level authorization, the backend uses authenticate + requireCreator middleware.

-- RLS
ALTER TABLE inbox_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Creators can only access own inbox" ON inbox_messages;
CREATE POLICY "Creators can only access own inbox"
  ON inbox_messages FOR ALL
  USING (creator_id = current_setting('app.current_user_id', true))
  WITH CHECK (creator_id = current_setting('app.current_user_id', true));

-- Down migration (execute manually to rollback):
-- BEGIN;
-- DROP POLICY IF EXISTS "Creators can only access own inbox" ON inbox_messages;
-- DROP INDEX IF EXISTS idx_inbox_creator;
-- DROP INDEX IF EXISTS idx_inbox_creator_unread;
-- DROP INDEX IF EXISTS idx_inbox_creator_platform;
-- DROP INDEX IF EXISTS idx_inbox_fetched;
-- DROP TABLE IF EXISTS inbox_messages CASCADE;
-- COMMIT;
