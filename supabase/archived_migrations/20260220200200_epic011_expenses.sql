-- Migration: 20260220200200_epic011_expenses.sql
-- EPIC-011: Business Manager — Expense categories and expense tracking
-- expense_categories uses CASCADE (non-financial metadata)
-- expenses uses ON DELETE RESTRICT (financial records must never cascade-delete)

-- ============================================================================
-- UP
-- ============================================================================

CREATE TABLE IF NOT EXISTS expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'other'
    CHECK (type IN ('equipment', 'software', 'services', 'travel', 'office', 'other')),
  UNIQUE(creator_id, name)
);

CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  category_id UUID REFERENCES expense_categories(id),
  description TEXT NOT NULL,
  amount_sats BIGINT NOT NULL CHECK (amount_sats > 0),
  usd_at_time NUMERIC(10,2),
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_expense_categories_creator
  ON expense_categories(creator_id);
CREATE INDEX IF NOT EXISTS idx_expenses_creator_date
  ON expenses(creator_id, expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_category
  ON expenses(category_id) WHERE category_id IS NOT NULL;

-- RLS
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Creator manages own categories"
  ON expense_categories FOR ALL USING (creator_id = (select auth.uid()));

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Creator manages own expenses"
  ON expenses FOR ALL USING (creator_id = (select auth.uid()));
