-- Migration: 20260220100400_epic010_security_hardening.sql
-- EPIC-010: Security hardening for marketplace and collaborative content
--
-- Addresses security audit findings:
--   M-4: Increase review_text limit to 10000 chars
--   M-6: Scope idempotency_key to (buyer_id, idempotency_key)
--   C-1: Add release_status/release_attempts for payout-first escrow completion
--   C-6: Add revenue_split_ledger and revenue_split_payments tables
--
-- All changes are ADDITIVE to avoid breaking existing data.

-- UP

-- ============================================================================
-- M-4: Increase review_text length limit from 2000 to 10000 characters
-- The original 2000-char limit was set by a linter change; correct limit per
-- security review is 10000 to match the interface specification.
-- ============================================================================
ALTER TABLE order_reviews
  DROP CONSTRAINT IF EXISTS order_reviews_review_text_check;

ALTER TABLE order_reviews
  ADD CONSTRAINT order_reviews_review_text_check
  CHECK (char_length(review_text) <= 10000);

-- ============================================================================
-- M-6: Scope idempotency_key to buyer — prevents cross-buyer key collisions
-- while allowing buyer to reuse same key for retry semantics.
-- ============================================================================
ALTER TABLE service_orders
  DROP CONSTRAINT IF EXISTS service_orders_idempotency_key_key;

ALTER TABLE service_orders
  ADD CONSTRAINT service_orders_idempotency_key_buyer_uniq
  UNIQUE (buyer_id, idempotency_key);

-- ============================================================================
-- C-1: Escrow release failure recovery
-- release_status tracks Lightning payout state independently of order status.
-- Order transitions to 'completed' ONLY after release_status = 'completed'.
-- BullMQ retries payout jobs on failure (exponential backoff).
-- ============================================================================
ALTER TABLE service_orders
  ADD COLUMN IF NOT EXISTS release_status TEXT DEFAULT 'pending'
    CHECK (release_status IN ('pending', 'processing', 'completed', 'failed'));

ALTER TABLE service_orders
  ADD COLUMN IF NOT EXISTS release_attempts INT DEFAULT 0;

-- Index for BullMQ retry worker to find orders needing payout retry
CREATE INDEX IF NOT EXISTS idx_orders_release_status
  ON service_orders(release_status)
  WHERE status = 'in_progress' OR status = 'completed';

-- ============================================================================
-- C-6: Revenue split ledger for atomic, auditable distribution
-- Pattern: record intent (ledger) BEFORE payments, then process per-coauthor.
-- revenue_split_ledger: one row per distribution event
-- revenue_split_payments: one row per coauthor per distribution event
-- ============================================================================
CREATE TABLE IF NOT EXISTS revenue_split_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID NOT NULL REFERENCES content(id) ON DELETE RESTRICT,
  initiated_by UUID NOT NULL REFERENCES auth.users(id),
  total_sats BIGINT NOT NULL CHECK (total_sats > 0),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS revenue_split_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ledger_id UUID NOT NULL REFERENCES revenue_split_ledger(id) ON DELETE RESTRICT,
  creator_id UUID NOT NULL REFERENCES auth.users(id),
  amount_sats BIGINT NOT NULL CHECK (amount_sats > 0),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  attempts INT DEFAULT 0,
  lightning_payment_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  UNIQUE(ledger_id, creator_id)
);

-- RLS: revenue_split_ledger
ALTER TABLE revenue_split_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Content owner can view own ledger"
  ON revenue_split_ledger FOR SELECT USING (
    content_id IN (
      SELECT id FROM content WHERE creator_id = (select auth.uid())
    )
    OR initiated_by = (select auth.uid())
  );

CREATE POLICY "System inserts ledger entries"
  ON revenue_split_ledger FOR INSERT WITH CHECK (
    initiated_by = (select auth.uid())
  );

-- RLS: revenue_split_payments
ALTER TABLE revenue_split_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Creator can view own payments"
  ON revenue_split_payments FOR SELECT USING (
    creator_id = (select auth.uid())
    OR ledger_id IN (
      SELECT id FROM revenue_split_ledger WHERE initiated_by = (select auth.uid())
    )
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ledger_content ON revenue_split_ledger(content_id);
CREATE INDEX IF NOT EXISTS idx_ledger_status ON revenue_split_ledger(status)
  WHERE status IN ('pending', 'processing');
CREATE INDEX IF NOT EXISTS idx_split_payments_ledger ON revenue_split_payments(ledger_id);
CREATE INDEX IF NOT EXISTS idx_split_payments_status ON revenue_split_payments(status)
  WHERE status IN ('pending', 'failed');

-- DOWN (run in reverse order)
-- DROP TABLE IF EXISTS revenue_split_payments CASCADE;
-- DROP TABLE IF EXISTS revenue_split_ledger CASCADE;
-- DROP INDEX IF EXISTS idx_orders_release_status;
-- ALTER TABLE service_orders DROP COLUMN IF EXISTS release_attempts;
-- ALTER TABLE service_orders DROP COLUMN IF EXISTS release_status;
-- ALTER TABLE service_orders DROP CONSTRAINT IF EXISTS service_orders_idempotency_key_buyer_uniq;
-- ALTER TABLE service_orders ADD CONSTRAINT service_orders_idempotency_key_key UNIQUE (idempotency_key);
-- ALTER TABLE order_reviews DROP CONSTRAINT IF EXISTS order_reviews_review_text_check;
-- ALTER TABLE order_reviews ADD CONSTRAINT order_reviews_review_text_check CHECK (char_length(review_text) <= 2000);
