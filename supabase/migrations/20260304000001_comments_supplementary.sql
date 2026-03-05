-- ============================================================================
-- Comments Supplementary Migration
-- Slice 6: Comments CRUD with Threading and Moderation
-- Squad B, Sprint 2, 2026-03-04
-- ============================================================================
-- This migration adds:
--   1. DELETE RLS policy (defense-in-depth; backend uses service_role)
--   2. Two-level threading BEFORE INSERT trigger
--   3. reply_count maintenance trigger
--   4. updated_at trigger
--   5. Composite partial index for efficient top-level comment queries
--
-- Rollback:
--   DROP INDEX IF EXISTS idx_comments_content_status_top_level;
--   DROP TRIGGER IF EXISTS set_comments_updated_at ON comments;
--   DROP TRIGGER IF EXISTS trg_reply_count ON comments;
--   DROP FUNCTION IF EXISTS update_reply_count();
--   DROP TRIGGER IF EXISTS trg_enforce_two_level_threading ON comments;
--   DROP FUNCTION IF EXISTS enforce_two_level_threading();
--   DROP POLICY IF EXISTS "comments_delete_own" ON comments;
-- ============================================================================

-- 1. DELETE RLS policy (defense-in-depth; service_role bypasses RLS)
CREATE POLICY "comments_delete_own" ON comments
  FOR DELETE USING (user_id = auth.uid());

-- 2. Two-level threading enforcement via BEFORE INSERT trigger
-- NOTE: CHECK constraints cannot contain subqueries in PostgreSQL.
-- Service-layer validation (CommentsService.createComment) is the primary guard.
-- This trigger provides database-level defense-in-depth.
CREATE OR REPLACE FUNCTION enforce_two_level_threading() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.parent_comment_id IS NOT NULL THEN
    PERFORM 1 FROM comments
    WHERE id = NEW.parent_comment_id AND parent_comment_id IS NOT NULL;
    IF FOUND THEN
      RAISE EXCEPTION 'Cannot reply to a reply (two-level threading only)'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_enforce_two_level_threading
  BEFORE INSERT ON comments
  FOR EACH ROW EXECUTE FUNCTION enforce_two_level_threading();

-- 3. reply_count maintenance trigger
-- Increments on INSERT of a reply, decrements when a reply is soft-deleted.
CREATE OR REPLACE FUNCTION update_reply_count() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.parent_comment_id IS NOT NULL THEN
    UPDATE comments SET reply_count = reply_count + 1
    WHERE id = NEW.parent_comment_id;
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'active' AND NEW.status != 'active'
    AND NEW.parent_comment_id IS NOT NULL THEN
    UPDATE comments SET reply_count = GREATEST(reply_count - 1, 0)
    WHERE id = NEW.parent_comment_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_reply_count
  AFTER INSERT OR UPDATE OF status ON comments
  FOR EACH ROW EXECUTE FUNCTION update_reply_count();

-- 4. updated_at trigger (reuses the project-wide update_updated_at() function)
-- Guard: baseline migration may already create this trigger; DROP IF EXISTS prevents duplicate.
DROP TRIGGER IF EXISTS set_comments_updated_at ON comments;
CREATE TRIGGER set_comments_updated_at
  BEFORE UPDATE ON comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 5. Fix parent_comment_id FK: CASCADE conflicts with soft-delete model.
-- Baseline uses ON DELETE CASCADE which would hard-delete all replies if a parent is
-- hard-deleted (e.g., admin SQL cleanup). Change to SET NULL to preserve reply data.
ALTER TABLE comments DROP CONSTRAINT IF EXISTS comments_parent_comment_id_fkey;
ALTER TABLE comments
  ADD CONSTRAINT comments_parent_comment_id_fkey
  FOREIGN KEY (parent_comment_id) REFERENCES comments(id) ON DELETE SET NULL;

-- 6. Composite partial index for efficient top-level comment listing
-- Regular CREATE INDEX (not CONCURRENTLY) — table has zero rows at migration time,
-- lock duration is negligible. CONCURRENTLY cannot run inside a transaction block.
CREATE INDEX idx_comments_content_status_top_level
  ON comments (content_id, created_at DESC)
  WHERE status = 'active' AND parent_comment_id IS NULL;
