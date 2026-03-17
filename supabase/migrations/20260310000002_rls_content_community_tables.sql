-- P1-DB-001 (Phase 3): RLS for content, community, and platform tables
-- Tables: cross_posts, repurposed_content, inbox_messages, platform_metrics_history,
--         reply_templates, creator_circles, circle_members, circle_posts,
--         mentor_profiles, mentorships, content_collaborators, service_listings,
--         service_orders, order_reviews, revenue_split_ledger, revenue_split_payments,
--         contract_templates, diversification_goals, expense_categories, payouts,
--         payout_schedules
--
-- Already has RLS from earlier migrations:
--   users, content, payments, followers, notifications, comments, content_analytics,
--   subscriptions, recurring_payments, transactions, lightning_invoices,
--   lightning_payments, platform_connections, business_invoices, expenses,
--   revenue_entries, contracts, provenance_records

-- =============================================================================
-- 1. cross_posts — creator_id is TEXT (not FK); content_id references content(id)
-- =============================================================================
ALTER TABLE cross_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cross_posts_service_role" ON cross_posts
  USING (auth.role() = 'service_role');

CREATE POLICY "cross_posts_select_own" ON cross_posts
  FOR SELECT USING (creator_id = auth.uid()::text);

-- =============================================================================
-- 2. repurposed_content — creator_id is TEXT
-- =============================================================================
ALTER TABLE repurposed_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "repurposed_content_service_role" ON repurposed_content
  USING (auth.role() = 'service_role');

CREATE POLICY "repurposed_content_select_own" ON repurposed_content
  FOR SELECT USING (creator_id = auth.uid()::text);

-- =============================================================================
-- 3. inbox_messages — creator_id is TEXT
-- =============================================================================
ALTER TABLE inbox_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inbox_messages_service_role" ON inbox_messages
  USING (auth.role() = 'service_role');

CREATE POLICY "inbox_messages_select_own" ON inbox_messages
  FOR SELECT USING (creator_id = auth.uid()::text);

-- =============================================================================
-- 4. platform_metrics_history — creator_id is TEXT
-- =============================================================================
ALTER TABLE platform_metrics_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform_metrics_history_service_role" ON platform_metrics_history
  USING (auth.role() = 'service_role');

CREATE POLICY "platform_metrics_history_select_own" ON platform_metrics_history
  FOR SELECT USING (creator_id = auth.uid()::text);

-- =============================================================================
-- 5. reply_templates — creator_id is UUID
-- =============================================================================
ALTER TABLE reply_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reply_templates_service_role" ON reply_templates
  USING (auth.role() = 'service_role');

CREATE POLICY "reply_templates_select_own" ON reply_templates
  FOR SELECT USING (creator_id = auth.uid());

-- =============================================================================
-- 6. creator_circles — created_by is UUID (no FK defined, but references users)
-- =============================================================================
ALTER TABLE creator_circles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "creator_circles_service_role" ON creator_circles
  USING (auth.role() = 'service_role');

-- Circles are discoverable by any authenticated user
CREATE POLICY "creator_circles_select_authenticated" ON creator_circles
  FOR SELECT USING (auth.role() = 'authenticated');

-- =============================================================================
-- 7. circle_members — circle_id references creator_circles(id); creator_id is UUID
-- =============================================================================
ALTER TABLE circle_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "circle_members_service_role" ON circle_members
  USING (auth.role() = 'service_role');

-- Members can see membership in their own circles
CREATE POLICY "circle_members_select_member" ON circle_members
  FOR SELECT USING (creator_id = auth.uid());

-- =============================================================================
-- 8. circle_posts — circle_id references creator_circles(id); author_id is UUID
-- =============================================================================
ALTER TABLE circle_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "circle_posts_service_role" ON circle_posts
  USING (auth.role() = 'service_role');

-- Circle posts are visible to circle members; enforced at application layer via JOIN
-- Direct DB access: only own posts or service_role
CREATE POLICY "circle_posts_select_own" ON circle_posts
  FOR SELECT USING (author_id = auth.uid());

-- =============================================================================
-- 9. mentor_profiles — creator_id is UUID
-- =============================================================================
ALTER TABLE mentor_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mentor_profiles_service_role" ON mentor_profiles
  USING (auth.role() = 'service_role');

-- Mentor profiles are public discovery data
CREATE POLICY "mentor_profiles_select_authenticated" ON mentor_profiles
  FOR SELECT USING (auth.role() = 'authenticated');

-- =============================================================================
-- 10. mentorships — mentor_id and mentee_id are UUID
-- =============================================================================
ALTER TABLE mentorships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mentorships_service_role" ON mentorships
  USING (auth.role() = 'service_role');

CREATE POLICY "mentorships_select_participant" ON mentorships
  FOR SELECT USING (mentor_id = auth.uid() OR mentee_id = auth.uid());

-- =============================================================================
-- 11. content_collaborators — content_id references content(id); creator_id is UUID
-- =============================================================================
ALTER TABLE content_collaborators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "content_collaborators_service_role" ON content_collaborators
  USING (auth.role() = 'service_role');

CREATE POLICY "content_collaborators_select_own" ON content_collaborators
  FOR SELECT USING (creator_id = auth.uid());

-- =============================================================================
-- 12. service_listings — creator_id is UUID
-- =============================================================================
ALTER TABLE service_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_listings_service_role" ON service_listings
  USING (auth.role() = 'service_role');

-- Listings are public marketplace data
CREATE POLICY "service_listings_select_authenticated" ON service_listings
  FOR SELECT USING (auth.role() = 'authenticated');

-- =============================================================================
-- 13. service_orders — buyer_id and seller_id are UUID
--     Financial table: no DELETE, restrict UPDATE to service_role
-- =============================================================================
ALTER TABLE service_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_orders_service_role" ON service_orders
  USING (auth.role() = 'service_role');

CREATE POLICY "service_orders_select_participant" ON service_orders
  FOR SELECT USING (buyer_id = auth.uid() OR seller_id = auth.uid());

-- =============================================================================
-- 14. order_reviews — reviewer_id is UUID; order_id references service_orders(id)
-- =============================================================================
ALTER TABLE order_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "order_reviews_service_role" ON order_reviews
  USING (auth.role() = 'service_role');

-- Reviews are public
CREATE POLICY "order_reviews_select_authenticated" ON order_reviews
  FOR SELECT USING (auth.role() = 'authenticated');

-- =============================================================================
-- 15. revenue_split_ledger — initiated_by is UUID; content_id references content(id)
--     Financial audit table: service_role only for writes
-- =============================================================================
ALTER TABLE revenue_split_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "revenue_split_ledger_service_role" ON revenue_split_ledger
  USING (auth.role() = 'service_role');

CREATE POLICY "revenue_split_ledger_select_own" ON revenue_split_ledger
  FOR SELECT USING (initiated_by = auth.uid());

-- =============================================================================
-- 16. revenue_split_payments — creator_id is UUID; ledger_id references ledger
--     Financial table: service_role only for writes
-- =============================================================================
ALTER TABLE revenue_split_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "revenue_split_payments_service_role" ON revenue_split_payments
  USING (auth.role() = 'service_role');

CREATE POLICY "revenue_split_payments_select_own" ON revenue_split_payments
  FOR SELECT USING (creator_id = auth.uid());

-- =============================================================================
-- 17. contract_templates — created_by is UUID (nullable)
-- =============================================================================
ALTER TABLE contract_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contract_templates_service_role" ON contract_templates
  USING (auth.role() = 'service_role');

-- Templates are readable by all authenticated users (shared resources)
CREATE POLICY "contract_templates_select_authenticated" ON contract_templates
  FOR SELECT USING (auth.role() = 'authenticated');

-- =============================================================================
-- 18. diversification_goals — creator_id is UUID
-- =============================================================================
ALTER TABLE diversification_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "diversification_goals_service_role" ON diversification_goals
  USING (auth.role() = 'service_role');

CREATE POLICY "diversification_goals_select_own" ON diversification_goals
  FOR SELECT USING (creator_id = auth.uid());

-- =============================================================================
-- 19. expense_categories — creator_id is UUID
-- =============================================================================
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "expense_categories_service_role" ON expense_categories
  USING (auth.role() = 'service_role');

CREATE POLICY "expense_categories_select_own" ON expense_categories
  FOR SELECT USING (creator_id = auth.uid());

-- =============================================================================
-- 20. payouts — check columns; assume creator_id or user_id
-- =============================================================================
ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payouts_service_role" ON payouts
  USING (auth.role() = 'service_role');

-- payouts select: creator_id is UUID references users(id)
CREATE POLICY "payouts_select_own" ON payouts
  FOR SELECT USING (creator_id = auth.uid());

-- =============================================================================
-- 21. payout_schedules — check columns; assume creator_id
-- =============================================================================
ALTER TABLE payout_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payout_schedules_service_role" ON payout_schedules
  USING (auth.role() = 'service_role');

-- payout_schedules: creator_id is UUID references users(id)
CREATE POLICY "payout_schedules_select_own" ON payout_schedules
  FOR SELECT USING (creator_id = auth.uid());
