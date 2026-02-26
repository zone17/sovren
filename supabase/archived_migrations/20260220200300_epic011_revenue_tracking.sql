-- Migration: 20260220200300_epic011_revenue_tracking.sql
-- EPIC-011: Business Manager — Revenue entries and diversification goals
-- revenue_entries uses ON DELETE RESTRICT (financial records must never cascade-delete)
-- diversification_goals uses CASCADE (user preference, not financial record)

-- ============================================================================
-- UP
-- ============================================================================

CREATE TABLE IF NOT EXISTS revenue_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  source TEXT NOT NULL
    CHECK (source IN ('subscriptions', 'tips', 'sponsorships', 'services',
                      'affiliate', 'marketplace', 'other')),
  amount_sats BIGINT NOT NULL CHECK (amount_sats > 0),
  usd_at_time NUMERIC(10,2),
  description TEXT,
  recorded_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS diversification_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  target_distribution JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_revenue_creator_source
  ON revenue_entries(creator_id, source, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_revenue_creator_date
  ON revenue_entries(creator_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_diversification_goals_creator
  ON diversification_goals(creator_id);

-- RLS
ALTER TABLE revenue_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Creator manages own revenue"
  ON revenue_entries FOR ALL USING (creator_id = (select auth.uid()));

ALTER TABLE diversification_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Creator manages own goals"
  ON diversification_goals FOR ALL USING (creator_id = (select auth.uid()));
