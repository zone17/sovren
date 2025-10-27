-- 🗄️ SOVREN DATABASE SCHEMA V2.0
-- Elite PostgreSQL schema for NOSTR-native creator monetization platform
-- Updated with Lightning Network integration for Bitcoin payments

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_crypto";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 👤 USERS TABLE (Enhanced for Lightning Integration)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nostr_pubkey VARCHAR(64) UNIQUE NOT NULL,

    -- User Profile
    username VARCHAR(50) UNIQUE,
    display_name VARCHAR(100),
    bio TEXT,
    avatar_url TEXT,
    banner_url TEXT,
    website_url TEXT,
    nip05_verified BOOLEAN DEFAULT FALSE,

    -- Lightning Network Profile
    lightning_address VARCHAR(255), -- e.g., creator@sovren.com
    lnurl_pay_enabled BOOLEAN DEFAULT TRUE,
    lightning_wallet_connected BOOLEAN DEFAULT FALSE,

    -- User Roles and Status
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'creator', 'supporter', 'admin')),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended', 'banned')),
    email_verified BOOLEAN DEFAULT FALSE,
    kyc_verified BOOLEAN DEFAULT FALSE,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login_at TIMESTAMP WITH TIME ZONE,

    -- Creator Monetization Stats
    total_earnings_sats BIGINT DEFAULT 0,
    total_supporters INTEGER DEFAULT 0,
    avg_payment_sats INTEGER DEFAULT 0,

    -- Indexes for performance
    CONSTRAINT valid_nostr_pubkey CHECK (LENGTH(nostr_pubkey) = 64),
    CONSTRAINT valid_username CHECK (username ~ '^[a-zA-Z0-9_-]{3,50}$'),
    CONSTRAINT valid_lightning_address CHECK (lightning_address ~ '^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')
);

-- ⚡ LIGHTNING INVOICES TABLE
CREATE TABLE IF NOT EXISTS lightning_invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Invoice Details
    bolt11 TEXT NOT NULL, -- Lightning invoice payment request
    payment_hash VARCHAR(64) UNIQUE NOT NULL,
    amount_sats BIGINT NOT NULL CHECK (amount_sats > 0),
    description TEXT NOT NULL,
    memo TEXT,

    -- LNbits Integration
    lnbits_id VARCHAR(255), -- LNbits checking_id
    lnbits_wallet_id VARCHAR(255),

    -- Status and Timing
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'expired', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    paid_at TIMESTAMP WITH TIME ZONE,

    -- User Relations
    creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    supporter_id UUID REFERENCES users(id) ON DELETE SET NULL,
    supporter_nostr_pubkey VARCHAR(64), -- For anonymous payments

    -- Payment Context
    payment_type VARCHAR(20) DEFAULT 'support' CHECK (payment_type IN ('support', 'tip', 'subscription', 'product')),
    metadata JSONB DEFAULT '{}',

    -- Indexes
    INDEX idx_lightning_invoices_payment_hash ON lightning_invoices(payment_hash),
    INDEX idx_lightning_invoices_creator ON lightning_invoices(creator_id),
    INDEX idx_lightning_invoices_status ON lightning_invoices(status),
    INDEX idx_lightning_invoices_created_at ON lightning_invoices(created_at DESC)
);

-- ⚡ LIGHTNING PAYMENTS TABLE
CREATE TABLE IF NOT EXISTS lightning_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Payment Details
    invoice_id UUID NOT NULL REFERENCES lightning_invoices(id) ON DELETE CASCADE,
    amount_sats BIGINT NOT NULL CHECK (amount_sats > 0),
    fee_sats BIGINT DEFAULT 0 CHECK (fee_sats >= 0),

    -- Lightning Network Details
    preimage VARCHAR(64),
    payment_hash VARCHAR(64) NOT NULL,

    -- Status and Timing
    status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
    settled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- User Relations
    creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    supporter_id UUID REFERENCES users(id) ON DELETE SET NULL,

    -- Payment Context
    memo TEXT,
    metadata JSONB DEFAULT '{}',

    -- NOSTR Integration
    nostr_event_id VARCHAR(64), -- NOSTR event published for this payment
    nostr_published BOOLEAN DEFAULT FALSE,

    -- Indexes
    INDEX idx_lightning_payments_invoice ON lightning_payments(invoice_id),
    INDEX idx_lightning_payments_creator ON lightning_payments(creator_id),
    INDEX idx_lightning_payments_supporter ON lightning_payments(supporter_id),
    INDEX idx_lightning_payments_settled_at ON lightning_payments(settled_at DESC),
    UNIQUE(invoice_id) -- One payment per invoice
);

-- 📧 LIGHTNING ADDRESSES TABLE
CREATE TABLE IF NOT EXISTS lightning_addresses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Address Details
    identifier VARCHAR(100) NOT NULL, -- e.g., "creator"
    domain VARCHAR(255) NOT NULL,     -- e.g., "sovren.com"
    full_address VARCHAR(255) GENERATED ALWAYS AS (identifier || '@' || domain) STORED,

    -- User Relations
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Configuration
    active BOOLEAN DEFAULT TRUE,
    min_amount_sats INTEGER DEFAULT 1,
    max_amount_sats INTEGER DEFAULT 1000000,
    comment_allowed INTEGER DEFAULT 280,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Analytics
    total_payments BIGINT DEFAULT 0,
    total_amount_sats BIGINT DEFAULT 0,

    -- Constraints
    UNIQUE(identifier, domain),
    UNIQUE(user_id), -- One address per user
    CONSTRAINT valid_identifier CHECK (identifier ~ '^[a-zA-Z0-9._-]+$'),
    CONSTRAINT valid_domain CHECK (domain ~ '^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'),

    -- Indexes
    INDEX idx_lightning_addresses_full ON lightning_addresses(full_address),
    INDEX idx_lightning_addresses_user ON lightning_addresses(user_id),
    INDEX idx_lightning_addresses_active ON lightning_addresses(active)
);

-- 🔔 LIGHTNING WEBHOOKS TABLE
CREATE TABLE IF NOT EXISTS lightning_webhooks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Webhook Details
    webhook_type VARCHAR(50) NOT NULL,
    payload JSONB NOT NULL,
    signature VARCHAR(255),

    -- Processing Status
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'failed', 'ignored')),
    processed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,

    -- Related Entities
    invoice_id UUID REFERENCES lightning_invoices(id) ON DELETE SET NULL,
    payment_id UUID REFERENCES lightning_payments(id) ON DELETE SET NULL,

    -- Timestamps
    received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Indexes
    INDEX idx_lightning_webhooks_status ON lightning_webhooks(status),
    INDEX idx_lightning_webhooks_type ON lightning_webhooks(webhook_type),
    INDEX idx_lightning_webhooks_received_at ON lightning_webhooks(received_at DESC)
);

-- 📊 LIGHTNING ANALYTICS TABLE
CREATE TABLE IF NOT EXISTS lightning_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Time Dimension
    date DATE NOT NULL,
    hour INTEGER CHECK (hour >= 0 AND hour <= 23),

    -- Creator Dimension
    creator_id UUID REFERENCES users(id) ON DELETE CASCADE,

    -- Metrics
    invoices_created INTEGER DEFAULT 0,
    invoices_paid INTEGER DEFAULT 0,
    invoices_expired INTEGER DEFAULT 0,
    total_amount_sats BIGINT DEFAULT 0,
    total_fees_sats BIGINT DEFAULT 0,
    unique_supporters INTEGER DEFAULT 0,
    avg_payment_sats INTEGER DEFAULT 0,

    -- Aggregation Level
    granularity VARCHAR(10) CHECK (granularity IN ('hourly', 'daily')),

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Constraints
    UNIQUE(date, hour, creator_id, granularity),

    -- Indexes
    INDEX idx_lightning_analytics_date ON lightning_analytics(date DESC),
    INDEX idx_lightning_analytics_creator ON lightning_analytics(creator_id),
    INDEX idx_lightning_analytics_granularity ON lightning_analytics(granularity)
);

-- 🔐 Session Management Tables

-- User Sessions Table
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    jwt_token_hash VARCHAR(64) NOT NULL UNIQUE,
    nostr_pubkey VARCHAR(64) NOT NULL,
    ip_address INET NOT NULL,
    user_agent TEXT NOT NULL,
    device_info JSONB NOT NULL DEFAULT '{}',
    lightning_enabled BOOLEAN DEFAULT false,
    lightning_permissions JSONB DEFAULT '{}',
    location JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    active BOOLEAN DEFAULT true,

    -- Constraints
    CONSTRAINT user_sessions_expires_at_check CHECK (expires_at > created_at),
    CONSTRAINT user_sessions_device_info_check CHECK (
        device_info ? 'deviceType' AND
        device_info ? 'browser' AND
        device_info ? 'os' AND
        device_info ? 'fingerprint'
    )
);

-- Session Activity Log Table
CREATE TABLE IF NOT EXISTS session_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES user_sessions(id) ON DELETE CASCADE,
    activity_type VARCHAR(50) NOT NULL CHECK (
        activity_type IN ('login', 'api_call', 'page_view', 'logout', 'token_refresh')
    ),
    metadata JSONB DEFAULT '{}',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ip_address INET,
    user_agent TEXT
);

-- 📊 Indexes for Session Management

-- Primary lookup indexes
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token_hash ON user_sessions(jwt_token_hash);
CREATE INDEX IF NOT EXISTS idx_user_sessions_nostr_pubkey ON user_sessions(nostr_pubkey);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(active) WHERE active = true;

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_last_activity ON user_sessions(last_activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_sessions_created_at ON user_sessions(created_at DESC);

-- Device and location indexes
CREATE INDEX IF NOT EXISTS idx_user_sessions_device_type ON user_sessions
    USING GIN ((device_info->>'deviceType'));
CREATE INDEX IF NOT EXISTS idx_user_sessions_ip_address ON user_sessions(ip_address);

-- Activity log indexes
CREATE INDEX IF NOT EXISTS idx_session_activity_session_id ON session_activity(session_id);
CREATE INDEX IF NOT EXISTS idx_session_activity_timestamp ON session_activity(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_session_activity_type ON session_activity(activity_type);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_active ON user_sessions(user_id, active);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_activity ON user_sessions(user_id, last_activity_at DESC);

-- 🔒 Row Level Security (RLS) for Session Management

-- Enable RLS on session tables
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_activity ENABLE ROW LEVEL SECURITY;

-- User can only access their own sessions
CREATE POLICY user_sessions_access_policy ON user_sessions
    FOR ALL
    TO authenticated
    USING (user_id = auth.uid());

-- User can only access activity for their own sessions
CREATE POLICY session_activity_access_policy ON session_activity
    FOR ALL
    TO authenticated
    USING (
        session_id IN (
            SELECT id FROM user_sessions
            WHERE user_id = auth.uid()
        )
    );

-- 🔧 Session Management Functions

-- Function to cleanup expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    cleanup_count INTEGER;
BEGIN
    -- Deactivate expired sessions
    UPDATE user_sessions
    SET active = false,
        last_activity_at = CURRENT_TIMESTAMP
    WHERE expires_at < CURRENT_TIMESTAMP
      AND active = true;

    GET DIAGNOSTICS cleanup_count = ROW_COUNT;

    -- Log cleanup activity
    INSERT INTO session_activity (session_id, activity_type, metadata, timestamp)
    SELECT
        id,
        'logout',
        jsonb_build_object('reason', 'expired', 'cleanup_batch', true),
        CURRENT_TIMESTAMP
    FROM user_sessions
    WHERE expires_at < CURRENT_TIMESTAMP
      AND active = false
      AND last_activity_at >= CURRENT_TIMESTAMP - INTERVAL '1 minute';

    RETURN cleanup_count;
END;
$$;

-- Function to enforce session limits per user
CREATE OR REPLACE FUNCTION enforce_session_limits()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    session_count INTEGER;
    oldest_session_id UUID;
    max_sessions INTEGER := 10;
BEGIN
    -- Count active sessions for the user
    SELECT COUNT(*) INTO session_count
    FROM user_sessions
    WHERE user_id = NEW.user_id AND active = true;

    -- If at limit, deactivate oldest session
    IF session_count >= max_sessions THEN
        SELECT id INTO oldest_session_id
        FROM user_sessions
        WHERE user_id = NEW.user_id AND active = true
        ORDER BY last_activity_at ASC
        LIMIT 1;

        UPDATE user_sessions
        SET active = false,
            last_activity_at = CURRENT_TIMESTAMP
        WHERE id = oldest_session_id;

        -- Log forced logout
        INSERT INTO session_activity (session_id, activity_type, metadata, timestamp)
        VALUES (
            oldest_session_id,
            'logout',
            jsonb_build_object('reason', 'session_limit_exceeded', 'max_sessions', max_sessions),
            CURRENT_TIMESTAMP
        );
    END IF;

    RETURN NEW;
END;
$$;

-- Trigger to enforce session limits
CREATE TRIGGER trigger_enforce_session_limits
    BEFORE INSERT ON user_sessions
    FOR EACH ROW
    EXECUTE FUNCTION enforce_session_limits();

-- Function to get session statistics
CREATE OR REPLACE FUNCTION get_session_stats(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    stats JSONB;
BEGIN
    SELECT jsonb_build_object(
        'total_active_sessions', COUNT(*),
        'sessions_by_device', jsonb_object_agg(
            device_info->>'deviceType',
            device_count
        ),
        'recent_activity', COUNT(*) FILTER (
            WHERE last_activity_at > CURRENT_TIMESTAMP - INTERVAL '1 day'
        ),
        'oldest_session', MIN(created_at),
        'most_recent_activity', MAX(last_activity_at)
    ) INTO stats
    FROM (
        SELECT
            device_info,
            last_activity_at,
            created_at,
            COUNT(*) OVER (PARTITION BY device_info->>'deviceType') as device_count
        FROM user_sessions
        WHERE user_id = p_user_id AND active = true
    ) session_data;

    RETURN COALESCE(stats, '{}'::jsonb);
END;
$$;

-- 📅 Scheduled Cleanup Job (PostgreSQL cron extension)
-- Note: Requires pg_cron extension to be installed
-- SELECT cron.schedule('cleanup-expired-sessions', '0 */6 * * *', 'SELECT cleanup_expired_sessions();');

-- 🔍 Useful Views for Session Management

-- Active Sessions View
CREATE OR REPLACE VIEW active_sessions AS
SELECT
    s.*,
    u.username,
    u.email,
    CASE
        WHEN s.last_activity_at > CURRENT_TIMESTAMP - INTERVAL '5 minutes' THEN 'active'
        WHEN s.last_activity_at > CURRENT_TIMESTAMP - INTERVAL '1 hour' THEN 'idle'
        ELSE 'inactive'
    END as status,
    EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - s.last_activity_at)) as seconds_since_activity
FROM user_sessions s
JOIN users u ON s.user_id = u.id
WHERE s.active = true AND s.expires_at > CURRENT_TIMESTAMP;

-- Session Activity Summary View
CREATE OR REPLACE VIEW session_activity_summary AS
SELECT
    s.id as session_id,
    s.user_id,
    COUNT(a.id) as total_activities,
    MAX(a.timestamp) as last_activity,
    COUNT(a.id) FILTER (WHERE a.activity_type = 'api_call') as api_calls,
    COUNT(a.id) FILTER (WHERE a.activity_type = 'page_view') as page_views,
    COUNT(a.id) FILTER (WHERE a.timestamp > CURRENT_TIMESTAMP - INTERVAL '1 day') as recent_activities
FROM user_sessions s
LEFT JOIN session_activity a ON s.id = a.session_id
WHERE s.active = true
GROUP BY s.id, s.user_id;

-- 🗂️ NOSTR CHALLENGES (Enhanced)
CREATE TABLE IF NOT EXISTS nostr_challenges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    challenge VARCHAR(255) UNIQUE NOT NULL,
    nostr_pubkey VARCHAR(64) NOT NULL,

    -- Challenge Context
    purpose VARCHAR(50) DEFAULT 'authentication' CHECK (purpose IN ('authentication', 'lightning_auth', 'payment_auth')),
    metadata JSONB DEFAULT '{}',

    -- Status and Timing
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '5 minutes'),

    -- Indexes
    INDEX idx_nostr_challenges_challenge ON nostr_challenges(challenge),
    INDEX idx_nostr_challenges_pubkey ON nostr_challenges(nostr_pubkey),
    INDEX idx_nostr_challenges_expires_at ON nostr_challenges(expires_at)
);

-- 📈 USER ACTIVITY LOG (Enhanced)
CREATE TABLE IF NOT EXISTS user_activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,

    -- Activity Details
    activity_type VARCHAR(50) NOT NULL,
    description TEXT,
    metadata JSONB DEFAULT '{}',

    -- Lightning-specific Activities
    lightning_invoice_id UUID REFERENCES lightning_invoices(id) ON DELETE SET NULL,
    lightning_payment_id UUID REFERENCES lightning_payments(id) ON DELETE SET NULL,
    amount_sats BIGINT,

    -- Context
    ip_address INET,
    user_agent TEXT,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Indexes
    INDEX idx_user_activity_user_id ON user_activity_log(user_id),
    INDEX idx_user_activity_type ON user_activity_log(activity_type),
    INDEX idx_user_activity_created_at ON user_activity_log(created_at DESC),
    INDEX idx_user_activity_lightning ON user_activity_log(lightning_invoice_id, lightning_payment_id)
);

-- 🏥 HEALTH CHECK TABLE
CREATE TABLE IF NOT EXISTS health_checks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_name VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('healthy', 'degraded', 'unhealthy')),
    response_time_ms INTEGER,
    details JSONB DEFAULT '{}',

    -- Lightning-specific health checks
    lightning_service_status VARCHAR(20),
    lnbits_connection BOOLEAN,
    wallet_balance_sats BIGINT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Indexes
    INDEX idx_health_checks_service ON health_checks(service_name),
    INDEX idx_health_checks_status ON health_checks(status),
    INDEX idx_health_checks_created_at ON health_checks(created_at DESC)
);

-- 🚀 PERFORMANCE INDEXES
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_nostr_pubkey_hash ON users USING hash(nostr_pubkey);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_role_status ON users(role, status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_lightning_address ON users(lightning_address) WHERE lightning_address IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lightning_invoices_composite ON lightning_invoices(creator_id, status, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lightning_payments_composite ON lightning_payments(creator_id, settled_at DESC);

-- 🔄 UPDATE TRIGGERS

-- Update user updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lightning_addresses_updated_at BEFORE UPDATE ON lightning_addresses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lightning_analytics_updated_at BEFORE UPDATE ON lightning_analytics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 📊 ANALYTICS FUNCTIONS

-- Update user earnings when payment is completed
CREATE OR REPLACE FUNCTION update_user_earnings()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
        UPDATE users SET
            total_earnings_sats = total_earnings_sats + NEW.amount_sats,
            total_supporters = (
                SELECT COUNT(DISTINCT supporter_id)
                FROM lightning_payments
                WHERE creator_id = NEW.creator_id AND status = 'completed'
            ),
            avg_payment_sats = (
                SELECT COALESCE(AVG(amount_sats), 0)::INTEGER
                FROM lightning_payments
                WHERE creator_id = NEW.creator_id AND status = 'completed'
            )
        WHERE id = NEW.creator_id;

        -- Update Lightning address stats
        UPDATE lightning_addresses SET
            total_payments = total_payments + 1,
            total_amount_sats = total_amount_sats + NEW.amount_sats
        WHERE user_id = NEW.creator_id;
    END IF;

    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_earnings_trigger
    AFTER INSERT OR UPDATE ON lightning_payments
    FOR EACH ROW EXECUTE FUNCTION update_user_earnings();

-- 🧹 CLEANUP FUNCTIONS

-- Clean up expired challenges
CREATE OR REPLACE FUNCTION cleanup_expired_challenges()
RETURNS void AS $$
BEGIN
    DELETE FROM nostr_challenges WHERE expires_at < NOW();
END;
$$ language 'plpgsql';

-- 🎯 SAMPLE DATA FOR DEVELOPMENT
INSERT INTO users (nostr_pubkey, username, display_name, role, lightning_address, lnurl_pay_enabled) VALUES
    ('1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef', 'testcreator', 'Test Creator', 'creator', 'testcreator@sovren.com', true),
    ('abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890', 'testsupporter', 'Test Supporter', 'supporter', NULL, false)
ON CONFLICT (nostr_pubkey) DO NOTHING;

-- 🔍 NIP-05 Verification System Tables
-- WHY: Comprehensive NOSTR identity verification with domain validation

-- NIP-05 Verification Records
CREATE TABLE IF NOT EXISTS nip05_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nostr_pubkey VARCHAR(64) NOT NULL,
  nip05_identifier VARCHAR(320) NOT NULL,
  domain VARCHAR(253) NOT NULL,
  local_part VARCHAR(64) NOT NULL,
  verification_status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (verification_status IN ('pending', 'verified', 'failed', 'expired', 'revoked')),
  verification_method VARCHAR(10) NOT NULL DEFAULT 'http'
    CHECK (verification_method IN ('http', 'dns', 'manual')),
  verification_data JSONB NOT NULL DEFAULT '{}',
  verified_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  last_checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  check_count INTEGER NOT NULL DEFAULT 0,
  failure_reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Domain Verification Configuration
CREATE TABLE IF NOT EXISTS nip05_domain_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain VARCHAR(253) NOT NULL UNIQUE,
  verification_methods TEXT[] NOT NULL DEFAULT ARRAY['http', 'dns'],
  auto_verify BOOLEAN NOT NULL DEFAULT true,
  verification_interval INTEGER NOT NULL DEFAULT 24, -- hours
  max_verifications_per_domain INTEGER NOT NULL DEFAULT 1000,
  trusted_domain BOOLEAN NOT NULL DEFAULT false,
  custom_validation_rules JSONB NOT NULL DEFAULT '{}',
  admin_contact VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- NIP-05 Verification History
CREATE TABLE IF NOT EXISTS nip05_verification_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  verification_id UUID NOT NULL REFERENCES nip05_verifications(id) ON DELETE CASCADE,
  status_from VARCHAR(20) NOT NULL,
  status_to VARCHAR(20) NOT NULL,
  verification_method VARCHAR(10) NOT NULL,
  verification_data JSONB NOT NULL DEFAULT '{}',
  error_message TEXT,
  response_time_ms INTEGER,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Well-Known NOSTR JSON Cache
CREATE TABLE IF NOT EXISTS nip05_wellknown_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain VARCHAR(253) NOT NULL,
  cache_key VARCHAR(512) NOT NULL,
  response_data JSONB NOT NULL,
  response_headers JSONB NOT NULL DEFAULT '{}',
  http_status INTEGER NOT NULL,
  cache_expires_at TIMESTAMPTZ NOT NULL,
  last_fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fetch_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(domain, cache_key)
);

-- DNS TXT Record Cache
CREATE TABLE IF NOT EXISTS nip05_dns_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain VARCHAR(253) NOT NULL,
  record_type VARCHAR(10) NOT NULL DEFAULT 'TXT',
  record_name VARCHAR(512) NOT NULL,
  record_value TEXT NOT NULL,
  ttl INTEGER NOT NULL DEFAULT 3600,
  cache_expires_at TIMESTAMPTZ NOT NULL,
  last_resolved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolution_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(domain, record_name, record_type)
);

-- 📊 Performance Indexes for NIP-05 System

-- Primary lookup indexes
CREATE INDEX IF NOT EXISTS idx_nip05_verifications_user_id ON nip05_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_nip05_verifications_nostr_pubkey ON nip05_verifications(nostr_pubkey);
CREATE INDEX IF NOT EXISTS idx_nip05_verifications_identifier ON nip05_verifications(nip05_identifier);
CREATE INDEX IF NOT EXISTS idx_nip05_verifications_domain ON nip05_verifications(domain);
CREATE INDEX IF NOT EXISTS idx_nip05_verifications_status ON nip05_verifications(verification_status);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_nip05_verifications_status_method ON nip05_verifications(verification_status, verification_method);
CREATE INDEX IF NOT EXISTS idx_nip05_verifications_domain_status ON nip05_verifications(domain, verification_status);
CREATE INDEX IF NOT EXISTS idx_nip05_verifications_user_status ON nip05_verifications(user_id, verification_status);

-- Time-based indexes for maintenance
CREATE INDEX IF NOT EXISTS idx_nip05_verifications_expires_at ON nip05_verifications(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_nip05_verifications_last_checked ON nip05_verifications(last_checked_at);
CREATE INDEX IF NOT EXISTS idx_nip05_verifications_created_at ON nip05_verifications(created_at);

-- Unique constraints
CREATE UNIQUE INDEX IF NOT EXISTS idx_nip05_verifications_unique_verified
  ON nip05_verifications(nip05_identifier)
  WHERE verification_status = 'verified';

-- History table indexes
CREATE INDEX IF NOT EXISTS idx_nip05_history_verification_id ON nip05_verification_history(verification_id);
CREATE INDEX IF NOT EXISTS idx_nip05_history_created_at ON nip05_verification_history(created_at);
CREATE INDEX IF NOT EXISTS idx_nip05_history_status_transition ON nip05_verification_history(status_from, status_to);

-- Cache table indexes
CREATE INDEX IF NOT EXISTS idx_nip05_wellknown_cache_domain ON nip05_wellknown_cache(domain);
CREATE INDEX IF NOT EXISTS idx_nip05_wellknown_cache_expires ON nip05_wellknown_cache(cache_expires_at);
CREATE INDEX IF NOT EXISTS idx_nip05_dns_cache_domain ON nip05_dns_cache(domain);
CREATE INDEX IF NOT EXISTS idx_nip05_dns_cache_expires ON nip05_dns_cache(cache_expires_at);

-- Domain config indexes
CREATE INDEX IF NOT EXISTS idx_nip05_domain_configs_domain ON nip05_domain_configs(domain);
CREATE INDEX IF NOT EXISTS idx_nip05_domain_configs_trusted ON nip05_domain_configs(trusted_domain);

-- 🔧 Database Functions for NIP-05 System

-- Function to update verification timestamps
CREATE OR REPLACE FUNCTION update_nip05_verification_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for automatic timestamp updates
DROP TRIGGER IF EXISTS trigger_nip05_verification_updated_at ON nip05_verifications;
CREATE TRIGGER trigger_nip05_verification_updated_at
  BEFORE UPDATE ON nip05_verifications
  FOR EACH ROW
  EXECUTE FUNCTION update_nip05_verification_timestamp();

-- Function to create verification history entry
CREATE OR REPLACE FUNCTION log_nip05_verification_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log status changes
  IF OLD.verification_status != NEW.verification_status THEN
    INSERT INTO nip05_verification_history (
      verification_id,
      status_from,
      status_to,
      verification_method,
      verification_data,
      error_message,
      response_time_ms
    ) VALUES (
      NEW.id,
      OLD.verification_status,
      NEW.verification_status,
      NEW.verification_method,
      NEW.verification_data,
      NEW.failure_reason,
      EXTRACT(EPOCH FROM (NOW() - OLD.updated_at))::INTEGER * 1000
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for verification history logging
DROP TRIGGER IF EXISTS trigger_nip05_verification_history ON nip05_verifications;
CREATE TRIGGER trigger_nip05_verification_history
  AFTER UPDATE ON nip05_verifications
  FOR EACH ROW
  EXECUTE FUNCTION log_nip05_verification_change();

-- Function to clean up expired cache entries
CREATE OR REPLACE FUNCTION cleanup_nip05_cache()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER := 0;
BEGIN
  -- Clean up expired well-known cache
  DELETE FROM nip05_wellknown_cache WHERE cache_expires_at < NOW();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  -- Clean up expired DNS cache
  DELETE FROM nip05_dns_cache WHERE cache_expires_at < NOW();
  GET DIAGNOSTICS deleted_count = deleted_count + ROW_COUNT;

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get domain verification stats
CREATE OR REPLACE FUNCTION get_nip05_domain_stats(domain_name VARCHAR(253))
RETURNS TABLE (
  total_verifications BIGINT,
  verified_count BIGINT,
  pending_count BIGINT,
  failed_count BIGINT,
  expired_count BIGINT,
  revoked_count BIGINT,
  avg_verification_time INTERVAL,
  last_verification TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) as total_verifications,
    COUNT(*) FILTER (WHERE verification_status = 'verified') as verified_count,
    COUNT(*) FILTER (WHERE verification_status = 'pending') as pending_count,
    COUNT(*) FILTER (WHERE verification_status = 'failed') as failed_count,
    COUNT(*) FILTER (WHERE verification_status = 'expired') as expired_count,
    COUNT(*) FILTER (WHERE verification_status = 'revoked') as revoked_count,
    AVG(verified_at - created_at) FILTER (WHERE verified_at IS NOT NULL) as avg_verification_time,
    MAX(created_at) as last_verification
  FROM nip05_verifications
  WHERE domain = domain_name;
END;
$$ LANGUAGE plpgsql;

-- Function to find expired verifications
CREATE OR REPLACE FUNCTION find_expired_nip05_verifications()
RETURNS TABLE (
  verification_id UUID,
  nip05_identifier VARCHAR(320),
  expires_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    id,
    nip05_identifier,
    expires_at
  FROM nip05_verifications
  WHERE verification_status = 'verified'
    AND expires_at IS NOT NULL
    AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- 🔒 Row Level Security (RLS) for NIP-05 Tables

-- Enable RLS on verification tables
ALTER TABLE nip05_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE nip05_verification_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE nip05_domain_configs ENABLE ROW LEVEL SECURITY;

-- Users can only see their own verifications
CREATE POLICY nip05_verifications_user_policy ON nip05_verifications
  FOR ALL USING (
    auth.uid()::text = user_id::text OR
    auth.jwt() ->> 'role' = 'admin'
  );

-- Users can see their own verification history
CREATE POLICY nip05_history_user_policy ON nip05_verification_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM nip05_verifications
      WHERE id = verification_id
        AND (auth.uid()::text = user_id::text OR auth.jwt() ->> 'role' = 'admin')
    )
  );

-- Domain configs are readable by all, writable by admins
CREATE POLICY nip05_domain_configs_read_policy ON nip05_domain_configs
  FOR SELECT USING (true);

CREATE POLICY nip05_domain_configs_write_policy ON nip05_domain_configs
  FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

-- Cache tables are system-only (no RLS needed as they're internal)
ALTER TABLE nip05_wellknown_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE nip05_dns_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY nip05_cache_system_policy ON nip05_wellknown_cache
  FOR ALL USING (auth.jwt() ->> 'role' = 'service');

CREATE POLICY nip05_dns_cache_system_policy ON nip05_dns_cache
  FOR ALL USING (auth.jwt() ->> 'role' = 'service');

-- 📊 Insert default domain configurations
INSERT INTO nip05_domain_configs (
  domain,
  verification_methods,
  auto_verify,
  trusted_domain,
  max_verifications_per_domain,
  admin_contact,
  notes
) VALUES
  ('sovren.app', ARRAY['http', 'dns'], true, true, 10000, 'admin@sovren.app', 'Sovren official domain'),
  ('localhost', ARRAY['http'], true, true, 1000, 'dev@sovren.app', 'Development domain'),
  ('example.com', ARRAY['http', 'dns'], false, false, 100, null, 'Example domain for testing')
ON CONFLICT (domain) DO NOTHING;
