-- Phase 1: Top 10 financial tables. Phase 2: remaining 30+ tables in separate migration.
-- Enables RLS + service_role bypass + user-scoped SELECT policies.

-- =============================================================================
-- 1. platform_connections (encrypted OAuth tokens)
--    creator_id is TEXT, not UUID FK
-- =============================================================================
ALTER TABLE platform_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform_connections_service_role" ON platform_connections
  USING (auth.role() = 'service_role');

CREATE POLICY "platform_connections_select_own" ON platform_connections
  FOR SELECT USING (creator_id = auth.uid()::text);

-- =============================================================================
-- 2. subscriptions
--    subscriber_id and creator_id are both UUID FK to users
-- =============================================================================
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subscriptions_service_role" ON subscriptions
  USING (auth.role() = 'service_role');

CREATE POLICY "subscriptions_select_own" ON subscriptions
  FOR SELECT USING (subscriber_id = auth.uid() OR creator_id = auth.uid());

-- =============================================================================
-- 3. recurring_payments
--    payer_id and recipient_id are UUID FK to users
-- =============================================================================
ALTER TABLE recurring_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recurring_payments_service_role" ON recurring_payments
  USING (auth.role() = 'service_role');

CREATE POLICY "recurring_payments_select_own" ON recurring_payments
  FOR SELECT USING (payer_id = auth.uid() OR recipient_id = auth.uid());

-- =============================================================================
-- 4. transactions
--    user_id is UUID FK to users
-- =============================================================================
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "transactions_service_role" ON transactions
  USING (auth.role() = 'service_role');

CREATE POLICY "transactions_select_own" ON transactions
  FOR SELECT USING (user_id = auth.uid());

-- =============================================================================
-- 5. lightning_invoices
--    creator_id is UUID FK to users
-- =============================================================================
ALTER TABLE lightning_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lightning_invoices_service_role" ON lightning_invoices
  USING (auth.role() = 'service_role');

CREATE POLICY "lightning_invoices_select_own" ON lightning_invoices
  FOR SELECT USING (creator_id = auth.uid());

-- =============================================================================
-- 6. lightning_payments
--    sender_id and recipient_id are UUID FK to users
-- =============================================================================
ALTER TABLE lightning_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lightning_payments_service_role" ON lightning_payments
  USING (auth.role() = 'service_role');

CREATE POLICY "lightning_payments_select_own" ON lightning_payments
  FOR SELECT USING (sender_id = auth.uid() OR recipient_id = auth.uid());

-- =============================================================================
-- 7. business_invoices
--    creator_id is TEXT, not UUID FK
-- =============================================================================
ALTER TABLE business_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "business_invoices_service_role" ON business_invoices
  USING (auth.role() = 'service_role');

CREATE POLICY "business_invoices_select_own" ON business_invoices
  FOR SELECT USING (creator_id = auth.uid()::text);

-- =============================================================================
-- 8. expenses
--    creator_id is TEXT, not UUID FK
-- =============================================================================
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "expenses_service_role" ON expenses
  USING (auth.role() = 'service_role');

CREATE POLICY "expenses_select_own" ON expenses
  FOR SELECT USING (creator_id = auth.uid()::text);

-- =============================================================================
-- 9. revenue_entries
--    creator_id is TEXT, not UUID FK
-- =============================================================================
ALTER TABLE revenue_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "revenue_entries_service_role" ON revenue_entries
  USING (auth.role() = 'service_role');

CREATE POLICY "revenue_entries_select_own" ON revenue_entries
  FOR SELECT USING (creator_id = auth.uid()::text);

-- =============================================================================
-- 10. contracts
--    creator_id is TEXT, not UUID FK
-- =============================================================================
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contracts_service_role" ON contracts
  USING (auth.role() = 'service_role');

CREATE POLICY "contracts_select_own" ON contracts
  FOR SELECT USING (creator_id = auth.uid()::text);
