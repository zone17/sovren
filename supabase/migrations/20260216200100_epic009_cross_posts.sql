-- EPIC-009: Cross-Posts Table
-- Tracks content published to external platforms

CREATE TABLE IF NOT EXISTS cross_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id TEXT NOT NULL,
  content_id UUID NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('mastodon','bluesky','twitter','youtube')),
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','scheduled','publishing','published','failed','cancelled')),
  platform_post_id TEXT,
  platform_url TEXT,
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  error_message TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  metrics_json JSONB DEFAULT '{}',
  bullmq_job_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_cross_posts_creator ON cross_posts(creator_id);
CREATE INDEX idx_cross_posts_content ON cross_posts(content_id);
CREATE INDEX idx_cross_posts_status ON cross_posts(status);
CREATE INDEX idx_cross_posts_scheduled ON cross_posts(scheduled_at)
  WHERE status = 'scheduled' AND scheduled_at IS NOT NULL;

-- RLS
ALTER TABLE cross_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Creators can only access own cross-posts"
  ON cross_posts FOR ALL
  USING (creator_id = current_setting('app.current_user_id', true));

-- Down migration:
-- DROP TABLE IF EXISTS cross_posts CASCADE;
