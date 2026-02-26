-- Migration: 20260220300000_fix_review_findings_268_273_288_293_294.sql
-- Addresses 5 code review findings from 13-agent parallel review (2026-02-18):
--
--   #268 (P1): reply_templates.creator_id TEXT -> UUID with FK to auth.users
--   #273 (P2): Missing ON DELETE clauses on FK columns
--   #288 (P2): Duplicate update_updated_at_column() function definition
--   #293 (P3): Migration idempotency gaps (indexes without IF NOT EXISTS)
--   #294 (P3): Missing updated_at triggers on contracts and diversification_goals

-- ============================================================================
-- #268 (P1): Fix reply_templates.creator_id TEXT -> UUID with FK
-- ============================================================================
DROP POLICY IF EXISTS "Creator manages own reply templates" ON reply_templates;
DROP INDEX IF EXISTS idx_reply_templates_creator;
ALTER TABLE reply_templates DROP CONSTRAINT IF EXISTS reply_templates_creator_id_name_key;

ALTER TABLE reply_templates
  ALTER COLUMN creator_id TYPE UUID USING creator_id::uuid;

ALTER TABLE reply_templates
  ADD CONSTRAINT reply_templates_creator_id_fkey
  FOREIGN KEY (creator_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE reply_templates
  ADD CONSTRAINT reply_templates_creator_id_name_key UNIQUE (creator_id, name);

CREATE INDEX IF NOT EXISTS idx_reply_templates_creator
  ON reply_templates(creator_id, created_at DESC);

CREATE POLICY "Creator manages own reply templates"
  ON reply_templates FOR ALL
  USING (creator_id = (select auth.uid()))
  WITH CHECK (creator_id = (select auth.uid()));

-- ============================================================================
-- #273 (P2): Add missing ON DELETE clauses to FK columns
-- ============================================================================
ALTER TABLE order_reviews DROP CONSTRAINT IF EXISTS order_reviews_order_id_fkey;
ALTER TABLE order_reviews
  ADD CONSTRAINT order_reviews_order_id_fkey
  FOREIGN KEY (order_id) REFERENCES service_orders(id) ON DELETE RESTRICT;

ALTER TABLE order_reviews DROP CONSTRAINT IF EXISTS order_reviews_reviewer_id_fkey;
ALTER TABLE order_reviews
  ADD CONSTRAINT order_reviews_reviewer_id_fkey
  FOREIGN KEY (reviewer_id) REFERENCES auth.users(id) ON DELETE RESTRICT;

ALTER TABLE mentorships DROP CONSTRAINT IF EXISTS mentorships_mentor_id_fkey;
ALTER TABLE mentorships
  ADD CONSTRAINT mentorships_mentor_id_fkey
  FOREIGN KEY (mentor_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE mentorships DROP CONSTRAINT IF EXISTS mentorships_mentee_id_fkey;
ALTER TABLE mentorships
  ADD CONSTRAINT mentorships_mentee_id_fkey
  FOREIGN KEY (mentee_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE content_collaborators DROP CONSTRAINT IF EXISTS content_collaborators_creator_id_fkey;
ALTER TABLE content_collaborators
  ADD CONSTRAINT content_collaborators_creator_id_fkey
  FOREIGN KEY (creator_id) REFERENCES auth.users(id) ON DELETE RESTRICT;

ALTER TABLE revenue_split_ledger DROP CONSTRAINT IF EXISTS revenue_split_ledger_initiated_by_fkey;
ALTER TABLE revenue_split_ledger
  ADD CONSTRAINT revenue_split_ledger_initiated_by_fkey
  FOREIGN KEY (initiated_by) REFERENCES auth.users(id) ON DELETE RESTRICT;

ALTER TABLE revenue_split_payments DROP CONSTRAINT IF EXISTS revenue_split_payments_creator_id_fkey;
ALTER TABLE revenue_split_payments
  ADD CONSTRAINT revenue_split_payments_creator_id_fkey
  FOREIGN KEY (creator_id) REFERENCES auth.users(id) ON DELETE RESTRICT;

-- ============================================================================
-- #288 (P2): Consolidate duplicate update_updated_at_column() function
-- ============================================================================
DROP TRIGGER IF EXISTS trg_creator_circles_updated_at ON creator_circles;
DROP TRIGGER IF EXISTS trg_service_listings_updated_at ON service_listings;

CREATE TRIGGER trg_creator_circles_updated_at
  BEFORE UPDATE ON creator_circles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_service_listings_updated_at
  BEFORE UPDATE ON service_listings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP FUNCTION IF EXISTS update_updated_at_column();

-- ============================================================================
-- #293 (P3): Backfill idempotent indexes (IF NOT EXISTS safety net)
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_circle_members_creator ON circle_members(creator_id);
CREATE INDEX IF NOT EXISTS idx_circle_members_circle ON circle_members(circle_id);
CREATE INDEX IF NOT EXISTS idx_circle_posts_circle_created ON circle_posts(circle_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_creator_circles_niche ON creator_circles(niche) WHERE niche IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_creator_circles_created_by ON creator_circles(created_by);

CREATE INDEX IF NOT EXISTS idx_mentor_profiles_niche_active
  ON mentor_profiles(niche, active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_mentorships_mentor ON mentorships(mentor_id);
CREATE INDEX IF NOT EXISTS idx_mentorships_mentee ON mentorships(mentee_id);
CREATE INDEX IF NOT EXISTS idx_mentorships_status ON mentorships(status);

CREATE INDEX IF NOT EXISTS idx_content_collaborators_content ON content_collaborators(content_id);
CREATE INDEX IF NOT EXISTS idx_content_collaborators_creator ON content_collaborators(creator_id);
CREATE INDEX IF NOT EXISTS idx_content_collaborators_status ON content_collaborators(status);

CREATE INDEX IF NOT EXISTS idx_listings_creator ON service_listings(creator_id);
CREATE INDEX IF NOT EXISTS idx_listings_type_active ON service_listings(service_type, active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_orders_buyer ON service_orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_seller ON service_orders(seller_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON service_orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_expires ON service_orders(expires_at)
  WHERE status IN ('pending', 'escrow_funded');

-- ============================================================================
-- #294 (P3): Add missing updated_at triggers
-- ============================================================================
CREATE TRIGGER trg_contracts_updated_at
  BEFORE UPDATE ON contracts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_diversification_goals_updated_at
  BEFORE UPDATE ON diversification_goals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
