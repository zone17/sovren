-- =============================================================================
-- ADD CHECK CONSTRAINTS TO STUB TABLES
-- Adds explicit CHECK constraints to status/format columns in stub tables
-- that were created without them in 20240201000000_additional_tables.sql.
-- Run AFTER 20240201000000_additional_tables.sql
-- =============================================================================

-- lightning_invoices.status
ALTER TABLE lightning_invoices
  ADD CONSTRAINT chk_lightning_invoices_status
  CHECK (status IN ('pending', 'open', 'settled', 'cancelled', 'expired', 'failed'));

-- lightning_payments.status
ALTER TABLE lightning_payments
  ADD CONSTRAINT chk_lightning_payments_status
  CHECK (status IN ('pending', 'in_flight', 'succeeded', 'failed', 'cancelled'));

-- transactions.status
ALTER TABLE transactions
  ADD CONSTRAINT chk_transactions_status
  CHECK (status IN ('pending', 'completed', 'failed', 'reversed', 'cancelled'));

-- content_items.status
ALTER TABLE content_items
  ADD CONSTRAINT chk_content_items_status
  CHECK (status IN ('draft', 'published', 'archived', 'deleted'));

-- content_items.visibility (no CHECK existed)
ALTER TABLE content_items
  ADD CONSTRAINT chk_content_items_visibility
  CHECK (visibility IN ('public', 'private', 'supporters_only', 'paid'));
