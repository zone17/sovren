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
CREATE INDEX idx_platform_metrics_creator ON platform_metrics_history(creator_id);
CREATE INDEX idx_platform_metrics_recorded ON platform_metrics_history(recorded_at DESC);

-- RLS
ALTER TABLE platform_metrics_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Creators can only access own metrics"
  ON platform_metrics_history FOR ALL
  USING (creator_id = current_setting('app.current_user_id', true));

-- Down migration:
-- DROP TABLE IF EXISTS platform_metrics_history CASCADE;
