-- EPIC-009: Platform Metrics History Table
-- Daily snapshots of cross-platform metrics for trend analysis

CREATE TABLE IF NOT EXISTS platform_metrics_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('mastodon','bluesky','twitter','youtube','nostr')),
  followers INTEGER NOT NULL DEFAULT 0,
  following INTEGER NOT NULL DEFAULT 0,
  posts INTEGER NOT NULL DEFAULT 0,
  engagement_rate NUMERIC(7,4) NOT NULL DEFAULT 0,
  impressions_30d INTEGER NOT NULL DEFAULT 0,
  recorded_at DATE NOT NULL DEFAULT CURRENT_DATE,
  UNIQUE(creator_id, platform, recorded_at)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_platform_metrics_creator ON platform_metrics_history(creator_id);
CREATE INDEX IF NOT EXISTS idx_platform_metrics_recorded ON platform_metrics_history(recorded_at DESC);

-- NOTE: RLS policies use current_setting('app.current_user_id', true) for defense-in-depth.
-- The backend uses the Supabase service role key which bypasses RLS.
-- These policies protect against direct database access (e.g., Supabase Dashboard, SQL editor).
-- For application-level authorization, the backend uses authenticate + requireCreator middleware.

-- RLS
ALTER TABLE platform_metrics_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Creators can only access own metrics" ON platform_metrics_history;
CREATE POLICY "Creators can only access own metrics"
  ON platform_metrics_history FOR ALL
  USING (creator_id = current_setting('app.current_user_id', true))
  WITH CHECK (creator_id = current_setting('app.current_user_id', true));

-- Down migration:
-- DROP TABLE IF EXISTS platform_metrics_history CASCADE;
