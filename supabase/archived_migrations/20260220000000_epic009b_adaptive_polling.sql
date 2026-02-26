-- EPIC-009B: Adaptive Polling Infrastructure
-- Adds adaptive polling columns to platform_connections,
-- creates reply_templates table (inbox_messages table already exists from EPIC-009A).
--
-- Security:
--   C-5: BYOK keys use a separate BYOK_ENCRYPTION_KEY (not PLATFORM_TOKEN_ENCRYPTION_KEY).
--        key_version supports future key rotation without downtime.
--   RLS: all policies use (select auth.uid()) for initPlan optimization (up to 100x perf).

-- ============================================================================
-- 1. Extend platform_connections for adaptive polling
-- ============================================================================

-- poll_interval (minutes): 5 = active, 30 = idle (default)
ALTER TABLE platform_connections
  ADD COLUMN IF NOT EXISTS poll_interval INTEGER NOT NULL DEFAULT 30
  CHECK (poll_interval IN (5, 30));

-- last_active_at: tracks when the creator last made an API request.
-- InboxPollingService uses this to route creators to the active (5min) scheduler.
ALTER TABLE platform_connections
  ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;

-- instance_url: user-supplied Mastodon instance URL.
-- M-1: Always SSRF-validated before any outbound request is made to this URL.
ALTER TABLE platform_connections
  ADD COLUMN IF NOT EXISTS instance_url TEXT;

-- X/Twitter BYOK: encrypted API key for read access.
-- C-5: Encrypted with BYOK_ENCRYPTION_KEY — SEPARATE from PLATFORM_TOKEN_ENCRYPTION_KEY.
--      Never reuse the same key for BYOK keys and OAuth tokens.
ALTER TABLE platform_connections
  ADD COLUMN IF NOT EXISTS api_key_encrypted TEXT;
ALTER TABLE platform_connections
  ADD COLUMN IF NOT EXISTS api_key_iv TEXT;
ALTER TABLE platform_connections
  ADD COLUMN IF NOT EXISTS api_key_auth_tag TEXT;

-- C-5: key_version enables future key rotation.
-- When BYOK_ENCRYPTION_KEY is rotated, increment key_version and re-encrypt.
-- Services check key_version to select the correct decryption key.
ALTER TABLE platform_connections
  ADD COLUMN IF NOT EXISTS key_version INTEGER DEFAULT 1;

-- Compound index for adaptive polling batch queries
-- InboxPollingService queries: WHERE platform = ? AND status = ? AND last_active_at >= ?
CREATE INDEX IF NOT EXISTS idx_platform_connections_poll
  ON platform_connections(platform, status, last_active_at);

-- ============================================================================
-- 2. Compound index on inbox_messages for filtered list queries
-- Covers: creator_id, platform, is_read, is_archived, created_at DESC
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_inbox_messages_creator_platform_status
  ON inbox_messages(creator_id, platform, is_read, is_archived, platform_created_at DESC);

-- ============================================================================
-- 3. reply_templates table
-- Stores creator-authored response templates for the unified inbox.
-- ============================================================================

CREATE TABLE IF NOT EXISTS reply_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id TEXT NOT NULL,
  name TEXT NOT NULL,
  template_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(creator_id, name)
);

CREATE INDEX IF NOT EXISTS idx_reply_templates_creator
  ON reply_templates(creator_id, created_at DESC);

-- RLS: each creator manages only their own templates
-- (select auth.uid()) form for initPlan optimization
ALTER TABLE reply_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Creator manages own reply templates" ON reply_templates;
CREATE POLICY "Creator manages own reply templates"
  ON reply_templates FOR ALL
  USING (creator_id = (select auth.uid())::text)
  WITH CHECK (creator_id = (select auth.uid())::text);

-- ============================================================================
-- DOWN migration (manual rollback)
-- ============================================================================
-- BEGIN;
-- DROP POLICY IF EXISTS "Creator manages own reply templates" ON reply_templates;
-- DROP INDEX IF EXISTS idx_reply_templates_creator;
-- DROP TABLE IF EXISTS reply_templates;
-- DROP INDEX IF EXISTS idx_inbox_messages_creator_platform_status;
-- DROP INDEX IF EXISTS idx_platform_connections_poll;
-- ALTER TABLE platform_connections DROP COLUMN IF EXISTS key_version;
-- ALTER TABLE platform_connections DROP COLUMN IF EXISTS api_key_auth_tag;
-- ALTER TABLE platform_connections DROP COLUMN IF EXISTS api_key_iv;
-- ALTER TABLE platform_connections DROP COLUMN IF EXISTS api_key_encrypted;
-- ALTER TABLE platform_connections DROP COLUMN IF EXISTS instance_url;
-- ALTER TABLE platform_connections DROP COLUMN IF EXISTS last_active_at;
-- ALTER TABLE platform_connections DROP COLUMN IF EXISTS poll_interval;
-- COMMIT;
