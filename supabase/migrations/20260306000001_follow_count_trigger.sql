BEGIN;

-- creators table has follower_count but not following_count — add it
ALTER TABLE creators ADD COLUMN IF NOT EXISTS following_count INTEGER DEFAULT 0;

-- Follow count trigger on creators table
CREATE OR REPLACE FUNCTION update_follow_counts()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE creators SET follower_count = COALESCE(follower_count, 0) + 1
        WHERE user_id = NEW.following_id;
        UPDATE creators SET following_count = COALESCE(following_count, 0) + 1
        WHERE user_id = NEW.follower_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE creators SET follower_count = GREATEST(COALESCE(follower_count, 0) - 1, 0)
        WHERE user_id = OLD.following_id;
        UPDATE creators SET following_count = GREATEST(COALESCE(following_count, 0) - 1, 0)
        WHERE user_id = OLD.follower_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_follow_counts ON followers;
CREATE TRIGGER trg_update_follow_counts
    AFTER INSERT OR DELETE ON followers
    FOR EACH ROW EXECUTE FUNCTION update_follow_counts();

-- RLS policies for followers table
-- Note: baseline enables RLS on followers but adds no policies — add them here
CREATE POLICY followers_select_all ON followers
    FOR SELECT USING (TRUE);
CREATE POLICY followers_insert_auth ON followers
    FOR INSERT WITH CHECK (auth.uid() = follower_id);
CREATE POLICY followers_delete_own ON followers
    FOR DELETE USING (auth.uid() = follower_id);

-- Backfill existing follow counts
UPDATE creators c SET
    follower_count = (SELECT COUNT(*) FROM followers f WHERE f.following_id = c.user_id),
    following_count = (SELECT COUNT(*) FROM followers f WHERE f.follower_id = c.user_id);

COMMIT;
