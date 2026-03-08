-- ============================================================================
-- Fix reply_count trigger: add DELETE handler + bidirectional status transitions
-- Todo #627 (P2)
-- Squad B, 2026-03-07
-- ============================================================================
-- The existing update_reply_count() trigger (from 20260304000001) only handles:
--   - INSERT: increment parent reply_count
--   - UPDATE active->non-active: decrement parent reply_count
--
-- Missing:
--   1. Hard DELETE of a reply should decrement parent reply_count
--   2. UPDATE non-active->active (restore) should increment parent reply_count
--
-- This migration replaces the function and recreates the trigger to fire on
-- INSERT, UPDATE OF status, and DELETE.
--
-- Rollback:
--   -- Restore original function from 20260304000001
--   CREATE OR REPLACE FUNCTION update_reply_count() RETURNS TRIGGER AS $$
--   BEGIN
--     IF TG_OP = 'INSERT' AND NEW.parent_comment_id IS NOT NULL THEN
--       UPDATE comments SET reply_count = reply_count + 1
--       WHERE id = NEW.parent_comment_id;
--     ELSIF TG_OP = 'UPDATE' AND OLD.status = 'active' AND NEW.status != 'active'
--       AND NEW.parent_comment_id IS NOT NULL THEN
--       UPDATE comments SET reply_count = GREATEST(reply_count - 1, 0)
--       WHERE id = NEW.parent_comment_id;
--     END IF;
--     RETURN NEW;
--   END;
--   $$ LANGUAGE plpgsql;
--   DROP TRIGGER IF EXISTS trg_reply_count ON comments;
--   CREATE TRIGGER trg_reply_count
--     AFTER INSERT OR UPDATE OF status ON comments
--     FOR EACH ROW EXECUTE FUNCTION update_reply_count();
-- ============================================================================

-- Replace trigger function with DELETE + bidirectional status handling
-- SECURITY DEFINER: runs as function owner (superuser), not the invoking role
CREATE OR REPLACE FUNCTION update_reply_count()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- New reply inserted: increment parent reply_count
    IF NEW.parent_comment_id IS NOT NULL AND NEW.status = 'active' THEN
      UPDATE comments SET reply_count = reply_count + 1
      WHERE id = NEW.parent_comment_id;
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    -- Bidirectional status transitions on replies
    IF NEW.parent_comment_id IS NOT NULL THEN
      IF OLD.status = 'active' AND NEW.status != 'active' THEN
        -- active -> non-active (soft-delete, hide, moderate): decrement
        UPDATE comments SET reply_count = GREATEST(reply_count - 1, 0)
        WHERE id = NEW.parent_comment_id;
      ELSIF OLD.status != 'active' AND NEW.status = 'active' THEN
        -- non-active -> active (restore): increment
        UPDATE comments SET reply_count = reply_count + 1
        WHERE id = NEW.parent_comment_id;
      END IF;
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    -- Hard DELETE of a reply: decrement parent reply_count only if was active
    IF OLD.parent_comment_id IS NOT NULL AND OLD.status = 'active' THEN
      UPDATE comments SET reply_count = GREATEST(reply_count - 1, 0)
      WHERE id = OLD.parent_comment_id;
    END IF;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger to include DELETE event
DROP TRIGGER IF EXISTS trg_reply_count ON comments;
CREATE TRIGGER trg_reply_count
  AFTER INSERT OR UPDATE OF status OR DELETE ON comments
  FOR EACH ROW EXECUTE FUNCTION update_reply_count();
