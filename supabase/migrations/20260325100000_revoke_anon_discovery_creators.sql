-- Revoke anon access to discovery_creators view
-- Security: anonymous users should not be able to query creator profiles directly.
-- Only authenticated users (logged-in) should have SELECT access.
-- Ref: DB-007 — principle of least privilege for PostgREST roles.

REVOKE SELECT ON discovery_creators FROM anon;

-- Ensure authenticated role still has access (idempotent)
GRANT SELECT ON discovery_creators TO authenticated;
