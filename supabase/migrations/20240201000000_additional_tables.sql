-- =============================================================================
-- ADDITIONAL TABLES MIGRATION
-- Consolidates all tables from archived migrations + backend code references
-- Run AFTER 20240101000000_baseline_schema.sql
--
-- Baseline already creates: users, content, payments, followers, comments,
--   content_analytics, migration_history, migration_performance, migration_backups
--
-- Rules applied:
--   - UUID primary keys with uuid_generate_v4() default
--   - TIMESTAMPTZ for timestamps
--   - No reserved words as column names (e.g. event_timestamp not timestamp)
--   - No payments.user_id references (use payer_id or recipient_id)
--   - No RETURNS TABLE functions
--   - No RLS policies (added separately)
--   - IF NOT EXISTS on everything
-- =============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- SECTION 1: ALTER TABLE — columns added to baseline tables by archived migrations
-- =============================================================================

-- payments: state machine fields (from 20251023233811)
ALTER TABLE payments ADD COLUMN IF NOT EXISTS state VARCHAR(20) DEFAULT 'pending';
ALTER TABLE payments ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS last_error TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- payments: retry support fields (from 20251023235000)
ALTER TABLE payments ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS last_retry_at TIMESTAMPTZ;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS retry_error_code VARCHAR(100);

-- =============================================================================
-- SECTION 2: Tables from archived payment/webhook/session migrations
-- =============================================================================

-- payment_events: audit trail for payment state transitions
CREATE TABLE IF NOT EXISTS payment_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  state VARCHAR(20) NOT NULL CHECK (
    state IN ('pending', 'processing', 'completed', 'failed', 'expired', 'refunded')
  ),
  previous_state VARCHAR(20) CHECK (
    previous_state IN ('pending', 'processing', 'completed', 'failed', 'expired', 'refunded')
  ),
  event_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb,
  triggered_by UUID REFERENCES users(id) ON DELETE SET NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_events_payment_id ON payment_events(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_state ON payment_events(state);
CREATE INDEX IF NOT EXISTS idx_payment_events_event_timestamp ON payment_events(event_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_payment_events_triggered_by ON payment_events(triggered_by) WHERE triggered_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payment_events_payment_timestamp ON payment_events(payment_id, event_timestamp DESC);

-- payment_retry_attempts: tracks retry history with exponential backoff
CREATE TABLE IF NOT EXISTS payment_retry_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL CHECK (attempt_number >= 1 AND attempt_number <= 5),
  scheduled_at TIMESTAMPTZ NOT NULL,
  executed_at TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL CHECK (
    status IN ('pending', 'executing', 'success', 'failed', 'skipped')
  ),
  error_code VARCHAR(100),
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_payment_retry_attempt UNIQUE (payment_id, attempt_number)
);

CREATE INDEX IF NOT EXISTS idx_retry_attempts_payment_id ON payment_retry_attempts(payment_id);
CREATE INDEX IF NOT EXISTS idx_retry_attempts_scheduled_at ON payment_retry_attempts(scheduled_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_retry_attempts_status ON payment_retry_attempts(status);

-- payment_lock_events: audit trail for lock acquisition
CREATE TABLE IF NOT EXISTS payment_lock_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  lock_acquired BOOLEAN NOT NULL,
  lock_wait_time_ms INTEGER,
  process_id INTEGER,
  event_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_payment_lock_events_payment_id ON payment_lock_events(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_lock_events_event_timestamp ON payment_lock_events(event_timestamp DESC);

-- webhook_events: idempotent webhook processing log
CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  idempotency_key VARCHAR(255) NOT NULL,
  payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
  payment_hash VARCHAR(64) NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  event_timestamp TIMESTAMPTZ NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'processing', 'processed', 'duplicate', 'failed')
  ),
  processed_at TIMESTAMPTZ,
  processing_started_at TIMESTAMPTZ,
  processing_duration_ms INTEGER,
  payload JSONB NOT NULL,
  headers JSONB,
  source_ip VARCHAR(45),
  result JSONB,
  error_message TEXT,
  sequence_number INTEGER,
  is_out_of_order BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_webhook_idempotency_key UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_payment_id ON webhook_events(payment_id) WHERE payment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_webhook_events_payment_hash ON webhook_events(payment_hash);
CREATE INDEX IF NOT EXISTS idx_webhook_events_status ON webhook_events(status) WHERE status IN ('pending', 'processing');
CREATE INDEX IF NOT EXISTS idx_webhook_events_event_timestamp ON webhook_events(event_timestamp DESC);

-- unified_sessions: multi-device session management
CREATE TABLE IF NOT EXISTS unified_sessions (
  id VARCHAR(100) PRIMARY KEY,
  pubkey VARCHAR(64) NOT NULL,
  user_id VARCHAR(100) NOT NULL,
  token_hash VARCHAR(64) NOT NULL,
  device_id VARCHAR(32) NOT NULL,
  device_fingerprint TEXT NOT NULL,
  device_info JSONB NOT NULL,
  ip_address INET,
  user_agent TEXT,
  location JSONB,
  lightning_enabled BOOLEAN DEFAULT FALSE,
  lightning_permissions JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  last_activity_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  idle_timeout_at TIMESTAMPTZ NOT NULL,
  active BOOLEAN DEFAULT TRUE NOT NULL,
  nostr_event_id VARCHAR(64),
  session_signature VARCHAR(128),
  permissions TEXT[] DEFAULT ARRAY['read', 'write']::TEXT[],
  risk_score INTEGER DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_unified_sessions_pubkey ON unified_sessions(pubkey);
CREATE INDEX IF NOT EXISTS idx_unified_sessions_user_id ON unified_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_unified_sessions_token_hash ON unified_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_unified_sessions_active ON unified_sessions(active);
CREATE INDEX IF NOT EXISTS idx_unified_sessions_pubkey_active ON unified_sessions(pubkey, active);

-- unified_session_activities: activity log for sessions
CREATE TABLE IF NOT EXISTS unified_session_activities (
  id VARCHAR(100) PRIMARY KEY,
  session_id VARCHAR(100) NOT NULL REFERENCES unified_sessions(id) ON DELETE CASCADE,
  pubkey VARCHAR(64) NOT NULL,
  activity_type VARCHAR(50) NOT NULL CHECK (
    activity_type IN ('login', 'api_call', 'page_view', 'logout', 'token_refresh', 'timeout', 'invalidation')
  ),
  activity_timestamp TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  details JSONB,
  nostr_event_id VARCHAR(64),
  risk_score INTEGER DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
  ip_address INET,
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_session_activities_session ON unified_session_activities(session_id);
CREATE INDEX IF NOT EXISTS idx_session_activities_pubkey ON unified_session_activities(pubkey);
CREATE INDEX IF NOT EXISTS idx_session_activities_session_time ON unified_session_activities(session_id, activity_timestamp DESC);

-- =============================================================================
-- SECTION 3: EPIC-009 tables (Platform Distribution)
-- =============================================================================

-- platform_connections: OAuth connections to external platforms
CREATE TABLE IF NOT EXISTS platform_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('mastodon','bluesky','twitter','youtube','nostr')),
  platform_user_id TEXT,
  platform_username TEXT,
  access_token_encrypted BYTEA NOT NULL,
  refresh_token_encrypted BYTEA,
  token_iv BYTEA NOT NULL,
  token_auth_tag BYTEA NOT NULL,
  refresh_token_iv BYTEA,
  refresh_token_auth_tag BYTEA,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  instance_url TEXT,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'connected'
    CHECK (status IN ('connected','token_expiring','token_expired','error','disconnected')),
  last_refreshed_at TIMESTAMPTZ,
  error_message TEXT,
  -- EPIC-009b adaptive polling columns
  poll_interval INTEGER NOT NULL DEFAULT 30 CHECK (poll_interval IN (5, 30)),
  last_active_at TIMESTAMPTZ,
  api_key_encrypted TEXT,
  api_key_iv TEXT,
  api_key_auth_tag TEXT,
  key_version INTEGER DEFAULT 1,
  UNIQUE(creator_id, platform)
);

CREATE INDEX IF NOT EXISTS idx_platform_connections_creator ON platform_connections(creator_id);
CREATE INDEX IF NOT EXISTS idx_platform_connections_status ON platform_connections(status);
CREATE INDEX IF NOT EXISTS idx_platform_connections_expires ON platform_connections(expires_at)
  WHERE expires_at IS NOT NULL AND status = 'connected';
CREATE INDEX IF NOT EXISTS idx_platform_connections_poll ON platform_connections(platform, status, last_active_at);

-- cross_posts: content published to external platforms
CREATE TABLE IF NOT EXISTS cross_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id TEXT NOT NULL,
  content_id UUID NOT NULL REFERENCES content(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('mastodon','bluesky','twitter','youtube','nostr')),
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','scheduled','publishing','published','failed','cancelled')),
  platform_post_id TEXT,
  platform_url TEXT,
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  error_message TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  metrics_json JSONB DEFAULT '{}',
  bullmq_job_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cross_posts_creator ON cross_posts(creator_id);
CREATE INDEX IF NOT EXISTS idx_cross_posts_content ON cross_posts(content_id);
CREATE INDEX IF NOT EXISTS idx_cross_posts_status ON cross_posts(status);

-- repurposed_content: platform-optimized versions of source content
CREATE TABLE IF NOT EXISTS repurposed_content (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id TEXT NOT NULL,
  source_content_id UUID NOT NULL REFERENCES content(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('mastodon','bluesky','twitter','youtube','nostr')),
  format_type TEXT NOT NULL CHECK (format_type IN ('thread','summary','short_post','video_description')),
  text TEXT NOT NULL,
  character_count INTEGER NOT NULL,
  approved BOOLEAN NOT NULL DEFAULT false,
  backlink_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_repurposed_creator ON repurposed_content(creator_id);
CREATE INDEX IF NOT EXISTS idx_repurposed_source ON repurposed_content(source_content_id);

-- inbox_messages: cached messages from external platforms
CREATE TABLE IF NOT EXISTS inbox_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('mastodon','bluesky','twitter','youtube','nostr')),
  platform_message_id TEXT NOT NULL,
  author TEXT NOT NULL,
  author_avatar_url TEXT,
  content TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('comment','reply','dm','mention')),
  parent_post_id TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  platform_created_at TIMESTAMPTZ NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(creator_id, platform, platform_message_id)
);

CREATE INDEX IF NOT EXISTS idx_inbox_creator ON inbox_messages(creator_id);
CREATE INDEX IF NOT EXISTS idx_inbox_creator_unread ON inbox_messages(creator_id, is_read)
  WHERE is_read = false AND is_archived = false;
CREATE INDEX IF NOT EXISTS idx_inbox_creator_platform ON inbox_messages(creator_id, platform);

-- platform_metrics_history: daily cross-platform metrics snapshots
CREATE TABLE IF NOT EXISTS platform_metrics_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('mastodon','bluesky','twitter','youtube','nostr')),
  followers INTEGER NOT NULL DEFAULT 0,
  following INTEGER NOT NULL DEFAULT 0,
  posts INTEGER NOT NULL DEFAULT 0,
  engagement_rate NUMERIC(7,4) NOT NULL DEFAULT 0,
  impressions_30d INTEGER NOT NULL DEFAULT 0,
  recorded_at DATE NOT NULL DEFAULT CURRENT_DATE,
  UNIQUE(creator_id, platform, recorded_at)
);

CREATE INDEX IF NOT EXISTS idx_platform_metrics_creator ON platform_metrics_history(creator_id);
CREATE INDEX IF NOT EXISTS idx_platform_metrics_recorded ON platform_metrics_history(recorded_at DESC);

-- reply_templates: creator-authored response templates for unified inbox
CREATE TABLE IF NOT EXISTS reply_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID NOT NULL,
  name TEXT NOT NULL,
  template_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(creator_id, name)
);

CREATE INDEX IF NOT EXISTS idx_reply_templates_creator ON reply_templates(creator_id, created_at DESC);

-- =============================================================================
-- SECTION 4: EPIC-010 tables (Creator Network)
-- =============================================================================

-- creator_circles: peer groups for creators
CREATE TABLE IF NOT EXISTS creator_circles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  niche TEXT,
  max_members INT DEFAULT 20 CHECK (max_members BETWEEN 5 AND 20),
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_creator_circles_niche ON creator_circles(niche) WHERE niche IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_creator_circles_created_by ON creator_circles(created_by);

-- circle_members: membership in creator circles
CREATE TABLE IF NOT EXISTS circle_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  circle_id UUID NOT NULL REFERENCES creator_circles(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(circle_id, creator_id)
);

CREATE INDEX IF NOT EXISTS idx_circle_members_creator ON circle_members(creator_id);
CREATE INDEX IF NOT EXISTS idx_circle_members_circle ON circle_members(circle_id);

-- circle_posts: Supabase-based messaging for circles
CREATE TABLE IF NOT EXISTS circle_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  circle_id UUID NOT NULL REFERENCES creator_circles(id) ON DELETE CASCADE,
  author_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_circle_posts_circle_created ON circle_posts(circle_id, created_at DESC);

-- mentor_profiles: creator mentorship profiles
CREATE TABLE IF NOT EXISTS mentor_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID NOT NULL UNIQUE,
  niche TEXT NOT NULL,
  audience_size_range TEXT CHECK (audience_size_range IN ('0-1k', '1k-10k', '10k-100k', '100k+')),
  bio TEXT,
  max_mentees INT DEFAULT 3 CHECK (max_mentees BETWEEN 1 AND 10),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mentor_profiles_niche_active ON mentor_profiles(niche, active) WHERE active = true;

-- mentorships: mentor-mentee relationships
CREATE TABLE IF NOT EXISTS mentorships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mentor_id UUID NOT NULL,
  mentee_id UUID NOT NULL,
  niche TEXT,
  goals JSONB DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'completed', 'declined')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT different_mentor_mentee CHECK (mentor_id != mentee_id)
);

CREATE INDEX IF NOT EXISTS idx_mentorships_mentor ON mentorships(mentor_id);
CREATE INDEX IF NOT EXISTS idx_mentorships_mentee ON mentorships(mentee_id);
CREATE INDEX IF NOT EXISTS idx_mentorships_status ON mentorships(status);

-- content_collaborators: collaborative content with revenue splits
CREATE TABLE IF NOT EXISTS content_collaborators (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_id UUID NOT NULL REFERENCES content(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL,
  revenue_split_bps INTEGER NOT NULL
    CHECK (revenue_split_bps > 0 AND revenue_split_bps <= 10000),
  status TEXT NOT NULL DEFAULT 'invited'
    CHECK (status IN ('invited', 'accepted', 'declined', 'removed')),
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  UNIQUE(content_id, creator_id)
);

CREATE INDEX IF NOT EXISTS idx_content_collaborators_content ON content_collaborators(content_id);
CREATE INDEX IF NOT EXISTS idx_content_collaborators_creator ON content_collaborators(creator_id);
CREATE INDEX IF NOT EXISTS idx_content_collaborators_status ON content_collaborators(status);

-- service_listings: marketplace service offerings
CREATE TABLE IF NOT EXISTS service_listings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID NOT NULL,
  service_type TEXT NOT NULL
    CHECK (service_type IN ('editing', 'writing', 'design', 'consulting', 'other')),
  title TEXT NOT NULL,
  description TEXT,
  price_sats BIGINT NOT NULL CHECK (price_sats > 0),
  portfolio_urls TEXT[] DEFAULT '{}',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_listings_creator ON service_listings(creator_id);
CREATE INDEX IF NOT EXISTS idx_listings_type_active ON service_listings(service_type, active) WHERE active = true;

-- service_orders: marketplace orders with custodial escrow
CREATE TABLE IF NOT EXISTS service_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id UUID NOT NULL REFERENCES service_listings(id) ON DELETE RESTRICT,
  buyer_id UUID NOT NULL,
  seller_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'escrow_funded', 'in_progress',
                      'completed', 'disputed', 'refunded', 'expired')),
  escrow_invoice_id TEXT,
  escrow_payment_hash TEXT,
  amount_sats BIGINT NOT NULL,
  idempotency_key UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  funded_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  disputed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
  -- Security hardening columns (from 20260220100400)
  release_status TEXT DEFAULT 'pending'
    CHECK (release_status IN ('pending', 'processing', 'completed', 'failed', 'permanently_failed')),
  release_attempts INT DEFAULT 0,
  -- Scoped idempotency (buyer_id + key)
  CONSTRAINT service_orders_idempotency_key_buyer_uniq UNIQUE (buyer_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_orders_buyer ON service_orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_seller ON service_orders(seller_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON service_orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_expires ON service_orders(expires_at)
  WHERE status IN ('pending', 'escrow_funded');
CREATE INDEX IF NOT EXISTS idx_orders_release_status ON service_orders(release_status)
  WHERE status = 'in_progress' OR status = 'completed';

-- order_reviews: reviews for completed marketplace orders
CREATE TABLE IF NOT EXISTS order_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES service_orders(id) ON DELETE RESTRICT UNIQUE,
  reviewer_id UUID NOT NULL,
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review_text TEXT CHECK (char_length(review_text) <= 10000),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- revenue_split_ledger: atomic revenue distribution events
CREATE TABLE IF NOT EXISTS revenue_split_ledger (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_id UUID NOT NULL REFERENCES content(id) ON DELETE RESTRICT,
  initiated_by UUID NOT NULL,
  total_sats BIGINT NOT NULL CHECK (total_sats > 0),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ledger_content ON revenue_split_ledger(content_id);
CREATE INDEX IF NOT EXISTS idx_ledger_status ON revenue_split_ledger(status)
  WHERE status IN ('pending', 'processing');

-- revenue_split_payments: per-coauthor payment records
CREATE TABLE IF NOT EXISTS revenue_split_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ledger_id UUID NOT NULL REFERENCES revenue_split_ledger(id) ON DELETE RESTRICT,
  creator_id UUID NOT NULL,
  amount_sats BIGINT NOT NULL CHECK (amount_sats > 0),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  attempts INT DEFAULT 0,
  lightning_payment_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE(ledger_id, creator_id)
);

CREATE INDEX IF NOT EXISTS idx_split_payments_ledger ON revenue_split_payments(ledger_id);
CREATE INDEX IF NOT EXISTS idx_split_payments_status ON revenue_split_payments(status)
  WHERE status IN ('pending', 'failed');

-- =============================================================================
-- SECTION 5: EPIC-011 tables (Business Manager)
-- =============================================================================

-- contract_templates: reusable contract templates
CREATE TABLE IF NOT EXISTS contract_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  category TEXT NOT NULL
    CHECK (category IN ('sponsorship', 'licensing', 'freelance', 'collaboration', 'general')),
  template_text TEXT NOT NULL,
  red_flags JSONB DEFAULT '[]',
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contract_templates_created_by ON contract_templates(created_by) WHERE created_by IS NOT NULL;

-- contracts: filled contract instances
CREATE TABLE IF NOT EXISTS contracts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID NOT NULL,
  template_id UUID REFERENCES contract_templates(id),
  counterparty TEXT NOT NULL,
  filled_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'signed', 'expired', 'terminated')),
  signed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contracts_creator_id ON contracts(creator_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(creator_id, status);

-- business_invoices: Lightning-native invoicing
CREATE TABLE IF NOT EXISTS business_invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID NOT NULL,
  client_name TEXT NOT NULL,
  line_items JSONB NOT NULL DEFAULT '[]',
  total_sats BIGINT NOT NULL CHECK (total_sats > 0),
  lightning_payment_link TEXT,
  lnurl_pay TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'viewed', 'paid', 'overdue', 'cancelled')),
  due_date DATE,
  recurring_interval TEXT
    CHECK (recurring_interval IN ('weekly', 'biweekly', 'monthly', 'quarterly')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  -- Security: recurring invoice limits (from 20260220200400)
  recurrence_end_date DATE,
  recurrence_count INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_business_invoices_creator_status ON business_invoices(creator_id, status);
CREATE INDEX IF NOT EXISTS idx_business_invoices_due_date ON business_invoices(due_date) WHERE status IN ('sent', 'viewed');

-- expense_categories: user-defined expense categories
CREATE TABLE IF NOT EXISTS expense_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'other'
    CHECK (type IN ('equipment', 'software', 'services', 'travel', 'office', 'other')),
  UNIQUE(creator_id, name)
);

CREATE INDEX IF NOT EXISTS idx_expense_categories_creator ON expense_categories(creator_id);

-- expenses: expense tracking
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID NOT NULL,
  category_id UUID REFERENCES expense_categories(id),
  description TEXT NOT NULL,
  amount_sats BIGINT NOT NULL CHECK (amount_sats > 0),
  usd_at_time NUMERIC(10,2),
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- BTC/USD rate provenance (from 20260220200400)
  rate_source TEXT,
  rate_timestamp TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_expenses_creator_date ON expenses(creator_id, expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category_id) WHERE category_id IS NOT NULL;

-- revenue_entries: revenue tracking by source
CREATE TABLE IF NOT EXISTS revenue_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID NOT NULL,
  source TEXT NOT NULL
    CHECK (source IN ('subscriptions', 'tips', 'sponsorships', 'services',
                      'affiliate', 'marketplace', 'other')),
  amount_sats BIGINT NOT NULL CHECK (amount_sats > 0),
  usd_at_time NUMERIC(10,2),
  description TEXT,
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  -- BTC/USD rate provenance (from 20260220200400)
  rate_source TEXT,
  rate_timestamp TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_revenue_creator_source ON revenue_entries(creator_id, source, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_revenue_creator_date ON revenue_entries(creator_id, recorded_at DESC);

-- diversification_goals: revenue diversification targets
CREATE TABLE IF NOT EXISTS diversification_goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID NOT NULL UNIQUE,
  target_distribution JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_diversification_goals_creator ON diversification_goals(creator_id);

-- =============================================================================
-- SECTION 6: Backend-referenced tables NOT in any migration (stub tables)
-- These tables are referenced by .from('table_name') in backend services
-- but have no migration definition. Stubs created here for schema completeness.
-- =============================================================================

-- lightning_invoices: Lightning Network invoice records
CREATE TABLE IF NOT EXISTS lightning_invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID REFERENCES users(id) ON DELETE SET NULL,
  payment_hash VARCHAR(64),
  payment_request TEXT,
  amount_sats BIGINT,
  description TEXT,
  status VARCHAR(20) DEFAULT 'pending',
  expires_at TIMESTAMPTZ,
  settled_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lightning_invoices_creator ON lightning_invoices(creator_id);
CREATE INDEX IF NOT EXISTS idx_lightning_invoices_payment_hash ON lightning_invoices(payment_hash);
CREATE INDEX IF NOT EXISTS idx_lightning_invoices_status ON lightning_invoices(status);

-- lightning_payments: Lightning payment records
CREATE TABLE IF NOT EXISTS lightning_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id UUID REFERENCES users(id) ON DELETE SET NULL,
  recipient_id UUID REFERENCES users(id) ON DELETE SET NULL,
  invoice_id UUID REFERENCES lightning_invoices(id) ON DELETE SET NULL,
  payment_hash VARCHAR(64),
  preimage VARCHAR(64),
  amount_sats BIGINT NOT NULL,
  fee_sats INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'pending',
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lightning_payments_sender ON lightning_payments(sender_id);
CREATE INDEX IF NOT EXISTS idx_lightning_payments_recipient ON lightning_payments(recipient_id);

-- lightning_addresses: Lightning address registrations
CREATE TABLE IF NOT EXISTS lightning_addresses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  address VARCHAR(255) NOT NULL UNIQUE,
  active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lightning_addresses_user ON lightning_addresses(user_id);

-- lightning_analytics: Lightning payment analytics
CREATE TABLE IF NOT EXISTS lightning_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  event_type VARCHAR(50) NOT NULL,
  amount_sats BIGINT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lightning_analytics_user ON lightning_analytics(user_id);

-- lightning_webhooks: Lightning webhook configurations
CREATE TABLE IF NOT EXISTS lightning_webhooks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  events TEXT[] DEFAULT '{}',
  active BOOLEAN DEFAULT true,
  secret_hash VARCHAR(64),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lightning_webhooks_user ON lightning_webhooks(user_id);

-- user_sessions: user login session records
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255),
  ip_address INET,
  user_agent TEXT,
  active BOOLEAN DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(active) WHERE active = true;

-- session_activity: session activity tracking
CREATE TABLE IF NOT EXISTS session_activity (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES user_sessions(id) ON DELETE CASCADE,
  activity_type VARCHAR(50) NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_activity_session ON session_activity(session_id);

-- user_preferences: user settings and preferences
CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  preferences JSONB DEFAULT '{}'::jsonb,
  notification_settings JSONB DEFAULT '{}'::jsonb,
  privacy_settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_preferences_user ON user_preferences(user_id);

-- user_behavior_events: user interaction tracking for recommendations
CREATE TABLE IF NOT EXISTS user_behavior_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,
  content_id UUID REFERENCES content(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_behavior_events_user ON user_behavior_events(user_id);
CREATE INDEX IF NOT EXISTS idx_user_behavior_events_content ON user_behavior_events(content_id);

-- user_wallet_providers: wallet connection records
CREATE TABLE IF NOT EXISTS user_wallet_providers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider_type VARCHAR(50) NOT NULL,
  provider_config JSONB DEFAULT '{}'::jsonb,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_wallet_providers_user ON user_wallet_providers(user_id);

-- user_stats: aggregated user statistics (view-like table)
CREATE TABLE IF NOT EXISTS user_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  total_content INTEGER DEFAULT 0,
  total_followers INTEGER DEFAULT 0,
  total_following INTEGER DEFAULT 0,
  total_earnings_sats BIGINT DEFAULT 0,
  engagement_rate NUMERIC(7,4) DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_stats_user ON user_stats(user_id);

-- payment_verifications: payment verification records
CREATE TABLE IF NOT EXISTS payment_verifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_id UUID REFERENCES payments(id) ON DELETE CASCADE,
  verification_type VARCHAR(50) NOT NULL,
  verified BOOLEAN DEFAULT false,
  verified_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_verifications_payment ON payment_verifications(payment_id);

-- payment_status_history: payment status change log
CREATE TABLE IF NOT EXISTS payment_status_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_id UUID REFERENCES payments(id) ON DELETE CASCADE,
  old_status VARCHAR(20),
  new_status VARCHAR(20) NOT NULL,
  changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_status_history_payment ON payment_status_history(payment_id);

-- subscription_tiers: creator subscription tier definitions
CREATE TABLE IF NOT EXISTS subscription_tiers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  price_sats BIGINT NOT NULL CHECK (price_sats > 0),
  benefits JSONB DEFAULT '[]',
  active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_tiers_creator ON subscription_tiers(creator_id);

-- subscriptions: active user subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subscriber_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tier_id UUID REFERENCES subscription_tiers(id) ON DELETE SET NULL,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired', 'paused')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_subscriber ON subscriptions(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_creator ON subscriptions(creator_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- recurring_payments: scheduled recurring payment records
CREATE TABLE IF NOT EXISTS recurring_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  payer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_sats BIGINT NOT NULL CHECK (amount_sats > 0),
  interval_type VARCHAR(20) DEFAULT 'monthly',
  next_payment_at TIMESTAMPTZ,
  last_payment_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  failure_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recurring_payments_payer ON recurring_payments(payer_id);
CREATE INDEX IF NOT EXISTS idx_recurring_payments_recipient ON recurring_payments(recipient_id);
CREATE INDEX IF NOT EXISTS idx_recurring_payments_next ON recurring_payments(next_payment_at) WHERE is_active = true;

-- transactions: unified transaction history
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  transaction_type VARCHAR(50) NOT NULL,
  amount_sats BIGINT NOT NULL,
  fee_sats INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'completed',
  description TEXT,
  reference_id UUID,
  reference_type VARCHAR(50),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_transactions_created ON transactions(created_at DESC);

-- transaction_exports: exported transaction reports
CREATE TABLE IF NOT EXISTS transaction_exports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  format VARCHAR(20) DEFAULT 'csv',
  status VARCHAR(20) DEFAULT 'pending',
  file_url TEXT,
  filters JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_transaction_exports_user ON transaction_exports(user_id);

-- nip05_verifications: NIP-05 identity verification records
CREATE TABLE IF NOT EXISTS nip05_verifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  identifier VARCHAR(255) NOT NULL,
  domain VARCHAR(255),
  verified BOOLEAN DEFAULT false,
  verified_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nip05_user ON nip05_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_nip05_identifier ON nip05_verifications(identifier);

-- content_items: extended content management (alias table)
-- Note: Some services use 'content_items' instead of 'content' — this is a separate
-- table for the CMS feature module with additional fields
CREATE TABLE IF NOT EXISTS content_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  body TEXT,
  content_type VARCHAR(50),
  status VARCHAR(20) DEFAULT 'draft',
  visibility VARCHAR(20) DEFAULT 'public',
  tags TEXT[],
  category VARCHAR(50),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_content_items_creator ON content_items(creator_id);
CREATE INDEX IF NOT EXISTS idx_content_items_status ON content_items(status);

-- media_assets: uploaded media files
CREATE TABLE IF NOT EXISTS media_assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  filename VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100),
  file_size BIGINT,
  storage_path TEXT,
  public_url TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_assets_creator ON media_assets(creator_id);

-- content_collections: grouped content collections
CREATE TABLE IF NOT EXISTS content_collections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  cover_image_url TEXT,
  visibility VARCHAR(20) DEFAULT 'public',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_collections_creator ON content_collections(creator_id);

-- content_series: sequential content series
CREATE TABLE IF NOT EXISTS content_series (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_series_creator ON content_series(creator_id);

-- premium_content_access: access control for premium content
CREATE TABLE IF NOT EXISTS premium_content_access (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_id UUID REFERENCES content(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  access_type VARCHAR(20) DEFAULT 'purchased',
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_premium_access_content ON premium_content_access(content_id);
CREATE INDEX IF NOT EXISTS idx_premium_access_user ON premium_content_access(user_id);

-- content_versions: version history for content
CREATE TABLE IF NOT EXISTS content_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_id UUID NOT NULL REFERENCES content(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  title VARCHAR(255),
  body TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_versions_content ON content_versions(content_id);

-- content_views: content view tracking
CREATE TABLE IF NOT EXISTS content_views (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_id UUID NOT NULL REFERENCES content(id) ON DELETE CASCADE,
  viewer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  session_id VARCHAR(255),
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_views_content ON content_views(content_id);
CREATE INDEX IF NOT EXISTS idx_content_views_viewer ON content_views(viewer_id);

-- content_categories: category definitions
CREATE TABLE IF NOT EXISTS content_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL UNIQUE,
  slug VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  parent_id UUID REFERENCES content_categories(id) ON DELETE SET NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_categories_slug ON content_categories(slug);

-- payouts: creator payout records
CREATE TABLE IF NOT EXISTS payouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_sats BIGINT NOT NULL CHECK (amount_sats > 0),
  fee_sats INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'pending',
  payment_method VARCHAR(50),
  payment_hash VARCHAR(64),
  lightning_address VARCHAR(255),
  processed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payouts_creator ON payouts(creator_id);
CREATE INDEX IF NOT EXISTS idx_payouts_status ON payouts(status);

-- payout_schedules: automated payout schedule configs
CREATE TABLE IF NOT EXISTS payout_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  frequency VARCHAR(20) DEFAULT 'weekly',
  min_amount_sats BIGINT DEFAULT 1000,
  lightning_address VARCHAR(255),
  active BOOLEAN DEFAULT true,
  next_payout_at TIMESTAMPTZ,
  last_payout_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payout_schedules_creator ON payout_schedules(creator_id);

-- AI/Recommendation tables

-- tag_feedback: user feedback on auto-generated tags
CREATE TABLE IF NOT EXISTS tag_feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content_id UUID REFERENCES content(id) ON DELETE CASCADE,
  tag VARCHAR(100) NOT NULL,
  feedback_type VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tag_feedback_content ON tag_feedback(content_id);

-- topic_trends: trending topic tracking
CREATE TABLE IF NOT EXISTS topic_trends (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  topic VARCHAR(255) NOT NULL,
  score NUMERIC(10,4) DEFAULT 0,
  sample_size INTEGER DEFAULT 0,
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_topic_trends_score ON topic_trends(score DESC);

-- content_tags: AI-generated content tags
CREATE TABLE IF NOT EXISTS content_tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_id UUID NOT NULL REFERENCES content(id) ON DELETE CASCADE,
  tag VARCHAR(100) NOT NULL,
  confidence NUMERIC(5,4) DEFAULT 0,
  source VARCHAR(20) DEFAULT 'auto',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_tags_content ON content_tags(content_id);

-- extracted_topics: NLP-extracted topics
CREATE TABLE IF NOT EXISTS extracted_topics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- content_clusters: content clustering groups
CREATE TABLE IF NOT EXISTS content_clusters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255),
  description TEXT,
  centroid JSONB,
  member_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- cluster_analytics: analytics for content clusters
CREATE TABLE IF NOT EXISTS cluster_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cluster_id UUID REFERENCES content_clusters(id) ON DELETE CASCADE,
  metric_type VARCHAR(50) NOT NULL,
  metric_value NUMERIC(12,4),
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cluster_analytics_cluster ON cluster_analytics(cluster_id);

-- related_content_analytics: related content performance
CREATE TABLE IF NOT EXISTS related_content_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_content_id UUID REFERENCES content(id) ON DELETE CASCADE,
  related_content_id UUID REFERENCES content(id) ON DELETE CASCADE,
  score NUMERIC(7,4) DEFAULT 0,
  click_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_related_analytics_source ON related_content_analytics(source_content_id);

-- related_content_interactions: user interactions with related content
CREATE TABLE IF NOT EXISTS related_content_interactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  source_content_id UUID REFERENCES content(id) ON DELETE CASCADE,
  related_content_id UUID REFERENCES content(id) ON DELETE CASCADE,
  interaction_type VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_related_interactions_source ON related_content_interactions(source_content_id);

-- content_similarity: pairwise content similarity scores
CREATE TABLE IF NOT EXISTS content_similarity (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_a_id UUID NOT NULL REFERENCES content(id) ON DELETE CASCADE,
  content_b_id UUID NOT NULL REFERENCES content(id) ON DELETE CASCADE,
  similarity_score NUMERIC(7,4) NOT NULL DEFAULT 0,
  algorithm VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(content_a_id, content_b_id)
);

CREATE INDEX IF NOT EXISTS idx_content_similarity_a ON content_similarity(content_a_id);
CREATE INDEX IF NOT EXISTS idx_content_similarity_b ON content_similarity(content_b_id);

-- recommendation_feedback: user feedback on recommendations
CREATE TABLE IF NOT EXISTS recommendation_feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content_id UUID REFERENCES content(id) ON DELETE CASCADE,
  feedback_type VARCHAR(20) NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recommendation_feedback_user ON recommendation_feedback(user_id);

-- search_history: user search history for personalization
CREATE TABLE IF NOT EXISTS search_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  result_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_search_history_user ON search_history(user_id);

-- content_feedback: general content feedback
CREATE TABLE IF NOT EXISTS content_feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content_id UUID NOT NULL REFERENCES content(id) ON DELETE CASCADE,
  feedback_type VARCHAR(20) NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_feedback_content ON content_feedback(content_id);

-- Creator discovery tables

-- creators: extended creator profiles for discovery
CREATE TABLE IF NOT EXISTS creators (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  display_name VARCHAR(100),
  bio TEXT,
  niche VARCHAR(100),
  tags TEXT[],
  verified BOOLEAN DEFAULT false,
  follower_count INTEGER DEFAULT 0,
  content_count INTEGER DEFAULT 0,
  rating NUMERIC(3,2) DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_creators_user ON creators(user_id);
CREATE INDEX IF NOT EXISTS idx_creators_niche ON creators(niche);

-- creator_profiles: detailed creator profile data
CREATE TABLE IF NOT EXISTS creator_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  niche VARCHAR(100),
  categories TEXT[],
  audience_size_range VARCHAR(20),
  bio TEXT,
  portfolio_urls TEXT[],
  social_links JSONB DEFAULT '{}'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_creator_profiles_creator ON creator_profiles(creator_id);

-- interest_taxonomy: hierarchical interest categories
CREATE TABLE IF NOT EXISTS interest_taxonomy (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL UNIQUE,
  parent_id UUID REFERENCES interest_taxonomy(id) ON DELETE SET NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- user_interest_mapping: user-to-interest mapping
CREATE TABLE IF NOT EXISTS user_interest_mapping (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  interest_id UUID NOT NULL REFERENCES interest_taxonomy(id) ON DELETE CASCADE,
  weight NUMERIC(5,4) DEFAULT 1.0,
  source VARCHAR(20) DEFAULT 'explicit',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, interest_id)
);

CREATE INDEX IF NOT EXISTS idx_user_interest_user ON user_interest_mapping(user_id);

-- creator_interest_mapping: creator-to-interest mapping
CREATE TABLE IF NOT EXISTS creator_interest_mapping (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  interest_id UUID NOT NULL REFERENCES interest_taxonomy(id) ON DELETE CASCADE,
  weight NUMERIC(5,4) DEFAULT 1.0,
  source VARCHAR(20) DEFAULT 'profile',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(creator_id, interest_id)
);

CREATE INDEX IF NOT EXISTS idx_creator_interest_creator ON creator_interest_mapping(creator_id);

-- creator_discovery_sessions: discovery browsing sessions
CREATE TABLE IF NOT EXISTS creator_discovery_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_type VARCHAR(50),
  filters JSONB DEFAULT '{}'::jsonb,
  results_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_discovery_sessions_user ON creator_discovery_sessions(user_id);

-- follow_relationships: extended follow relationship tracking
CREATE TABLE IF NOT EXISTS follow_relationships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  relationship_type VARCHAR(20) DEFAULT 'follow',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(follower_id, following_id)
);

CREATE INDEX IF NOT EXISTS idx_follow_relationships_follower ON follow_relationships(follower_id);
CREATE INDEX IF NOT EXISTS idx_follow_relationships_following ON follow_relationships(following_id);

-- Wellness/burnout tables

-- creator_work_patterns: daily work pattern tracking
CREATE TABLE IF NOT EXISTS creator_work_patterns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  content_time_mins INTEGER DEFAULT 0,
  engagement_time_mins INTEGER DEFAULT 0,
  management_time_mins INTEGER DEFAULT 0,
  post_count INTEGER DEFAULT 0,
  total_hours NUMERIC(5,2) DEFAULT 0,
  first_activity_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(creator_id, date)
);

CREATE INDEX IF NOT EXISTS idx_work_patterns_creator ON creator_work_patterns(creator_id);
CREATE INDEX IF NOT EXISTS idx_work_patterns_date ON creator_work_patterns(date DESC);

-- wellness_snapshots: periodic wellness score snapshots
CREATE TABLE IF NOT EXISTS wellness_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  composite_score NUMERIC(5,2),
  burnout_risk NUMERIC(5,2),
  work_life_balance NUMERIC(5,2),
  consistency_score NUMERIC(5,2),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wellness_snapshots_creator ON wellness_snapshots(creator_id);
CREATE INDEX IF NOT EXISTS idx_wellness_snapshots_created ON wellness_snapshots(created_at DESC);

-- wellness_benchmarks: anonymous aggregate wellness benchmarks
CREATE TABLE IF NOT EXISTS wellness_benchmarks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  avg_score NUMERIC(5,2),
  median_score NUMERIC(5,2),
  sample_size INTEGER,
  period_start DATE,
  period_end DATE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- burnout_risk_history: historical burnout risk tracking
CREATE TABLE IF NOT EXISTS burnout_risk_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  risk_score NUMERIC(5,2) NOT NULL,
  risk_level VARCHAR(20),
  factors JSONB DEFAULT '{}'::jsonb,
  recommendations JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_burnout_risk_creator ON burnout_risk_history(creator_id);

-- creator_boundaries: per-creator wellness boundaries and settings
CREATE TABLE IF NOT EXISTS creator_boundaries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  max_daily_hours NUMERIC(4,2) DEFAULT 8.0,
  max_weekly_hours NUMERIC(5,2) DEFAULT 40.0,
  break_reminder_interval_mins INTEGER DEFAULT 60,
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  sensitivity_level VARCHAR(20) NOT NULL DEFAULT 'normal'
    CHECK (sensitivity_level IN ('relaxed', 'normal', 'sensitive')),
  custom_settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_creator_boundaries_creator ON creator_boundaries(creator_id);

-- Provenance tables

-- provenance_records: content provenance and ownership records
CREATE TABLE IF NOT EXISTS provenance_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_id UUID NOT NULL REFERENCES content(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content_hash VARCHAR(64) NOT NULL,
  signature TEXT NOT NULL,
  nostr_event_id VARCHAR(64),
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'revoked')),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_provenance_content ON provenance_records(content_id);
CREATE INDEX IF NOT EXISTS idx_provenance_creator ON provenance_records(creator_id);

-- content_fingerprints: perceptual fingerprints for plagiarism detection
CREATE TABLE IF NOT EXISTS content_fingerprints (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_id UUID NOT NULL REFERENCES content(id) ON DELETE CASCADE,
  fingerprint_type VARCHAR(50) NOT NULL,
  fingerprint_data TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fingerprints_content ON content_fingerprints(content_id);

-- content_alerts: DMCA and plagiarism alerts
CREATE TABLE IF NOT EXISTS content_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_id UUID REFERENCES content(id) ON DELETE SET NULL,
  alert_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) DEFAULT 'medium',
  description TEXT,
  status VARCHAR(20) DEFAULT 'open',
  resolved_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_alerts_content ON content_alerts(content_id);
CREATE INDEX IF NOT EXISTS idx_content_alerts_status ON content_alerts(status);

-- System/admin tables

-- auto_tagging_configs: AI auto-tagging configuration
CREATE TABLE IF NOT EXISTS auto_tagging_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  enabled BOOLEAN DEFAULT true,
  model VARCHAR(50) DEFAULT 'default',
  confidence_threshold NUMERIC(3,2) DEFAULT 0.75,
  max_tags INTEGER DEFAULT 10,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auto_tagging_creator ON auto_tagging_configs(creator_id);

-- system_logs: system-level logging
CREATE TABLE IF NOT EXISTS system_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  log_level VARCHAR(20) NOT NULL DEFAULT 'info',
  source VARCHAR(100),
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_logs_level ON system_logs(log_level);
CREATE INDEX IF NOT EXISTS idx_system_logs_created ON system_logs(created_at DESC);

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
