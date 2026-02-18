-- Migration: 20260220200100_epic011_business_invoices.sql
-- EPIC-011: Business Manager — Business invoices with state machine
-- NOTE: Table named "business_invoices" to avoid collision with existing "invoices" table
-- ON DELETE RESTRICT (financial records must never cascade-delete)

-- ============================================================================
-- UP
-- ============================================================================

CREATE TABLE IF NOT EXISTS business_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  client_name TEXT NOT NULL,
  line_items JSONB NOT NULL DEFAULT '[]',
  total_sats BIGINT NOT NULL CHECK (total_sats > 0),
  lightning_payment_link TEXT,
  lnurl_pay TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'viewed', 'paid', 'overdue', 'cancelled')),
  due_date DATE,
  recurring_interval TEXT
    CHECK (recurring_interval IN ('weekly', 'biweekly', 'monthly', 'quarterly')),
  created_at TIMESTAMPTZ DEFAULT now(),
  paid_at TIMESTAMPTZ
);

-- Invoice state machine trigger (matches service_orders pattern)
CREATE OR REPLACE FUNCTION transition_invoice_state()
RETURNS TRIGGER AS $$
DECLARE
  valid_transitions JSONB := '{
    "draft": ["sent", "cancelled"],
    "sent": ["viewed", "paid", "overdue", "cancelled"],
    "viewed": ["paid", "overdue", "cancelled"],
    "paid": [],
    "overdue": ["paid", "cancelled"],
    "cancelled": []
  }'::jsonb;
  allowed_states JSONB;
BEGIN
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;
  allowed_states := valid_transitions -> OLD.status;
  IF NOT allowed_states ? NEW.status THEN
    RAISE EXCEPTION 'Invalid invoice state transition: % -> %', OLD.status, NEW.status;
  END IF;
  IF NEW.status = 'paid' THEN NEW.paid_at := now(); END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_invoice_state_machine
  BEFORE UPDATE ON business_invoices
  FOR EACH ROW EXECUTE FUNCTION transition_invoice_state();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_business_invoices_creator_status
  ON business_invoices(creator_id, status);
CREATE INDEX IF NOT EXISTS idx_business_invoices_due_date
  ON business_invoices(due_date) WHERE status IN ('sent', 'viewed');

-- RLS
ALTER TABLE business_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Creator manages own invoices"
  ON business_invoices FOR ALL USING (creator_id = (select auth.uid()));
