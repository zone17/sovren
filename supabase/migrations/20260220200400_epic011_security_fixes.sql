-- Migration: 20260220200400_epic011_security_fixes.sql
-- EPIC-011 Security Remediation: H-5, M-2, M-8
--
-- H-5: Add rate_source + rate_timestamp to revenue_entries and expenses
--       for BTC-to-USD rate integrity tracing.
-- M-2: Add created_by to contract_templates; system templates have NULL.
-- M-8: Add recurrence_end_date + recurrence_count to business_invoices.

-- ============================================================================
-- H-5: BTC/USD rate provenance columns
-- ============================================================================

ALTER TABLE revenue_entries
  ADD COLUMN IF NOT EXISTS rate_source TEXT,
  ADD COLUMN IF NOT EXISTS rate_timestamp TIMESTAMPTZ;

COMMENT ON COLUMN revenue_entries.rate_source IS
  'Exchange rate provider used for usd_at_time (e.g. coingecko). NULL when usd_at_time is not set.';
COMMENT ON COLUMN revenue_entries.rate_timestamp IS
  'Timestamp of the rate fetch used for usd_at_time conversion.';

ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS rate_source TEXT,
  ADD COLUMN IF NOT EXISTS rate_timestamp TIMESTAMPTZ;

COMMENT ON COLUMN expenses.rate_source IS
  'Exchange rate provider used for usd_at_time (e.g. coingecko). NULL when usd_at_time is not set.';
COMMENT ON COLUMN expenses.rate_timestamp IS
  'Timestamp of the rate fetch used for usd_at_time conversion.';

-- ============================================================================
-- M-2: creator_id on contract_templates
-- ============================================================================

ALTER TABLE contract_templates
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN contract_templates.created_by IS
  'NULL = system template (visible to all). Non-NULL = user-created template (restricted by RLS).';

-- Update RLS: system templates visible to all; user templates visible to creator only
DROP POLICY IF EXISTS "Anyone can view templates" ON contract_templates;

CREATE POLICY "System templates visible to all, user templates to creator"
  ON contract_templates FOR SELECT USING (
    created_by IS NULL                           -- system templates
    OR created_by = (select auth.uid())          -- own user templates
  );

CREATE POLICY "Creator can create own templates"
  ON contract_templates FOR INSERT WITH CHECK (
    created_by = (select auth.uid())
  );

CREATE POLICY "Creator can update own templates"
  ON contract_templates FOR UPDATE USING (
    created_by = (select auth.uid())
  );

CREATE POLICY "Creator can delete own templates"
  ON contract_templates FOR DELETE USING (
    created_by = (select auth.uid())
  );

-- Index for efficient per-creator template lookups
CREATE INDEX IF NOT EXISTS idx_contract_templates_created_by
  ON contract_templates(created_by) WHERE created_by IS NOT NULL;

-- ============================================================================
-- M-8: Recurring invoice limits
-- ============================================================================

ALTER TABLE business_invoices
  ADD COLUMN IF NOT EXISTS recurrence_end_date DATE,
  ADD COLUMN IF NOT EXISTS recurrence_count INT NOT NULL DEFAULT 0;

COMMENT ON COLUMN business_invoices.recurrence_end_date IS
  'Stop generating recurring invoices after this date. NULL = no date limit.';
COMMENT ON COLUMN business_invoices.recurrence_count IS
  'Number of recurring invoices generated so far. Max: 52 (weekly=1yr), 26 (biweekly), 12 (monthly), 4 (quarterly).';

-- Enforce per-interval max recurrence counts at DB level
ALTER TABLE business_invoices
  ADD CONSTRAINT chk_recurrence_count_weekly
    CHECK (
      recurring_interval != 'weekly'
      OR recurrence_count <= 52
    ),
  ADD CONSTRAINT chk_recurrence_count_biweekly
    CHECK (
      recurring_interval != 'biweekly'
      OR recurrence_count <= 26
    ),
  ADD CONSTRAINT chk_recurrence_count_monthly
    CHECK (
      recurring_interval != 'monthly'
      OR recurrence_count <= 12
    ),
  ADD CONSTRAINT chk_recurrence_count_quarterly
    CHECK (
      recurring_interval != 'quarterly'
      OR recurrence_count <= 4
    );
