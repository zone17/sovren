-- Migration: 20260220300400_fix_review_309_dispute_transition.sql
-- #309 (P1): Allow escrow_funded -> disputed state transition
--
-- The MarketplaceService.disputeOrder() already checks:
--   if (!['escrow_funded', 'in_progress'].includes(order.status))
-- and uses:
--   .in('status', ['escrow_funded', 'in_progress'])
--
-- But the DB trigger transition_order_state() (in 20260220100300) only allows:
--   "in_progress": ["completed", "disputed"]
--   "escrow_funded": ["in_progress", "refunded"]
--
-- This means disputeOrder() fails at DB level for escrow_funded orders.
-- Fix: Add 'disputed' to the escrow_funded transitions.

CREATE OR REPLACE FUNCTION transition_order_state()
RETURNS TRIGGER AS $$
DECLARE
  valid_transitions JSONB := '{
    "pending": ["escrow_funded", "expired"],
    "escrow_funded": ["in_progress", "refunded", "disputed"],
    "in_progress": ["completed", "disputed"],
    "disputed": ["completed", "refunded"],
    "completed": [],
    "refunded": [],
    "expired": []
  }'::jsonb;
  allowed_states JSONB;
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  allowed_states := valid_transitions -> OLD.status;
  IF NOT allowed_states ? NEW.status THEN
    RAISE EXCEPTION 'Invalid order state transition: % -> %', OLD.status, NEW.status;
  END IF;

  -- Auto-set lifecycle timestamps on valid transitions
  IF NEW.status = 'escrow_funded' THEN NEW.funded_at := now(); END IF;
  IF NEW.status = 'completed' THEN NEW.completed_at := now(); END IF;
  IF NEW.status = 'disputed' THEN NEW.disputed_at := now(); END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- DOWN
-- Restore original function without escrow_funded -> disputed
-- CREATE OR REPLACE FUNCTION transition_order_state() ... (see 20260220100300)
