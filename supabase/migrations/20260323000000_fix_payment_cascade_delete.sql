-- Production Readiness Remediation: DB-005
-- Fix ON DELETE CASCADE on payments.recipient_id — financial records must never
-- be silently deleted when a user account is removed.
--
-- Change: CASCADE → RESTRICT for recipient_id and payer_id
-- This ensures payment records are preserved for financial audit trails.

-- Step 1: Drop existing foreign key constraints
DO $$ BEGIN
  -- Drop recipient_id CASCADE constraint
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payments_recipient_id_fkey'
    AND conrelid = 'payments'::regclass
  ) THEN
    ALTER TABLE payments DROP CONSTRAINT payments_recipient_id_fkey;
  END IF;

  -- Drop payer_id SET NULL constraint (upgrade to RESTRICT for consistency)
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payments_payer_id_fkey'
    AND conrelid = 'payments'::regclass
  ) THEN
    ALTER TABLE payments DROP CONSTRAINT payments_payer_id_fkey;
  END IF;
END $$;

-- Step 2: Re-add with RESTRICT — prevents deletion of users who have payment records
ALTER TABLE payments
  ADD CONSTRAINT payments_recipient_id_fkey
  FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE RESTRICT;

ALTER TABLE payments
  ADD CONSTRAINT payments_payer_id_fkey
  FOREIGN KEY (payer_id) REFERENCES users(id) ON DELETE RESTRICT;
