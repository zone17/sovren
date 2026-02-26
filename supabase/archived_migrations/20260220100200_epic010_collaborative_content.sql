-- Migration: 20260220100200_epic010_collaborative_content.sql
-- EPIC-010: Creator Network — Collaborative Content with Revenue Splits
--
-- Revenue split design:
-- - Uses INTEGER basis points (0-10000) instead of NUMERIC(5,2) percentage
-- - Eliminates floating-point rounding in sat allocations
-- - Two-layer validation:
--   Layer 1 (trigger): blocks inserts/updates that push sum > 10000 bps
--   Layer 2 (service): enforces sum = 10000 bps before enabling distribution
-- - content_id is UUID to match content.id type (NOT BIGINT — critical fix)

-- UP

CREATE TABLE content_collaborators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID NOT NULL REFERENCES content(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES auth.users(id),
  revenue_split_bps INTEGER NOT NULL
    CHECK (revenue_split_bps > 0 AND revenue_split_bps <= 10000),
  status TEXT NOT NULL DEFAULT 'invited'
    CHECK (status IN ('invited', 'accepted', 'declined', 'removed')),
  invited_at TIMESTAMPTZ DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  UNIQUE(content_id, creator_id)
);

-- Revenue split validation trigger (Layer 1 of two-layer design)
-- Blocks inserts/updates that would push total > 10000 bps
-- Service layer enforces total = 10000 bps before enabling distribution
CREATE OR REPLACE FUNCTION validate_revenue_split_sum()
RETURNS TRIGGER AS $$
DECLARE
  total_bps INTEGER;
BEGIN
  SELECT COALESCE(SUM(revenue_split_bps), 0) INTO total_bps
  FROM content_collaborators
  WHERE content_id = NEW.content_id
    AND status IN ('invited', 'accepted')
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

  IF (total_bps + NEW.revenue_split_bps) > 10000 THEN
    RAISE EXCEPTION 'Revenue split sum would exceed 10000 bps (100%%). Current: %, Adding: %',
      total_bps, NEW.revenue_split_bps;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_revenue_split
  BEFORE INSERT OR UPDATE ON content_collaborators
  FOR EACH ROW EXECUTE FUNCTION validate_revenue_split_sum();

-- RLS: content_collaborators
ALTER TABLE content_collaborators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Collaborators can view own collaborations"
  ON content_collaborators FOR SELECT USING (
    creator_id = (select auth.uid())
    OR content_id IN (SELECT id FROM content WHERE creator_id = (select auth.uid()))
  );

CREATE POLICY "Content owner can invite collaborators"
  ON content_collaborators FOR INSERT WITH CHECK (
    content_id IN (SELECT id FROM content WHERE creator_id = (select auth.uid()))
  );

CREATE POLICY "Collaborator can update own invitation response"
  ON content_collaborators FOR UPDATE USING (
    creator_id = (select auth.uid())
    OR content_id IN (SELECT id FROM content WHERE creator_id = (select auth.uid()))
  );

-- Indexes
CREATE INDEX idx_content_collaborators_content ON content_collaborators(content_id);
CREATE INDEX idx_content_collaborators_creator ON content_collaborators(creator_id);
CREATE INDEX idx_content_collaborators_status ON content_collaborators(status);

-- DOWN (run in reverse order)
-- DROP TRIGGER IF EXISTS trg_validate_revenue_split ON content_collaborators;
-- DROP FUNCTION IF EXISTS validate_revenue_split_sum();
-- DROP TABLE IF EXISTS content_collaborators CASCADE;
