-- =============================================================================
-- Rollback: 20260323000001_rls_critical_financial_tables.sql
-- Drops all RLS policies added by the migration and disables RLS on each table.
--
-- Tables covered:
--   payment_events, payment_retry_attempts, payment_lock_events
--   unified_sessions, unified_session_activities
--   lightning_invoices, lightning_payments, lightning_addresses
--   subscriptions, recurring_payments, transactions
--   business_invoices, contracts, expenses, revenue_entries
--
-- Idempotent: DROP POLICY IF EXISTS / ALTER TABLE ... DISABLE ROW LEVEL SECURITY
-- =============================================================================

BEGIN;

-- payment_events
DROP POLICY IF EXISTS payment_events_service_all ON payment_events;
DROP POLICY IF EXISTS payment_events_authenticated_select ON payment_events;
ALTER TABLE payment_events DISABLE ROW LEVEL SECURITY;

-- payment_retry_attempts
DROP POLICY IF EXISTS payment_retry_attempts_service_all ON payment_retry_attempts;
DROP POLICY IF EXISTS payment_retry_attempts_authenticated_select ON payment_retry_attempts;
ALTER TABLE payment_retry_attempts DISABLE ROW LEVEL SECURITY;

-- payment_lock_events
DROP POLICY IF EXISTS payment_lock_events_service_all ON payment_lock_events;
DROP POLICY IF EXISTS payment_lock_events_authenticated_select ON payment_lock_events;
ALTER TABLE payment_lock_events DISABLE ROW LEVEL SECURITY;

-- unified_sessions
DROP POLICY IF EXISTS unified_sessions_service_all ON unified_sessions;
DROP POLICY IF EXISTS unified_sessions_authenticated_select ON unified_sessions;
ALTER TABLE unified_sessions DISABLE ROW LEVEL SECURITY;

-- unified_session_activities
DROP POLICY IF EXISTS unified_session_activities_service_all ON unified_session_activities;
DROP POLICY IF EXISTS unified_session_activities_authenticated_select ON unified_session_activities;
ALTER TABLE unified_session_activities DISABLE ROW LEVEL SECURITY;

-- lightning_invoices
DROP POLICY IF EXISTS lightning_invoices_service_all ON lightning_invoices;
DROP POLICY IF EXISTS lightning_invoices_authenticated_select ON lightning_invoices;
ALTER TABLE lightning_invoices DISABLE ROW LEVEL SECURITY;

-- lightning_payments
DROP POLICY IF EXISTS lightning_payments_service_all ON lightning_payments;
DROP POLICY IF EXISTS lightning_payments_authenticated_select ON lightning_payments;
ALTER TABLE lightning_payments DISABLE ROW LEVEL SECURITY;

-- lightning_addresses
DROP POLICY IF EXISTS lightning_addresses_service_all ON lightning_addresses;
DROP POLICY IF EXISTS lightning_addresses_authenticated_select ON lightning_addresses;
ALTER TABLE lightning_addresses DISABLE ROW LEVEL SECURITY;

-- subscriptions
DROP POLICY IF EXISTS subscriptions_service_all ON subscriptions;
DROP POLICY IF EXISTS subscriptions_authenticated_select ON subscriptions;
ALTER TABLE subscriptions DISABLE ROW LEVEL SECURITY;

-- recurring_payments
DROP POLICY IF EXISTS recurring_payments_service_all ON recurring_payments;
DROP POLICY IF EXISTS recurring_payments_authenticated_select ON recurring_payments;
ALTER TABLE recurring_payments DISABLE ROW LEVEL SECURITY;

-- transactions
DROP POLICY IF EXISTS transactions_service_all ON transactions;
DROP POLICY IF EXISTS transactions_authenticated_select ON transactions;
ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;

-- business_invoices
DROP POLICY IF EXISTS business_invoices_service_all ON business_invoices;
DROP POLICY IF EXISTS business_invoices_authenticated_select ON business_invoices;
ALTER TABLE business_invoices DISABLE ROW LEVEL SECURITY;

-- contracts
DROP POLICY IF EXISTS contracts_service_all ON contracts;
DROP POLICY IF EXISTS contracts_authenticated_select ON contracts;
ALTER TABLE contracts DISABLE ROW LEVEL SECURITY;

-- expenses
DROP POLICY IF EXISTS expenses_service_all ON expenses;
DROP POLICY IF EXISTS expenses_authenticated_select ON expenses;
ALTER TABLE expenses DISABLE ROW LEVEL SECURITY;

-- revenue_entries
DROP POLICY IF EXISTS revenue_entries_service_all ON revenue_entries;
DROP POLICY IF EXISTS revenue_entries_authenticated_select ON revenue_entries;
ALTER TABLE revenue_entries DISABLE ROW LEVEL SECURITY;

COMMIT;
