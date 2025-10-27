-- Migration: Add Invoice Expiration Support
-- Story: #003 - Add Invoice Expiration Handling to State Machine
-- Created: 2025-10-23

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Ensure payments table has expires_at column
-- (This might already exist from previous migrations, so use IF NOT EXISTS pattern)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'payments'
    AND column_name = 'expires_at'
  ) THEN
    ALTER TABLE payments ADD COLUMN expires_at INTEGER NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW() + INTERVAL '24 hours');
  END IF;
END $$;

-- Create index on expires_at for efficient expiration queries
CREATE INDEX IF NOT EXISTS idx_payments_expires_at
  ON payments(expires_at)
  WHERE state = 'pending';

-- Create composite index for expiration check query optimization
CREATE INDEX IF NOT EXISTS idx_payments_pending_expired
  ON payments(state, expires_at)
  WHERE state = 'pending';

-- Add helpful comment
COMMENT ON INDEX idx_payments_pending_expired IS
  'Optimizes invoice expiration queries by indexing pending payments sorted by expiration time';

-- Grant necessary permissions (adjust role name as needed)
-- GRANT SELECT, UPDATE ON payments TO authenticated;
-- GRANT SELECT, INSERT ON payment_events TO authenticated;
