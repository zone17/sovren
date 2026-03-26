-- Migration: Add email column to users table
-- Finding: COMP-010 — email column referenced in UserProfileSchema and email-integration-service
--           but absent from the baseline schema (only email_verified BOOLEAN existed).
-- Impact: INSERT/UPDATE queries that set email silently discard the value or fail on strict
--         database drivers. Email notifications and newsletter integrations cannot store
--         the user's address.
-- Resolution: Add email VARCHAR(255) with a UNIQUE constraint (emails must be globally unique
--             per user) and a format-check constraint matching RFC 5321 basics. Nullable
--             because existing rows have no email and NOSTR-native users may never provide one.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email VARCHAR(255) UNIQUE,
  ADD CONSTRAINT users_email_format
    CHECK (email IS NULL OR email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$');

-- Index for fast email lookup (login, newsletter, notification lookups)
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email) WHERE email IS NOT NULL;

COMMENT ON COLUMN users.email IS
  'Optional user email address. Used for notification delivery and newsletter integration. '
  'Nullable — NOSTR-native users are not required to provide an email. '
  'Unique across all users. Retention: see docs/compliance/DATA_RETENTION_POLICY.md §2.2.';
