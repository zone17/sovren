-- =============================================================================
-- Rollback: 20260323000002_add_missing_foreign_keys.sql
-- Drops the 21 FK constraints added by the migration.
--
-- Constraint names match exactly what was added in the up migration.
-- Idempotent: uses DROP CONSTRAINT IF EXISTS.
-- =============================================================================

BEGIN;

-- reply_templates.creator_id → users(id)
ALTER TABLE reply_templates
  DROP CONSTRAINT IF EXISTS fk_reply_templates_creator_id;

-- creator_circles.created_by → users(id)
ALTER TABLE creator_circles
  DROP CONSTRAINT IF EXISTS fk_creator_circles_created_by;

-- circle_members.creator_id → users(id)
ALTER TABLE circle_members
  DROP CONSTRAINT IF EXISTS fk_circle_members_creator_id;

-- circle_posts.author_id → users(id)
ALTER TABLE circle_posts
  DROP CONSTRAINT IF EXISTS fk_circle_posts_author_id;

-- mentor_profiles.creator_id → users(id)
ALTER TABLE mentor_profiles
  DROP CONSTRAINT IF EXISTS fk_mentor_profiles_creator_id;

-- mentorships.mentor_id → users(id)
ALTER TABLE mentorships
  DROP CONSTRAINT IF EXISTS fk_mentorships_mentor_id;

-- mentorships.mentee_id → users(id)
ALTER TABLE mentorships
  DROP CONSTRAINT IF EXISTS fk_mentorships_mentee_id;

-- content_collaborators.creator_id → users(id)
ALTER TABLE content_collaborators
  DROP CONSTRAINT IF EXISTS fk_content_collaborators_creator_id;

-- service_listings.creator_id → users(id)
ALTER TABLE service_listings
  DROP CONSTRAINT IF EXISTS fk_service_listings_creator_id;

-- service_orders.buyer_id → users(id)
ALTER TABLE service_orders
  DROP CONSTRAINT IF EXISTS fk_service_orders_buyer_id;

-- service_orders.seller_id → users(id)
ALTER TABLE service_orders
  DROP CONSTRAINT IF EXISTS fk_service_orders_seller_id;

-- order_reviews.reviewer_id → users(id)
ALTER TABLE order_reviews
  DROP CONSTRAINT IF EXISTS fk_order_reviews_reviewer_id;

-- revenue_split_ledger.initiated_by → users(id)
ALTER TABLE revenue_split_ledger
  DROP CONSTRAINT IF EXISTS fk_revenue_split_ledger_initiated_by;

-- revenue_split_payments.creator_id → users(id)
ALTER TABLE revenue_split_payments
  DROP CONSTRAINT IF EXISTS fk_revenue_split_payments_creator_id;

-- contract_templates.created_by → users(id)
ALTER TABLE contract_templates
  DROP CONSTRAINT IF EXISTS fk_contract_templates_created_by;

-- contracts.creator_id → users(id)
ALTER TABLE contracts
  DROP CONSTRAINT IF EXISTS fk_contracts_creator_id;

-- business_invoices.creator_id → users(id)
ALTER TABLE business_invoices
  DROP CONSTRAINT IF EXISTS fk_business_invoices_creator_id;

-- expense_categories.creator_id → users(id)
ALTER TABLE expense_categories
  DROP CONSTRAINT IF EXISTS fk_expense_categories_creator_id;

-- expenses.creator_id → users(id)
ALTER TABLE expenses
  DROP CONSTRAINT IF EXISTS fk_expenses_creator_id;

-- revenue_entries.creator_id → users(id)
ALTER TABLE revenue_entries
  DROP CONSTRAINT IF EXISTS fk_revenue_entries_creator_id;

-- diversification_goals.creator_id → users(id)
ALTER TABLE diversification_goals
  DROP CONSTRAINT IF EXISTS fk_diversification_goals_creator_id;

COMMIT;
