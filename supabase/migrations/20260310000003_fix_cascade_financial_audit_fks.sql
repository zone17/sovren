-- P1-DB-002: Fix CASCADE on financial audit foreign keys
-- Problem: Deleting a payment cascades deletion to audit trail records.
--          This destroys compliance records and makes incident investigation impossible.
--
-- Affected tables (all have ON DELETE CASCADE from payments):
--   payment_events         — state transition audit trail
--   payment_retry_attempts — retry history
--   payment_lock_events    — lock acquisition audit
--   payment_verifications  — payment verification records
--   payment_status_history — status change log
--
-- Fix: Change FK to ON DELETE RESTRICT so that payments cannot be deleted
--      while audit trail records exist. Financial records must be retained.
--
-- Note: Supabase/PostgreSQL requires dropping and recreating the FK constraint
--       to change the ON DELETE behavior. The constraint name is derived from
--       the table/column name pattern PostgreSQL generates by default.

-- =============================================================================
-- 1. payment_events.payment_id → payments(id)
-- =============================================================================
ALTER TABLE payment_events
  DROP CONSTRAINT IF EXISTS payment_events_payment_id_fkey;

ALTER TABLE payment_events
  ADD CONSTRAINT payment_events_payment_id_fkey
    FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE RESTRICT;

-- =============================================================================
-- 2. payment_retry_attempts.payment_id → payments(id)
-- =============================================================================
ALTER TABLE payment_retry_attempts
  DROP CONSTRAINT IF EXISTS payment_retry_attempts_payment_id_fkey;

ALTER TABLE payment_retry_attempts
  ADD CONSTRAINT payment_retry_attempts_payment_id_fkey
    FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE RESTRICT;

-- =============================================================================
-- 3. payment_lock_events.payment_id → payments(id)
-- =============================================================================
ALTER TABLE payment_lock_events
  DROP CONSTRAINT IF EXISTS payment_lock_events_payment_id_fkey;

ALTER TABLE payment_lock_events
  ADD CONSTRAINT payment_lock_events_payment_id_fkey
    FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE RESTRICT;

-- =============================================================================
-- 4. payment_verifications.payment_id → payments(id)
--    Originally nullable — keep nullable, add RESTRICT
-- =============================================================================
ALTER TABLE payment_verifications
  DROP CONSTRAINT IF EXISTS payment_verifications_payment_id_fkey;

ALTER TABLE payment_verifications
  ADD CONSTRAINT payment_verifications_payment_id_fkey
    FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE RESTRICT;

-- =============================================================================
-- 5. payment_status_history.payment_id → payments(id)
--    Originally nullable — keep nullable, add RESTRICT
-- =============================================================================
ALTER TABLE payment_status_history
  DROP CONSTRAINT IF EXISTS payment_status_history_payment_id_fkey;

ALTER TABLE payment_status_history
  ADD CONSTRAINT payment_status_history_payment_id_fkey
    FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE RESTRICT;
