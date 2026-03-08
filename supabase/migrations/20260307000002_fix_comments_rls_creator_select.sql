-- ============================================================================
-- Fix comments RLS: allow content creators to SELECT all comments for moderation
-- Todo #631 (P2)
-- Squad B, 2026-03-07
-- ============================================================================
-- The baseline SELECT policy "comments_select_public" only allows:
--   FOR SELECT USING (status = 'active')
--
-- This means content creators cannot see hidden/deleted/moderated comments on
-- their own content, which breaks the moderation workflow. The UPDATE policy
-- (comments_update_own) only allows user_id = auth.uid(), so creators can't
-- moderate either, but that's a separate concern.
--
-- Fix: Replace the SELECT policy to add an OR condition for content ownership.
-- Content owners can see ALL comments (any status) on their content.
-- Everyone else can only see active comments (preserving existing behavior).
--
-- Pattern: EXISTS subquery on content table (content.creator_id = auth.uid())
--
-- Rollback:
--   DROP POLICY IF EXISTS "comments_select_public" ON comments;
--   CREATE POLICY "comments_select_public" ON comments
--     FOR SELECT USING (status = 'active');
-- ============================================================================

-- Drop and recreate the SELECT policy with creator ownership check
DROP POLICY IF EXISTS "comments_select_public" ON comments;

CREATE POLICY "comments_select_public" ON comments
  FOR SELECT USING (
    status = 'active'
    OR EXISTS (
      SELECT 1 FROM content
      WHERE content.id = comments.content_id
        AND content.creator_id = auth.uid()
    )
  );

-- Also fix the UPDATE policy to allow content creators to moderate comments
-- (e.g., change status to 'hidden' or 'moderated'). Without this, the SELECT
-- grant is pointless — creators can see but not act on comments.
DROP POLICY IF EXISTS "comments_update_own" ON comments;

CREATE POLICY "comments_update_own" ON comments
  FOR UPDATE USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM content
      WHERE content.id = comments.content_id
        AND content.creator_id = auth.uid()
    )
  );
