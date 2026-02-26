-- BASELINE MIGRATION - SOVREN DATABASE SCHEMA
-- Must run before all other migrations
-- Adapted from baseline/001_baseline_schema.sql with syntax fixes

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Migration tracking
CREATE TABLE IF NOT EXISTS migration_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    migration_name VARCHAR(255) NOT NULL UNIQUE,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    rollback_at TIMESTAMP WITH TIME ZONE,
    description TEXT,
    execution_time_ms INTEGER,
    applied_by VARCHAR(100) DEFAULT current_user,
    status VARCHAR(20) DEFAULT 'success' CHECK (status IN ('success', 'failed', 'rolled_back')),
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS migration_performance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    migration_name VARCHAR(255) NOT NULL,
    table_name VARCHAR(100),
    operation_type VARCHAR(50),
    execution_time_ms INTEGER,
    rows_affected INTEGER,
    before_size_bytes BIGINT,
    after_size_bytes BIGINT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS migration_backups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    migration_name VARCHAR(255) NOT NULL,
    backup_table VARCHAR(100) NOT NULL,
    backup_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    record_count INTEGER,
    cleanup_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Core user system
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nostr_pubkey VARCHAR(64) UNIQUE NOT NULL,
    username VARCHAR(50) UNIQUE,
    display_name VARCHAR(100),
    bio TEXT,
    avatar_url TEXT,
    banner_url TEXT,
    website_url TEXT,
    nip05_verified BOOLEAN DEFAULT FALSE,
    lightning_address VARCHAR(255),
    lnurl_pay_enabled BOOLEAN DEFAULT TRUE,
    lightning_wallet_connected BOOLEAN DEFAULT FALSE,
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'creator', 'supporter', 'admin')),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended', 'banned')),
    email_verified BOOLEAN DEFAULT FALSE,
    kyc_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login_at TIMESTAMP WITH TIME ZONE,
    total_earnings_sats BIGINT DEFAULT 0,
    total_supporters INTEGER DEFAULT 0,
    avg_payment_sats INTEGER DEFAULT 0,
    CONSTRAINT valid_nostr_pubkey CHECK (LENGTH(nostr_pubkey) = 64)
);

-- Content management
CREATE TABLE IF NOT EXISTS content (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content_type VARCHAR(50) NOT NULL CHECK (content_type IN ('article', 'video', 'audio', 'image', 'livestream', 'course')),
    description TEXT,
    content_url TEXT,
    thumbnail_url TEXT,
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived', 'deleted')),
    visibility VARCHAR(20) DEFAULT 'public' CHECK (visibility IN ('public', 'private', 'supporters_only', 'paid')),
    is_monetized BOOLEAN DEFAULT FALSE,
    price_sats INTEGER DEFAULT 0,
    payment_required BOOLEAN DEFAULT FALSE,
    view_count INTEGER DEFAULT 0,
    like_count INTEGER DEFAULT 0,
    comment_count INTEGER DEFAULT 0,
    share_count INTEGER DEFAULT 0,
    tags TEXT[],
    category VARCHAR(50),
    language VARCHAR(10) DEFAULT 'en',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    published_at TIMESTAMP WITH TIME ZONE,
    search_vector tsvector
);

-- Payments
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payer_id UUID REFERENCES users(id) ON DELETE SET NULL,
    recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content_id UUID REFERENCES content(id) ON DELETE SET NULL,
    amount_sats BIGINT NOT NULL CHECK (amount_sats > 0),
    currency VARCHAR(10) DEFAULT 'BTC',
    payment_type VARCHAR(20) NOT NULL CHECK (payment_type IN ('tip', 'subscription', 'one_time', 'commission')),
    payment_hash VARCHAR(64) UNIQUE,
    payment_request TEXT,
    preimage VARCHAR(64),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'refunded', 'expired')),
    description TEXT,
    memo TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    paid_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    payment_method VARCHAR(50),
    fee_sats INTEGER DEFAULT 0,
    CONSTRAINT valid_payment_hash CHECK (LENGTH(payment_hash) = 64 OR payment_hash IS NULL),
    CONSTRAINT valid_preimage CHECK (LENGTH(preimage) = 64 OR preimage IS NULL)
);

-- Social: followers
CREATE TABLE IF NOT EXISTS followers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    notification_enabled BOOLEAN DEFAULT TRUE,
    UNIQUE(follower_id, following_id),
    CONSTRAINT no_self_follow CHECK (follower_id != following_id)
);

-- Social: comments
CREATE TABLE IF NOT EXISTS comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content_id UUID NOT NULL REFERENCES content(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    comment_text TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'hidden', 'deleted', 'moderated')),
    like_count INTEGER DEFAULT 0,
    reply_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT valid_comment_length CHECK (LENGTH(comment_text) > 0 AND LENGTH(comment_text) <= 2000)
);

-- Analytics
CREATE TABLE IF NOT EXISTS content_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content_id UUID NOT NULL REFERENCES content(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    event_type VARCHAR(50) NOT NULL,
    event_data JSONB,
    user_agent TEXT,
    ip_address INET,
    referrer TEXT,
    session_id VARCHAR(255),
    country VARCHAR(2),
    region VARCHAR(100),
    city VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_nostr_pubkey ON users(nostr_pubkey);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_lightning_address ON users(lightning_address);

CREATE INDEX IF NOT EXISTS idx_content_creator_id ON content(creator_id);
CREATE INDEX IF NOT EXISTS idx_content_status ON content(status);
CREATE INDEX IF NOT EXISTS idx_content_visibility ON content(visibility);
CREATE INDEX IF NOT EXISTS idx_content_type ON content(content_type);
CREATE INDEX IF NOT EXISTS idx_content_created_at ON content(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_published_at ON content(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_category ON content(category);
CREATE INDEX IF NOT EXISTS idx_content_tags ON content USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_content_search ON content USING GIN(search_vector);

CREATE INDEX IF NOT EXISTS idx_payments_payer_id ON payments(payer_id);
CREATE INDEX IF NOT EXISTS idx_payments_recipient_id ON payments(recipient_id);
CREATE INDEX IF NOT EXISTS idx_payments_content_id ON payments(content_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_payment_hash ON payments(payment_hash);

CREATE INDEX IF NOT EXISTS idx_followers_follower_id ON followers(follower_id);
CREATE INDEX IF NOT EXISTS idx_followers_following_id ON followers(following_id);
CREATE INDEX IF NOT EXISTS idx_comments_content_id ON comments(content_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments(parent_comment_id);

CREATE INDEX IF NOT EXISTS idx_analytics_content_event_time ON content_analytics(content_id, event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_user_time ON content_analytics(user_id, created_at);

-- RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE content ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE followers ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_public_or_own" ON users
    FOR SELECT USING (id = auth.uid() OR role != 'admin');

CREATE POLICY "users_update_own" ON users
    FOR UPDATE USING (id = auth.uid());

CREATE POLICY "content_select_public" ON content
    FOR SELECT USING (
        visibility = 'public' OR
        creator_id = auth.uid() OR
        (visibility = 'supporters_only' AND EXISTS (
            SELECT 1 FROM followers WHERE following_id = creator_id AND follower_id = auth.uid()
        ))
    );

CREATE POLICY "content_insert_own" ON content
    FOR INSERT WITH CHECK (creator_id = auth.uid());

CREATE POLICY "content_update_own" ON content
    FOR UPDATE USING (creator_id = auth.uid());

CREATE POLICY "payments_select_own" ON payments
    FOR SELECT USING (payer_id = auth.uid() OR recipient_id = auth.uid());

CREATE POLICY "payments_insert_own" ON payments
    FOR INSERT WITH CHECK (payer_id = auth.uid() OR recipient_id = auth.uid());

CREATE POLICY "comments_select_public" ON comments
    FOR SELECT USING (status = 'active');

CREATE POLICY "comments_insert_own" ON comments
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "comments_update_own" ON comments
    FOR UPDATE USING (user_id = auth.uid());

-- Triggers
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_users_updated_at
    BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_content_updated_at
    BEFORE UPDATE ON content FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_payments_updated_at
    BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_comments_updated_at
    BEFORE UPDATE ON comments FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE FUNCTION update_content_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector = to_tsvector('english',
        COALESCE(NEW.title, '') || ' ' ||
        COALESCE(NEW.description, '') || ' ' ||
        COALESCE(array_to_string(NEW.tags, ' '), '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_content_search_vector
    BEFORE INSERT OR UPDATE ON content FOR EACH ROW EXECUTE FUNCTION update_content_search_vector();
