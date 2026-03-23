-- =============================================================================
-- DB-002: Add missing REFERENCES users(id) foreign key constraints
-- Adds FK constraints to ~19 UUID columns that were defined without REFERENCES.
--
-- Rules:
--   ON DELETE RESTRICT  — financial tables (contracts, invoices, revenue,
--                          expenses, service_orders, order_reviews,
--                          revenue_split_*)
--   ON DELETE CASCADE   — user-owned content (circles, posts, mentorships,
--                          templates, listings, goals)
--
-- All DDL is idempotent: no-op if the constraint already exists.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- reply_templates.creator_id → users(id)  [user-owned content → CASCADE]
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_reply_templates_creator_id'
  ) THEN
    ALTER TABLE reply_templates
      ADD CONSTRAINT fk_reply_templates_creator_id
      FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- creator_circles.created_by → users(id)  [user-owned content → CASCADE]
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_creator_circles_created_by'
  ) THEN
    ALTER TABLE creator_circles
      ADD CONSTRAINT fk_creator_circles_created_by
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- circle_members.creator_id → users(id)  [user-owned content → CASCADE]
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_circle_members_creator_id'
  ) THEN
    ALTER TABLE circle_members
      ADD CONSTRAINT fk_circle_members_creator_id
      FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- circle_posts.author_id → users(id)  [user-owned content → CASCADE]
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_circle_posts_author_id'
  ) THEN
    ALTER TABLE circle_posts
      ADD CONSTRAINT fk_circle_posts_author_id
      FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- mentor_profiles.creator_id → users(id)  [user-owned content → CASCADE]
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_mentor_profiles_creator_id'
  ) THEN
    ALTER TABLE mentor_profiles
      ADD CONSTRAINT fk_mentor_profiles_creator_id
      FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- mentorships.mentor_id → users(id)  [user-owned content → CASCADE]
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_mentorships_mentor_id'
  ) THEN
    ALTER TABLE mentorships
      ADD CONSTRAINT fk_mentorships_mentor_id
      FOREIGN KEY (mentor_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- mentorships.mentee_id → users(id)  [user-owned content → CASCADE]
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_mentorships_mentee_id'
  ) THEN
    ALTER TABLE mentorships
      ADD CONSTRAINT fk_mentorships_mentee_id
      FOREIGN KEY (mentee_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- content_collaborators.creator_id → users(id)  [user-owned content → CASCADE]
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_content_collaborators_creator_id'
  ) THEN
    ALTER TABLE content_collaborators
      ADD CONSTRAINT fk_content_collaborators_creator_id
      FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- service_listings.creator_id → users(id)  [user-owned content → CASCADE]
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_service_listings_creator_id'
  ) THEN
    ALTER TABLE service_listings
      ADD CONSTRAINT fk_service_listings_creator_id
      FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- service_orders.buyer_id → users(id)  [financial → RESTRICT]
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_service_orders_buyer_id'
  ) THEN
    ALTER TABLE service_orders
      ADD CONSTRAINT fk_service_orders_buyer_id
      FOREIGN KEY (buyer_id) REFERENCES users(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- service_orders.seller_id → users(id)  [financial → RESTRICT]
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_service_orders_seller_id'
  ) THEN
    ALTER TABLE service_orders
      ADD CONSTRAINT fk_service_orders_seller_id
      FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- order_reviews.reviewer_id → users(id)  [financial → RESTRICT]
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_order_reviews_reviewer_id'
  ) THEN
    ALTER TABLE order_reviews
      ADD CONSTRAINT fk_order_reviews_reviewer_id
      FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- revenue_split_ledger.initiated_by → users(id)  [financial → RESTRICT]
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_revenue_split_ledger_initiated_by'
  ) THEN
    ALTER TABLE revenue_split_ledger
      ADD CONSTRAINT fk_revenue_split_ledger_initiated_by
      FOREIGN KEY (initiated_by) REFERENCES users(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- revenue_split_payments.creator_id → users(id)  [financial → RESTRICT]
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_revenue_split_payments_creator_id'
  ) THEN
    ALTER TABLE revenue_split_payments
      ADD CONSTRAINT fk_revenue_split_payments_creator_id
      FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- contract_templates.created_by → users(id)  [nullable; user-owned → CASCADE]
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_contract_templates_created_by'
  ) THEN
    ALTER TABLE contract_templates
      ADD CONSTRAINT fk_contract_templates_created_by
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- contracts.creator_id → users(id)  [financial → RESTRICT]
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_contracts_creator_id'
  ) THEN
    ALTER TABLE contracts
      ADD CONSTRAINT fk_contracts_creator_id
      FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- business_invoices.creator_id → users(id)  [financial → RESTRICT]
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_business_invoices_creator_id'
  ) THEN
    ALTER TABLE business_invoices
      ADD CONSTRAINT fk_business_invoices_creator_id
      FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- expense_categories.creator_id → users(id)  [user-owned content → CASCADE]
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_expense_categories_creator_id'
  ) THEN
    ALTER TABLE expense_categories
      ADD CONSTRAINT fk_expense_categories_creator_id
      FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- expenses.creator_id → users(id)  [financial → RESTRICT]
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_expenses_creator_id'
  ) THEN
    ALTER TABLE expenses
      ADD CONSTRAINT fk_expenses_creator_id
      FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- revenue_entries.creator_id → users(id)  [financial → RESTRICT]
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_revenue_entries_creator_id'
  ) THEN
    ALTER TABLE revenue_entries
      ADD CONSTRAINT fk_revenue_entries_creator_id
      FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- diversification_goals.creator_id → users(id)  [user-owned content → CASCADE]
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_diversification_goals_creator_id'
  ) THEN
    ALTER TABLE diversification_goals
      ADD CONSTRAINT fk_diversification_goals_creator_id
      FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
