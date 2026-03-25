-- =============================================================================
-- DB-001: Enable Row Level Security on Critical Financial and Auth Tables
-- Defense-in-depth: backend uses service_role (bypasses RLS),
-- but this protects against any future authenticated-role access.
--
-- Tables covered:
--   Payment audit trail:   payment_events, payment_retry_attempts, payment_lock_events
--   Session management:    unified_sessions, unified_session_activities
--   Lightning Network:     lightning_invoices, lightning_payments, lightning_addresses
--   Subscriptions:         subscriptions, recurring_payments, transactions
--   Business Manager:      business_invoices, contracts, expenses, revenue_entries
--
-- Column type notes:
--   UUID ownership columns (creator_id, user_id, subscriber_id, payer_id,
--     sender_id, creator_id) → USING (col = auth.uid())
--   TEXT/VARCHAR pubkey columns (unified_sessions.pubkey, unified_session_activities.pubkey)
--     → USING (pubkey = (SELECT nostr_pubkey FROM users WHERE id = auth.uid()))
--   Payment audit tables (payment_events, payment_retry_attempts, payment_lock_events)
--     have no direct user ownership column — scoped via payments table subquery.
-- =============================================================================

-- =============================================================================
-- payment_events
-- ownership: no direct user column — scoped via payments.payer_id / recipient_id
-- =============================================================================

ALTER TABLE payment_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payment_events_service_all ON payment_events;
CREATE POLICY payment_events_service_all
  ON payment_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS payment_events_authenticated_select ON payment_events;
CREATE POLICY payment_events_authenticated_select
  ON payment_events
  FOR SELECT
  TO authenticated
  USING (
    payment_id IN (
      SELECT id FROM payments
      WHERE payer_id = auth.uid() OR recipient_id = auth.uid()
    )
  );

-- =============================================================================
-- payment_retry_attempts
-- ownership: no direct user column — scoped via payments table
-- =============================================================================

ALTER TABLE payment_retry_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payment_retry_attempts_service_all ON payment_retry_attempts;
CREATE POLICY payment_retry_attempts_service_all
  ON payment_retry_attempts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS payment_retry_attempts_authenticated_select ON payment_retry_attempts;
CREATE POLICY payment_retry_attempts_authenticated_select
  ON payment_retry_attempts
  FOR SELECT
  TO authenticated
  USING (
    payment_id IN (
      SELECT id FROM payments
      WHERE payer_id = auth.uid() OR recipient_id = auth.uid()
    )
  );

-- =============================================================================
-- payment_lock_events
-- ownership: no direct user column — scoped via payments table
-- =============================================================================

ALTER TABLE payment_lock_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payment_lock_events_service_all ON payment_lock_events;
CREATE POLICY payment_lock_events_service_all
  ON payment_lock_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS payment_lock_events_authenticated_select ON payment_lock_events;
CREATE POLICY payment_lock_events_authenticated_select
  ON payment_lock_events
  FOR SELECT
  TO authenticated
  USING (
    payment_id IN (
      SELECT id FROM payments
      WHERE payer_id = auth.uid() OR recipient_id = auth.uid()
    )
  );

-- =============================================================================
-- unified_sessions
-- ownership: pubkey VARCHAR(64) — TEXT type storing NOSTR pubkey
-- user_id is VARCHAR(100) (not a UUID), so we match via nostr_pubkey
-- =============================================================================

ALTER TABLE unified_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS unified_sessions_service_all ON unified_sessions;
CREATE POLICY unified_sessions_service_all
  ON unified_sessions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS unified_sessions_authenticated_select ON unified_sessions;
CREATE POLICY unified_sessions_authenticated_select
  ON unified_sessions
  FOR SELECT
  TO authenticated
  USING (
    pubkey = (SELECT nostr_pubkey FROM users WHERE id = auth.uid())
  );

-- =============================================================================
-- unified_session_activities
-- ownership: pubkey VARCHAR(64) — TEXT type storing NOSTR pubkey
-- =============================================================================

ALTER TABLE unified_session_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS unified_session_activities_service_all ON unified_session_activities;
CREATE POLICY unified_session_activities_service_all
  ON unified_session_activities
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS unified_session_activities_authenticated_select ON unified_session_activities;
CREATE POLICY unified_session_activities_authenticated_select
  ON unified_session_activities
  FOR SELECT
  TO authenticated
  USING (
    pubkey = (SELECT nostr_pubkey FROM users WHERE id = auth.uid())
  );

-- =============================================================================
-- lightning_invoices
-- ownership: creator_id UUID REFERENCES users(id)
-- =============================================================================

ALTER TABLE lightning_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lightning_invoices_service_all ON lightning_invoices;
CREATE POLICY lightning_invoices_service_all
  ON lightning_invoices
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS lightning_invoices_authenticated_select ON lightning_invoices;
CREATE POLICY lightning_invoices_authenticated_select
  ON lightning_invoices
  FOR SELECT
  TO authenticated
  USING (creator_id = auth.uid());

-- =============================================================================
-- lightning_payments
-- ownership: sender_id UUID / recipient_id UUID — both sides can see their records
-- =============================================================================

ALTER TABLE lightning_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lightning_payments_service_all ON lightning_payments;
CREATE POLICY lightning_payments_service_all
  ON lightning_payments
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS lightning_payments_authenticated_select ON lightning_payments;
CREATE POLICY lightning_payments_authenticated_select
  ON lightning_payments
  FOR SELECT
  TO authenticated
  USING (sender_id = auth.uid() OR recipient_id = auth.uid());

-- =============================================================================
-- lightning_addresses
-- ownership: user_id UUID NOT NULL REFERENCES users(id)
-- =============================================================================

ALTER TABLE lightning_addresses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lightning_addresses_service_all ON lightning_addresses;
CREATE POLICY lightning_addresses_service_all
  ON lightning_addresses
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS lightning_addresses_authenticated_select ON lightning_addresses;
CREATE POLICY lightning_addresses_authenticated_select
  ON lightning_addresses
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- =============================================================================
-- subscriptions
-- ownership: subscriber_id UUID / creator_id UUID — both sides can see their records
-- =============================================================================

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS subscriptions_service_all ON subscriptions;
CREATE POLICY subscriptions_service_all
  ON subscriptions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS subscriptions_authenticated_select ON subscriptions;
CREATE POLICY subscriptions_authenticated_select
  ON subscriptions
  FOR SELECT
  TO authenticated
  USING (subscriber_id = auth.uid() OR creator_id = auth.uid());

-- =============================================================================
-- recurring_payments
-- ownership: payer_id UUID / recipient_id UUID — both sides can see their records
-- =============================================================================

ALTER TABLE recurring_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS recurring_payments_service_all ON recurring_payments;
CREATE POLICY recurring_payments_service_all
  ON recurring_payments
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS recurring_payments_authenticated_select ON recurring_payments;
CREATE POLICY recurring_payments_authenticated_select
  ON recurring_payments
  FOR SELECT
  TO authenticated
  USING (payer_id = auth.uid() OR recipient_id = auth.uid());

-- =============================================================================
-- transactions
-- ownership: user_id UUID NOT NULL REFERENCES users(id)
-- =============================================================================

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS transactions_service_all ON transactions;
CREATE POLICY transactions_service_all
  ON transactions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS transactions_authenticated_select ON transactions;
CREATE POLICY transactions_authenticated_select
  ON transactions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- =============================================================================
-- business_invoices
-- ownership: creator_id UUID NOT NULL
-- =============================================================================

ALTER TABLE business_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS business_invoices_service_all ON business_invoices;
CREATE POLICY business_invoices_service_all
  ON business_invoices
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS business_invoices_authenticated_select ON business_invoices;
CREATE POLICY business_invoices_authenticated_select
  ON business_invoices
  FOR SELECT
  TO authenticated
  USING (creator_id = auth.uid());

-- =============================================================================
-- contracts
-- ownership: creator_id UUID NOT NULL
-- =============================================================================

ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS contracts_service_all ON contracts;
CREATE POLICY contracts_service_all
  ON contracts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS contracts_authenticated_select ON contracts;
CREATE POLICY contracts_authenticated_select
  ON contracts
  FOR SELECT
  TO authenticated
  USING (creator_id = auth.uid());

-- =============================================================================
-- expenses
-- ownership: creator_id UUID NOT NULL
-- =============================================================================

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS expenses_service_all ON expenses;
CREATE POLICY expenses_service_all
  ON expenses
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS expenses_authenticated_select ON expenses;
CREATE POLICY expenses_authenticated_select
  ON expenses
  FOR SELECT
  TO authenticated
  USING (creator_id = auth.uid());

-- =============================================================================
-- revenue_entries
-- ownership: creator_id UUID NOT NULL
-- =============================================================================

ALTER TABLE revenue_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS revenue_entries_service_all ON revenue_entries;
CREATE POLICY revenue_entries_service_all
  ON revenue_entries
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS revenue_entries_authenticated_select ON revenue_entries;
CREATE POLICY revenue_entries_authenticated_select
  ON revenue_entries
  FOR SELECT
  TO authenticated
  USING (creator_id = auth.uid());
