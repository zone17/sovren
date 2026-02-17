-- EPIC-009: Repurposed Content Table
-- Stores platform-optimized versions of source content

CREATE TABLE IF NOT EXISTS repurposed_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id TEXT NOT NULL,
  source_content_id UUID NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('mastodon','bluesky','twitter','youtube')),
  format_type TEXT NOT NULL CHECK (format_type IN ('thread','summary','short_post','video_description')),
  text TEXT NOT NULL,
  character_count INTEGER NOT NULL,
  approved BOOLEAN NOT NULL DEFAULT false,
  backlink_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_repurposed_creator ON repurposed_content(creator_id);
CREATE INDEX IF NOT EXISTS idx_repurposed_source ON repurposed_content(source_content_id);

-- NOTE: RLS policies use current_setting('app.current_user_id', true) for defense-in-depth.
-- The backend uses the Supabase service role key which bypasses RLS.
-- These policies protect against direct database access (e.g., Supabase Dashboard, SQL editor).
-- For application-level authorization, the backend uses authenticate + requireCreator middleware.

-- RLS
ALTER TABLE repurposed_content ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Creators can only access own repurposed content" ON repurposed_content;
CREATE POLICY "Creators can only access own repurposed content"
  ON repurposed_content FOR ALL
  USING (creator_id = current_setting('app.current_user_id', true))
  WITH CHECK (creator_id = current_setting('app.current_user_id', true));

-- Down migration (execute manually to rollback):
-- BEGIN;
-- DROP TRIGGER IF EXISTS trigger_repurposed_content_updated_at ON repurposed_content;
-- DROP POLICY IF EXISTS "Creators can only access own repurposed content" ON repurposed_content;
-- DROP INDEX IF EXISTS idx_repurposed_creator;
-- DROP INDEX IF EXISTS idx_repurposed_source;
-- DROP TABLE IF EXISTS repurposed_content CASCADE;
-- COMMIT;
