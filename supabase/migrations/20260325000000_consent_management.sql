-- GDPR Consent Management — COMP-004
-- Creates the user_consents table with RLS policies.
-- Every consent grant and withdrawal is stored as a new row to preserve
-- the full audit trail required by GDPR Article 7(1).

-- ─────────────────────────────────────────────────────────────────────────────
-- Table
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_consents (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  consent_type VARCHAR(50) NOT NULL,
  version      VARCHAR(20) NOT NULL,
  granted_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  withdrawn_at TIMESTAMPTZ,
  ip_address   INET,
  user_agent   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Prevent duplicate active consents for the same type+version
  CONSTRAINT user_consents_unique_active
    EXCLUDE USING gist (
      user_id   WITH =,
      consent_type WITH =,
      version   WITH =
    ) WHERE (withdrawn_at IS NULL)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Indexes
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_user_consents_user_id
  ON user_consents (user_id);

CREATE INDEX IF NOT EXISTS idx_user_consents_type
  ON user_consents (consent_type);

CREATE INDEX IF NOT EXISTS idx_user_consents_active
  ON user_consents (user_id, consent_type)
  WHERE withdrawn_at IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE user_consents ENABLE ROW LEVEL SECURITY;

-- Users may only read their own consent records
CREATE POLICY user_consents_select_own
  ON user_consents
  FOR SELECT
  USING (user_id = auth.uid());

-- Users may only insert rows for themselves
CREATE POLICY user_consents_insert_own
  ON user_consents
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users may only update their own rows (e.g. set withdrawn_at)
CREATE POLICY user_consents_update_own
  ON user_consents
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Hard deletes are not allowed from the client — only cascade from users.id
-- No DELETE policy intentionally.

-- ─────────────────────────────────────────────────────────────────────────────
-- Comments
-- ─────────────────────────────────────────────────────────────────────────────

COMMENT ON TABLE  user_consents                  IS 'GDPR consent audit trail per user/type/version';
COMMENT ON COLUMN user_consents.consent_type     IS 'Logical consent category, e.g. marketing, analytics, terms_of_service';
COMMENT ON COLUMN user_consents.version          IS 'Policy document version the user consented to, e.g. 1.0, 2024-01';
COMMENT ON COLUMN user_consents.granted_at       IS 'Timestamp the user explicitly granted consent';
COMMENT ON COLUMN user_consents.withdrawn_at     IS 'Timestamp the user withdrew consent; NULL means still active';
COMMENT ON COLUMN user_consents.ip_address       IS 'Client IP at time of consent (stored for GDPR proof of consent)';
COMMENT ON COLUMN user_consents.user_agent       IS 'Browser/client user-agent at time of consent';
