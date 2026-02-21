-- Migration: 20260220100300_epic010_marketplace.sql
-- EPIC-010: Creator Network — Service Marketplace with Custodial Lightning Escrow
--
-- Escrow design (per ADR-025 — Custodial Escrow):
-- - NOT HODL invoices (HTLC max ~14 days — insufficient for 30-day escrow)
-- - Custodial: buyer pays standard LNbits invoice → Sovren wallet
-- - Upon completion, Sovren pays out to seller's Lightning address
-- - Three-layer payment detection: webhook (primary) + BullMQ poll (backup) + user-triggered
--
-- State machine (enforced by trg_order_state_machine trigger):
-- pending → escrow_funded, expired
-- escrow_funded → in_progress, refunded  (NOT expired — funds held must be refunded)
-- in_progress → completed, disputed
-- disputed → completed, refunded
-- completed, refunded, expired → [] (terminal states)
--
-- Financial table safety (per data-integrity-guardian):
-- listing_id, buyer_id, seller_id use ON DELETE RESTRICT
-- Financial records must never cascade-delete when users are removed

-- UP

CREATE TABLE service_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service_type TEXT NOT NULL
    CHECK (service_type IN ('editing', 'writing', 'design', 'consulting', 'other')),
  title TEXT NOT NULL,
  description TEXT,
  price_sats BIGINT NOT NULL CHECK (price_sats > 0),
  portfolio_urls TEXT[] DEFAULT '{}',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE service_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES service_listings(id) ON DELETE RESTRICT,
  buyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'escrow_funded', 'in_progress',
                      'completed', 'disputed', 'refunded', 'expired')),
  escrow_invoice_id TEXT,
  escrow_payment_hash TEXT,
  amount_sats BIGINT NOT NULL,
  idempotency_key UUID NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  funded_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  disputed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '30 days')
);

-- Escrow state machine trigger
-- Enforces valid state transitions at the database level
-- escrow_funded cannot -> expired: custodial funds must be returned (→ refunded)
CREATE OR REPLACE FUNCTION transition_order_state()
RETURNS TRIGGER AS $$
DECLARE
  valid_transitions JSONB := '{
    "pending": ["escrow_funded", "expired"],
    "escrow_funded": ["in_progress", "refunded"],
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

CREATE TRIGGER trg_order_state_machine
  BEFORE UPDATE ON service_orders
  FOR EACH ROW EXECUTE FUNCTION transition_order_state();

CREATE TABLE order_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES service_orders(id) UNIQUE,
  reviewer_id UUID NOT NULL REFERENCES auth.users(id),
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review_text TEXT CHECK (char_length(review_text) <= 2000),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Updated_at trigger for service_listings
CREATE TRIGGER trg_service_listings_updated_at
  BEFORE UPDATE ON service_listings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS: service_listings
ALTER TABLE service_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active listings"
  ON service_listings FOR SELECT USING (active = true);

CREATE POLICY "Creator manages own listings"
  ON service_listings FOR ALL USING (creator_id = (select auth.uid()));

-- RLS: service_orders
ALTER TABLE service_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Buyer or seller can view their orders"
  ON service_orders FOR SELECT USING (
    buyer_id = (select auth.uid()) OR seller_id = (select auth.uid())
  );

CREATE POLICY "Buyer can create order"
  ON service_orders FOR INSERT WITH CHECK (buyer_id = (select auth.uid()));

CREATE POLICY "Participants can update order"
  ON service_orders FOR UPDATE USING (
    buyer_id = (select auth.uid()) OR seller_id = (select auth.uid())
  );

-- RLS: order_reviews
ALTER TABLE order_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view reviews"
  ON order_reviews FOR SELECT USING (true);

CREATE POLICY "Buyer can review completed order"
  ON order_reviews FOR INSERT WITH CHECK (
    reviewer_id = (select auth.uid())
    AND order_id IN (
      SELECT id FROM service_orders
      WHERE buyer_id = (select auth.uid()) AND status = 'completed'
    )
  );

-- Indexes
CREATE INDEX idx_listings_creator ON service_listings(creator_id);
CREATE INDEX idx_listings_type_active ON service_listings(service_type, active) WHERE active = true;
CREATE INDEX idx_orders_buyer ON service_orders(buyer_id);
CREATE INDEX idx_orders_seller ON service_orders(seller_id);
CREATE INDEX idx_orders_status ON service_orders(status);
-- Partial index for expiry processing (only unresolved orders)
CREATE INDEX idx_orders_expires ON service_orders(expires_at)
  WHERE status IN ('pending', 'escrow_funded');

-- DOWN (run in reverse order)
-- DROP TRIGGER IF EXISTS trg_order_state_machine ON service_orders;
-- DROP FUNCTION IF EXISTS transition_order_state();
-- DROP TABLE IF EXISTS order_reviews CASCADE;
-- DROP TABLE IF EXISTS service_orders CASCADE;
-- DROP TABLE IF EXISTS service_listings CASCADE;
