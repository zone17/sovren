-- =============================================================================
-- DB-003: Migrate Epic-009 creator_id columns from TEXT (nostr pubkey) to UUID
--         (user ID with FK to users.id)
--
-- Affected tables:
--   platform_connections, cross_posts, repurposed_content,
--   inbox_messages, platform_metrics_history
--
-- Strategy:
--   1. Add temporary UUID column creator_user_id to each table
--   2. Populate via lookup: users.id WHERE users.nostr_pubkey = creator_id
--   3. Drop old TEXT creator_id column
--   4. Rename creator_user_id -> creator_id
--   5. Add NOT NULL constraint and FK to users(id) ON DELETE RESTRICT
--
-- Rows with no matching user (nostr_pubkey not found in users) will have
-- creator_user_id = NULL. These are left nullable during population so the
-- migration does not fail on orphaned data. A WARNING comment below documents
-- how to audit them before enforcing NOT NULL in a follow-up migration.
-- =============================================================================

-- BEGIN removed: Supabase runs each migration in an implicit transaction

-- ---------------------------------------------------------------------------
-- 1. platform_connections
-- ---------------------------------------------------------------------------

ALTER TABLE platform_connections
  ADD COLUMN IF NOT EXISTS creator_user_id UUID;

UPDATE platform_connections pc
SET creator_user_id = u.id
FROM users u
WHERE u.nostr_pubkey = pc.creator_id
  AND pc.creator_user_id IS NULL;

-- Drop the UNIQUE constraint that references the old TEXT column before drop
ALTER TABLE platform_connections
  DROP CONSTRAINT IF EXISTS platform_connections_creator_id_platform_key;

-- Drop the old indexes on TEXT creator_id
DROP INDEX IF EXISTS idx_platform_connections_creator;

-- RLS dance: drop policies that reference creator_id before dropping the column
DROP POLICY IF EXISTS "platform_connections_select_own" ON platform_connections;
DROP POLICY IF EXISTS "platform_connections_service_role" ON platform_connections;

ALTER TABLE platform_connections
  DROP COLUMN IF EXISTS creator_id;

ALTER TABLE platform_connections
  RENAME COLUMN creator_user_id TO creator_id;

ALTER TABLE platform_connections
  ALTER COLUMN creator_id SET NOT NULL;

ALTER TABLE platform_connections
  ADD CONSTRAINT platform_connections_creator_id_fkey
    FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE RESTRICT;

ALTER TABLE platform_connections
  ADD CONSTRAINT platform_connections_creator_id_platform_key
    UNIQUE (creator_id, platform);

CREATE INDEX IF NOT EXISTS idx_platform_connections_creator
  ON platform_connections(creator_id);

-- RLS dance: recreate policies with UUID comparison (no ::text cast needed)
CREATE POLICY "platform_connections_service_role"
  ON platform_connections
  FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "platform_connections_select_own"
  ON platform_connections
  FOR SELECT
  USING (creator_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 2. cross_posts
-- ---------------------------------------------------------------------------

ALTER TABLE cross_posts
  ADD COLUMN IF NOT EXISTS creator_user_id UUID;

UPDATE cross_posts cp
SET creator_user_id = u.id
FROM users u
WHERE u.nostr_pubkey = cp.creator_id
  AND cp.creator_user_id IS NULL;

DROP INDEX IF EXISTS idx_cross_posts_creator;

-- RLS dance: drop policies that reference creator_id before dropping the column
DROP POLICY IF EXISTS "cross_posts_select_own" ON cross_posts;
DROP POLICY IF EXISTS "cross_posts_service_role" ON cross_posts;

ALTER TABLE cross_posts
  DROP COLUMN IF EXISTS creator_id;

ALTER TABLE cross_posts
  RENAME COLUMN creator_user_id TO creator_id;

ALTER TABLE cross_posts
  ALTER COLUMN creator_id SET NOT NULL;

ALTER TABLE cross_posts
  ADD CONSTRAINT cross_posts_creator_id_fkey
    FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_cross_posts_creator
  ON cross_posts(creator_id);

-- RLS dance: recreate policies with UUID comparison
CREATE POLICY "cross_posts_service_role"
  ON cross_posts
  FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "cross_posts_select_own"
  ON cross_posts
  FOR SELECT
  USING (creator_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 3. repurposed_content
-- ---------------------------------------------------------------------------

ALTER TABLE repurposed_content
  ADD COLUMN IF NOT EXISTS creator_user_id UUID;

UPDATE repurposed_content rc
SET creator_user_id = u.id
FROM users u
WHERE u.nostr_pubkey = rc.creator_id
  AND rc.creator_user_id IS NULL;

DROP INDEX IF EXISTS idx_repurposed_creator;

-- RLS dance: drop policies that reference creator_id before dropping the column
DROP POLICY IF EXISTS "repurposed_content_select_own" ON repurposed_content;
DROP POLICY IF EXISTS "repurposed_content_service_role" ON repurposed_content;

ALTER TABLE repurposed_content
  DROP COLUMN IF EXISTS creator_id;

ALTER TABLE repurposed_content
  RENAME COLUMN creator_user_id TO creator_id;

ALTER TABLE repurposed_content
  ALTER COLUMN creator_id SET NOT NULL;

ALTER TABLE repurposed_content
  ADD CONSTRAINT repurposed_content_creator_id_fkey
    FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_repurposed_creator
  ON repurposed_content(creator_id);

-- RLS dance: recreate policies with UUID comparison
CREATE POLICY "repurposed_content_service_role"
  ON repurposed_content
  FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "repurposed_content_select_own"
  ON repurposed_content
  FOR SELECT
  USING (creator_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 4. inbox_messages
-- ---------------------------------------------------------------------------

ALTER TABLE inbox_messages
  ADD COLUMN IF NOT EXISTS creator_user_id UUID;

UPDATE inbox_messages im
SET creator_user_id = u.id
FROM users u
WHERE u.nostr_pubkey = im.creator_id
  AND im.creator_user_id IS NULL;

-- Drop unique constraint and indexes that reference the old TEXT column
ALTER TABLE inbox_messages
  DROP CONSTRAINT IF EXISTS inbox_messages_creator_id_platform_platform_message_id_key;

DROP INDEX IF EXISTS idx_inbox_creator;
DROP INDEX IF EXISTS idx_inbox_creator_unread;
DROP INDEX IF EXISTS idx_inbox_creator_platform;

-- RLS dance: drop policies that reference creator_id before dropping the column
DROP POLICY IF EXISTS "inbox_messages_select_own" ON inbox_messages;
DROP POLICY IF EXISTS "inbox_messages_service_role" ON inbox_messages;

ALTER TABLE inbox_messages
  DROP COLUMN IF EXISTS creator_id;

ALTER TABLE inbox_messages
  RENAME COLUMN creator_user_id TO creator_id;

ALTER TABLE inbox_messages
  ALTER COLUMN creator_id SET NOT NULL;

ALTER TABLE inbox_messages
  ADD CONSTRAINT inbox_messages_creator_id_fkey
    FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE RESTRICT;

ALTER TABLE inbox_messages
  ADD CONSTRAINT inbox_messages_creator_id_platform_platform_message_id_key
    UNIQUE (creator_id, platform, platform_message_id);

CREATE INDEX IF NOT EXISTS idx_inbox_creator
  ON inbox_messages(creator_id);

CREATE INDEX IF NOT EXISTS idx_inbox_creator_unread
  ON inbox_messages(creator_id, is_read)
  WHERE is_read = false AND is_archived = false;

CREATE INDEX IF NOT EXISTS idx_inbox_creator_platform
  ON inbox_messages(creator_id, platform);

-- RLS dance: recreate policies with UUID comparison
CREATE POLICY "inbox_messages_service_role"
  ON inbox_messages
  FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "inbox_messages_select_own"
  ON inbox_messages
  FOR SELECT
  USING (creator_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 5. platform_metrics_history
-- ---------------------------------------------------------------------------

ALTER TABLE platform_metrics_history
  ADD COLUMN IF NOT EXISTS creator_user_id UUID;

UPDATE platform_metrics_history pmh
SET creator_user_id = u.id
FROM users u
WHERE u.nostr_pubkey = pmh.creator_id
  AND pmh.creator_user_id IS NULL;

-- Drop unique constraint and indexes that reference the old TEXT column
ALTER TABLE platform_metrics_history
  DROP CONSTRAINT IF EXISTS platform_metrics_history_creator_id_platform_recorded_at_key;

DROP INDEX IF EXISTS idx_platform_metrics_creator;
DROP INDEX IF EXISTS idx_platform_metrics_recorded;

-- RLS dance: drop policies that reference creator_id before dropping the column
DROP POLICY IF EXISTS "platform_metrics_history_select_own" ON platform_metrics_history;
DROP POLICY IF EXISTS "platform_metrics_history_service_role" ON platform_metrics_history;

ALTER TABLE platform_metrics_history
  DROP COLUMN IF EXISTS creator_id;

ALTER TABLE platform_metrics_history
  RENAME COLUMN creator_user_id TO creator_id;

ALTER TABLE platform_metrics_history
  ALTER COLUMN creator_id SET NOT NULL;

ALTER TABLE platform_metrics_history
  ADD CONSTRAINT platform_metrics_history_creator_id_fkey
    FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE RESTRICT;

ALTER TABLE platform_metrics_history
  ADD CONSTRAINT platform_metrics_history_creator_id_platform_recorded_at_key
    UNIQUE (creator_id, platform, recorded_at);

CREATE INDEX IF NOT EXISTS idx_platform_metrics_creator
  ON platform_metrics_history(creator_id);

CREATE INDEX IF NOT EXISTS idx_platform_metrics_recorded
  ON platform_metrics_history(recorded_at DESC);

-- RLS dance: recreate policies with UUID comparison
CREATE POLICY "platform_metrics_history_service_role"
  ON platform_metrics_history
  FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "platform_metrics_history_select_own"
  ON platform_metrics_history
  FOR SELECT
  USING (creator_id = auth.uid());

-- ---------------------------------------------------------------------------
-- NOTE: Orphaned rows audit
-- ---------------------------------------------------------------------------
-- If any rows had a creator_id TEXT value with no matching users.nostr_pubkey,
-- the NOT NULL constraint above will cause this transaction to ROLLBACK.
-- To audit orphaned rows before running, execute against a branch:
--
--   SELECT 'platform_connections' AS tbl, creator_id FROM platform_connections
--     WHERE creator_id NOT IN (SELECT nostr_pubkey FROM users WHERE nostr_pubkey IS NOT NULL)
--   UNION ALL
--   SELECT 'cross_posts', creator_id FROM cross_posts
--     WHERE creator_id NOT IN (SELECT nostr_pubkey FROM users WHERE nostr_pubkey IS NOT NULL)
--   UNION ALL
--   SELECT 'repurposed_content', creator_id FROM repurposed_content
--     WHERE creator_id NOT IN (SELECT nostr_pubkey FROM users WHERE nostr_pubkey IS NOT NULL)
--   UNION ALL
--   SELECT 'inbox_messages', creator_id FROM inbox_messages
--     WHERE creator_id NOT IN (SELECT nostr_pubkey FROM users WHERE nostr_pubkey IS NOT NULL)
--   UNION ALL
--   SELECT 'platform_metrics_history', creator_id FROM platform_metrics_history
--     WHERE creator_id NOT IN (SELECT nostr_pubkey FROM users WHERE nostr_pubkey IS NOT NULL);
--
-- Delete or reassign orphaned rows before applying this migration to production.
-- ---------------------------------------------------------------------------

-- COMMIT removed: Supabase runs each migration in an implicit transaction
