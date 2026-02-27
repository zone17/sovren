-- Discovery Creators View
-- Pre-joins creator_profiles + users + creators for flat PostgREST queries.
-- Resolves: cross-table .or() filter, FK hint path, embedded resource sort, ghost records.

CREATE OR REPLACE VIEW discovery_creators AS
SELECT
  cp.id,
  cp.bio,
  cp.categories,
  cp.created_at,
  u.id AS user_id,
  u.display_name,
  u.username,
  u.avatar_url,
  u.nip05_verified,
  COALESCE(c.follower_count, 0) AS follower_count,
  COALESCE(c.content_count, 0) AS content_count,
  COALESCE(c.tags, ARRAY[]::text[]) AS tags,
  COALESCE(c.verified, false) AS verified
FROM creator_profiles cp
INNER JOIN users u ON cp.creator_id = u.id
LEFT JOIN creators c ON c.user_id = u.id;

-- Views don't inherit RLS from base tables. Grant access for PostgREST roles.
GRANT SELECT ON discovery_creators TO anon, authenticated;
