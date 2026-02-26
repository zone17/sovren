-- #274: TOCTOU race prevention via unique constraints
-- Prevents concurrent joinCircle from exceeding member limits
-- Prevents duplicate mentorship requests

-- Unique constraint: one membership per user per circle
-- This prevents duplicate inserts from concurrent joinCircle calls
CREATE UNIQUE INDEX IF NOT EXISTS idx_circle_members_unique_membership
  ON circle_members (circle_id, creator_id);

-- Unique constraint: one pending/active mentorship per mentor-mentee pair
-- Uses partial index to allow re-requests after completion/decline
CREATE UNIQUE INDEX IF NOT EXISTS idx_mentorships_unique_active
  ON mentorships (mentor_id, mentee_id)
  WHERE status IN ('pending', 'active');

-- Unique constraint: one active collaboration per content-creator pair
CREATE UNIQUE INDEX IF NOT EXISTS idx_collaborations_unique_active
  ON content_collaborators (content_id, creator_id)
  WHERE status IN ('invited', 'accepted');
