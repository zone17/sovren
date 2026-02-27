-- Discovery Creators View
-- Pre-joins creator_profiles + users + creators for flat PostgREST queries.
-- Resolves: cross-table .or() filter, FK hint path, embedded resource sort, ghost records.
--
-- SECURITY: This view bypasses RLS (views execute as owner, not caller).
-- We filter to active non-admin users and use security_barrier to prevent
-- the query planner from pushing user-supplied predicates past the WHERE.

CREATE OR REPLACE VIEW discovery_creators WITH (security_barrier = true) AS
SELECT
  cp.id,
  COALESCE(cp.bio, '') AS bio,
  COALESCE(cp.categories, ARRAY[]::text[]) AS categories,
  cp.created_at,
  u.id AS user_id,
  COALESCE(u.display_name, u.username, 'Anonymous') AS display_name,
  COALESCE(u.username, '') AS username,
  u.avatar_url,
  COALESCE(u.nip05_verified, false) AS nip05_verified,
  COALESCE(c.follower_count, 0) AS follower_count,
  COALESCE(c.content_count, 0) AS content_count,
  COALESCE(c.tags, ARRAY[]::text[]) AS tags,
  COALESCE(c.verified, false) AS verified
FROM creator_profiles cp
INNER JOIN users u ON cp.creator_id = u.id
LEFT JOIN creators c ON c.user_id = u.id
WHERE u.status = 'active'
  AND u.role != 'admin';

-- Views don't inherit RLS from base tables. Grant access for PostgREST roles.
GRANT SELECT ON discovery_creators TO anon, authenticated;
