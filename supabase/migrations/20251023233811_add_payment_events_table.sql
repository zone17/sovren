-- Migration: Add payment_events table for payment state machine audit trail
-- Story #001: Define Payment State Machine Types and Enums
-- Date: 2025-10-23
-- Description: Creates payment_events table for tracking all payment state transitions
--              with comprehensive audit trail and event sourcing capabilities.

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create payment_events table
CREATE TABLE IF NOT EXISTS payment_events (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Foreign key to payments table
  payment_id UUID NOT NULL,

  -- State information
  state VARCHAR(20) NOT NULL CHECK (
    state IN ('pending', 'processing', 'completed', 'failed', 'expired', 'refunded')
  ),
  previous_state VARCHAR(20) CHECK (
    previous_state IN ('pending', 'processing', 'completed', 'failed', 'expired', 'refunded')
  ),

  -- Timestamp when state transition occurred
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Metadata for additional event information (error details, webhook data, etc.)
  metadata JSONB DEFAULT '{}'::jsonb,

  -- User who triggered this event (if applicable)
  user_id UUID,

  -- Error message if state change was due to failure
  error_message TEXT,

  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Foreign key constraints
  CONSTRAINT fk_payment_events_payment
    FOREIGN KEY (payment_id)
    REFERENCES payments(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_payment_events_user
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE SET NULL
);

-- Create indexes for optimal query performance
CREATE INDEX idx_payment_events_payment_id
  ON payment_events(payment_id);

CREATE INDEX idx_payment_events_state
  ON payment_events(state);

CREATE INDEX idx_payment_events_timestamp
  ON payment_events(timestamp DESC);

CREATE INDEX idx_payment_events_user_id
  ON payment_events(user_id)
  WHERE user_id IS NOT NULL;

-- Create composite index for common queries
CREATE INDEX idx_payment_events_payment_timestamp
  ON payment_events(payment_id, timestamp DESC);

-- Add comment to table
COMMENT ON TABLE payment_events IS 'Audit trail for payment state transitions. Implements event sourcing for payment state machine.';

-- Add comments to columns
COMMENT ON COLUMN payment_events.id IS 'Unique event identifier';
COMMENT ON COLUMN payment_events.payment_id IS 'Reference to the payment this event belongs to';
COMMENT ON COLUMN payment_events.state IS 'Current payment state after this event';
COMMENT ON COLUMN payment_events.previous_state IS 'Previous payment state before this event (null for initial event)';
COMMENT ON COLUMN payment_events.timestamp IS 'When the state transition occurred';
COMMENT ON COLUMN payment_events.metadata IS 'Additional event data (error details, webhook payload, etc.)';
COMMENT ON COLUMN payment_events.user_id IS 'User who triggered this event (if applicable)';
COMMENT ON COLUMN payment_events.error_message IS 'Error message if transition was due to failure';
COMMENT ON COLUMN payment_events.created_at IS 'When this event record was created in the database';

-- Add row-level security (RLS) policies
ALTER TABLE payment_events ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own payment events
CREATE POLICY payment_events_select_own
  ON payment_events
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR
    payment_id IN (
      SELECT id FROM payments WHERE user_id = auth.uid()
    )
  );

-- Policy: Only system can insert payment events (backend service)
-- Note: This will be updated when we implement service roles
CREATE POLICY payment_events_insert_system
  ON payment_events
  FOR INSERT
  WITH CHECK (true); -- Temporarily allow all inserts; will restrict to service role

-- Policy: No direct updates allowed (events are immutable)
CREATE POLICY payment_events_no_update
  ON payment_events
  FOR UPDATE
  USING (false);

-- Policy: No direct deletes allowed (events are permanent audit trail)
CREATE POLICY payment_events_no_delete
  ON payment_events
  FOR DELETE
  USING (false);

-- Create function to get payment event history
CREATE OR REPLACE FUNCTION get_payment_event_history(p_payment_id UUID)
RETURNS TABLE(
  id UUID,
  state VARCHAR(20),
  previous_state VARCHAR(20),
  timestamp TIMESTAMPTZ,
  metadata JSONB,
  error_message TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    pe.id,
    pe.state,
    pe.previous_state,
    pe.timestamp,
    pe.metadata,
    pe.error_message
  FROM payment_events pe
  WHERE pe.payment_id = p_payment_id
  ORDER BY pe.timestamp ASC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION get_payment_event_history(UUID) TO authenticated;

-- Add comment to function
COMMENT ON FUNCTION get_payment_event_history(UUID) IS 'Get complete event history for a payment, ordered chronologically';

-- Update payments table to add state machine fields (if not exists)
DO $$
BEGIN
  -- Add state column (replaces status)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'state'
  ) THEN
    ALTER TABLE payments ADD COLUMN state VARCHAR(20) DEFAULT 'pending';
    UPDATE payments SET state = status WHERE status IS NOT NULL;
  END IF;

  -- Add expires_at column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'expires_at'
  ) THEN
    ALTER TABLE payments ADD COLUMN expires_at TIMESTAMPTZ;
  END IF;

  -- Add retry_count column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'retry_count'
  ) THEN
    ALTER TABLE payments ADD COLUMN retry_count INTEGER DEFAULT 0;
  END IF;

  -- Add last_error column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'last_error'
  ) THEN
    ALTER TABLE payments ADD COLUMN last_error TEXT;
  END IF;

  -- Add metadata column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE payments ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
  END IF;
END$$;

-- Add check constraint to payments.state
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payments_state_check'
  ) THEN
    ALTER TABLE payments
      ADD CONSTRAINT payments_state_check
      CHECK (state IN ('pending', 'processing', 'completed', 'failed', 'expired', 'refunded'));
  END IF;
END$$;

-- Create trigger to automatically create payment events on state change
CREATE OR REPLACE FUNCTION payment_state_change_trigger()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create event if state actually changed
  IF (TG_OP = 'INSERT') OR (OLD.state IS DISTINCT FROM NEW.state) THEN
    INSERT INTO payment_events (
      payment_id,
      state,
      previous_state,
      timestamp,
      metadata,
      user_id,
      error_message
    ) VALUES (
      NEW.id,
      NEW.state,
      CASE WHEN TG_OP = 'UPDATE' THEN OLD.state ELSE NULL END,
      NOW(),
      COALESCE(NEW.metadata, '{}'::jsonb),
      NEW.user_id,
      NEW.last_error
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on payments table
DROP TRIGGER IF EXISTS payment_state_change ON payments;
CREATE TRIGGER payment_state_change
  AFTER INSERT OR UPDATE OF state
  ON payments
  FOR EACH ROW
  EXECUTE FUNCTION payment_state_change_trigger();

COMMENT ON TRIGGER payment_state_change ON payments IS 'Automatically creates payment event when payment state changes';
