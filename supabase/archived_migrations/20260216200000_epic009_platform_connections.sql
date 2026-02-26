-- EPIC-009: Platform Connections Table
-- Stores OAuth connections to external platforms with encrypted tokens

CREATE TABLE IF NOT EXISTS platform_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('mastodon','bluesky','twitter','youtube')),
  platform_user_id TEXT,
  platform_username TEXT,
  access_token_encrypted BYTEA NOT NULL,
  refresh_token_encrypted BYTEA,
  token_iv BYTEA NOT NULL,
  token_auth_tag BYTEA NOT NULL,
  refresh_token_iv BYTEA,
  refresh_token_auth_tag BYTEA,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  instance_url TEXT,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'connected'
    CHECK (status IN ('connected','token_expiring','token_expired','error','disconnected')),
  last_refreshed_at TIMESTAMPTZ,
  error_message TEXT,
  UNIQUE(creator_id, platform)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_platform_connections_creator ON platform_connections(creator_id);
CREATE INDEX IF NOT EXISTS idx_platform_connections_status ON platform_connections(status);
CREATE INDEX IF NOT EXISTS idx_platform_connections_expires ON platform_connections(expires_at)
  WHERE expires_at IS NOT NULL AND status = 'connected';

-- NOTE: RLS policies use current_setting('app.current_user_id', true) for defense-in-depth.
-- The backend uses the Supabase service role key which bypasses RLS.
-- These policies protect against direct database access (e.g., Supabase Dashboard, SQL editor).
-- For application-level authorization, the backend uses authenticate + requireCreator middleware.

-- RLS
ALTER TABLE platform_connections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Creators can only access own connections" ON platform_connections;
CREATE POLICY "Creators can only access own connections"
  ON platform_connections FOR ALL
  USING (creator_id = current_setting('app.current_user_id', true))
  WITH CHECK (creator_id = current_setting('app.current_user_id', true));

-- Down migration (execute manually to rollback):
-- BEGIN;
-- DROP POLICY IF EXISTS "Creators can only access own connections" ON platform_connections;
-- DROP INDEX IF EXISTS idx_platform_connections_creator;
-- DROP INDEX IF EXISTS idx_platform_connections_status;
-- DROP INDEX IF EXISTS idx_platform_connections_expires;
-- DROP TABLE IF EXISTS platform_connections CASCADE;
-- COMMIT;
