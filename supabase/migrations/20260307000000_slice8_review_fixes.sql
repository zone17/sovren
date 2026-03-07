-- =============================================================================
-- Slice 8 Review Fixes
-- Fixes: #724 (create_circle_atomic RPC), #725 (uuid_generate_v4 → gen_random_uuid),
--        #726 (RLS policy idempotency), #730 (missing community indexes),
--        #740 (REPLICA IDENTITY FULL WAL amplification), #747 (entity_type CHECK),
--        #748 (trigger silent on missing creators row), #756 (unbatched backfill)
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Fix #725: Change uuid_generate_v4() → gen_random_uuid() on notifications
-- (uuid-ossp extension not guaranteed in Supabase; pgcrypto/gen_random_uuid is)
-- ---------------------------------------------------------------------------
ALTER TABLE notifications
    ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- ---------------------------------------------------------------------------
-- Fix #726: Make RLS policies idempotent — DROP before CREATE for all
--           policies defined in the Slice 8 migrations.
--
-- Policies from 20260306000000_notifications.sql:
--   notifications_select_own, notifications_update_own,
--   notifications_delete_own, notifications_insert_service
--
-- Policies from 20260306000001_follow_count_trigger.sql:
--   followers_select_all, followers_insert_auth, followers_delete_own
-- ---------------------------------------------------------------------------

-- notifications policies
DROP POLICY IF EXISTS notifications_select_own ON notifications;
DROP POLICY IF EXISTS notifications_update_own ON notifications;
DROP POLICY IF EXISTS notifications_delete_own ON notifications;
DROP POLICY IF EXISTS notifications_insert_service ON notifications;

CREATE POLICY notifications_select_own ON notifications
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY notifications_update_own ON notifications
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY notifications_delete_own ON notifications
    FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY notifications_insert_service ON notifications
    FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- followers policies
DROP POLICY IF EXISTS followers_select_all ON followers;
DROP POLICY IF EXISTS followers_insert_auth ON followers;
DROP POLICY IF EXISTS followers_delete_own ON followers;

CREATE POLICY followers_select_all ON followers
    FOR SELECT USING (TRUE);
CREATE POLICY followers_insert_auth ON followers
    FOR INSERT WITH CHECK (auth.uid() = follower_id);
CREATE POLICY followers_delete_own ON followers
    FOR DELETE USING (auth.uid() = follower_id);

-- ---------------------------------------------------------------------------
-- Fix #730: Add missing database indexes on community tables
-- Note: additional_tables.sql already defines some indexes with different names;
--       these named indexes are added with IF NOT EXISTS guards for safety.
--       circle_members uses creator_id (not user_id) — index targets that column.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_circle_members_circle_id   ON circle_members(circle_id);
CREATE INDEX IF NOT EXISTS idx_circle_members_user_id     ON circle_members(creator_id);
CREATE INDEX IF NOT EXISTS idx_circle_posts_circle_id     ON circle_posts(circle_id);
CREATE INDEX IF NOT EXISTS idx_mentorships_mentor_id      ON mentorships(mentor_id);
CREATE INDEX IF NOT EXISTS idx_mentorships_mentee_id      ON mentorships(mentee_id);
CREATE INDEX IF NOT EXISTS idx_mentor_profiles_user_id    ON mentor_profiles(creator_id);

-- ---------------------------------------------------------------------------
-- Fix #740: Revert REPLICA IDENTITY FULL on notifications table.
-- FULL was set in 20260306000000_notifications.sql for Realtime UPDATE events,
-- but it causes WAL amplification (full row on every UPDATE vs PK only).
-- DEFAULT is sufficient — Supabase Realtime works with DEFAULT + publication.
-- ---------------------------------------------------------------------------
ALTER TABLE notifications REPLICA IDENTITY DEFAULT;

-- ---------------------------------------------------------------------------
-- Fix #747: Add entity_type CHECK constraint on notifications.
-- Values observed in backend source (NotificationPersistenceService.ts):
--   'follow', 'comment', 'mentorship', 'circle'
-- Adding 'content' and 'system' as forward-compatible values.
-- entity_type is nullable, so NULL must also be allowed.
-- ---------------------------------------------------------------------------
ALTER TABLE notifications
    ADD CONSTRAINT notifications_entity_type_check
    CHECK (entity_type IS NULL OR entity_type IN (
        'circle', 'mentorship', 'follow', 'content', 'system', 'comment'
    ));

-- ---------------------------------------------------------------------------
-- Fix #748: Add WARNING log to update_follow_counts() trigger for missing
--           creators row — prevents silent no-op when followed user has no
--           creators profile.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_follow_counts()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE creators SET follower_count = follower_count + 1
        WHERE user_id = NEW.following_id;
        IF NOT FOUND THEN
            RAISE WARNING 'No creator row found for user_id=%', NEW.following_id;
        END IF;
        UPDATE creators SET following_count = following_count + 1
        WHERE user_id = NEW.follower_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE creators SET follower_count = GREATEST(follower_count - 1, 0)
        WHERE user_id = OLD.following_id;
        IF NOT FOUND THEN
            RAISE WARNING 'No creator row found for user_id=%', OLD.following_id;
        END IF;
        UPDATE creators SET following_count = GREATEST(following_count - 1, 0)
        WHERE user_id = OLD.follower_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- Fix #756: Replace unbatched backfill in follow_count migration with a
--           batched loop to avoid long-running lock on the creators table.
--
-- The original 20260306000001_follow_count_trigger.sql runs:
--   UPDATE creators c SET follower_count = ..., following_count = ...
-- which is a full-table scan holding a lock for the duration.
--
-- This DO block re-runs the backfill in 1,000-row batches, only touching
-- rows where follower_count IS NULL (i.e., rows not yet backfilled by the
-- original migration on a fresh database).  On an already-backfilled DB
-- it exits immediately after the first iteration (ROW_COUNT = 0).
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    batch_size INT := 1000;
    affected   INT;
BEGIN
    LOOP
        UPDATE creators
        SET
            follower_count  = (SELECT COUNT(*) FROM followers f WHERE f.following_id = creators.user_id),
            following_count = (SELECT COUNT(*) FROM followers f WHERE f.follower_id  = creators.user_id)
        WHERE id IN (
            SELECT id FROM creators
            WHERE follower_count IS NULL
            LIMIT batch_size
        );
        GET DIAGNOSTICS affected = ROW_COUNT;
        EXIT WHEN affected = 0;
    END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Fix #724: Add create_circle_atomic RPC function.
-- Called by CreatorCircleService.createCircle() via supabase.rpc(...)
-- Parameters match the call in packages/backend/src/services/community/CreatorCircleService.ts:
--   p_name, p_description, p_niche, p_max_members, p_created_by
-- Returns the new circle's UUID as TEXT.
-- NOTE: circle_members.role CHECK is ('admin', 'member') — 'owner' is not a
--       valid value.  The first member is inserted with role='admin'.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_circle_atomic(
    p_name        TEXT,
    p_description TEXT,
    p_niche       TEXT,
    p_max_members INT,
    p_created_by  UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_circle_id UUID;
BEGIN
    -- 1. Insert the circle record
    INSERT INTO creator_circles (name, description, niche, max_members, created_by)
    VALUES (p_name, p_description, p_niche, p_max_members, p_created_by)
    RETURNING id INTO v_circle_id;

    -- 2. Insert the creator as the first member (admin role)
    --    circle_members.role CHECK: ('admin', 'member')
    INSERT INTO circle_members (circle_id, creator_id, role)
    VALUES (v_circle_id, p_created_by, 'admin');

    RETURN v_circle_id::TEXT;
END;
$$;

COMMIT;
