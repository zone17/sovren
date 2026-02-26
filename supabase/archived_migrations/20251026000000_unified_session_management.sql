-- =====================================================
-- US-311: Unified NOSTR Session Management Migration
-- WHY: Create database schema for unified session tracking
-- FEATURES: Multi-device support, activity tracking, automatic cleanup
-- =====================================================

-- DROP existing tables if running this migration again
DROP TABLE IF EXISTS unified_session_activities CASCADE;
DROP TABLE IF EXISTS unified_sessions CASCADE;
DROP FUNCTION IF EXISTS update_session_timestamp CASCADE;
DROP FUNCTION IF EXISTS cleanup_expired_sessions CASCADE;

-- =====================================================
-- UNIFIED SESSIONS TABLE
-- =====================================================

CREATE TABLE unified_sessions (
  -- Primary identification
  id VARCHAR(100) PRIMARY KEY,
  pubkey VARCHAR(64) NOT NULL,
  user_id VARCHAR(100) NOT NULL,

  -- Authentication
  token_hash VARCHAR(64) NOT NULL,

  -- Device tracking
  device_id VARCHAR(32) NOT NULL,
  device_fingerprint TEXT NOT NULL,
  device_info JSONB NOT NULL,

  -- Request metadata
  ip_address INET,
  user_agent TEXT,
  location JSONB,

  -- Lightning Network
  lightning_enabled BOOLEAN DEFAULT FALSE,
  lightning_permissions JSONB DEFAULT '{}'::jsonb,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  idle_timeout_at TIMESTAMP WITH TIME ZONE NOT NULL,

  -- Status
  active BOOLEAN DEFAULT TRUE NOT NULL,

  -- NOSTR integration
  nostr_event_id VARCHAR(64),
  session_signature VARCHAR(128),

  -- Authorization
  permissions TEXT[] DEFAULT ARRAY['read', 'write']::TEXT[],
  risk_score INTEGER DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),

  -- Metadata
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Indexes for performance
CREATE INDEX idx_unified_sessions_pubkey ON unified_sessions(pubkey);
CREATE INDEX idx_unified_sessions_user_id ON unified_sessions(user_id);
CREATE INDEX idx_unified_sessions_token_hash ON unified_sessions(token_hash);
CREATE INDEX idx_unified_sessions_device_id ON unified_sessions(device_id);
CREATE INDEX idx_unified_sessions_active ON unified_sessions(active);
CREATE INDEX idx_unified_sessions_expires_at ON unified_sessions(expires_at);
CREATE INDEX idx_unified_sessions_idle_timeout_at ON unified_sessions(idle_timeout_at);
CREATE INDEX idx_unified_sessions_last_activity ON unified_sessions(last_activity_at);
CREATE INDEX idx_unified_sessions_risk_score ON unified_sessions(risk_score);

-- Composite indexes for common queries
CREATE INDEX idx_unified_sessions_pubkey_active ON unified_sessions(pubkey, active);
CREATE INDEX idx_unified_sessions_user_active ON unified_sessions(user_id, active);

-- GIN index for JSONB queries
CREATE INDEX idx_unified_sessions_device_info ON unified_sessions USING GIN(device_info);
CREATE INDEX idx_unified_sessions_location ON unified_sessions USING GIN(location);

-- =====================================================
-- SESSION ACTIVITIES TABLE
-- =====================================================

CREATE TABLE unified_session_activities (
  -- Primary identification
  id VARCHAR(100) PRIMARY KEY,
  session_id VARCHAR(100) NOT NULL REFERENCES unified_sessions(id) ON DELETE CASCADE,
  pubkey VARCHAR(64) NOT NULL,

  -- Activity details
  activity_type VARCHAR(50) NOT NULL CHECK (
    activity_type IN ('login', 'api_call', 'page_view', 'logout', 'token_refresh', 'timeout', 'invalidation')
  ),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,

  -- Optional metadata
  details JSONB,
  nostr_event_id VARCHAR(64),

  -- Security tracking
  risk_score INTEGER DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
  ip_address INET,
  user_agent TEXT
);

-- Indexes for activity queries
CREATE INDEX idx_session_activities_session ON unified_session_activities(session_id);
CREATE INDEX idx_session_activities_pubkey ON unified_session_activities(pubkey);
CREATE INDEX idx_session_activities_type ON unified_session_activities(activity_type);
CREATE INDEX idx_session_activities_timestamp ON unified_session_activities(timestamp);
CREATE INDEX idx_session_activities_risk ON unified_session_activities(risk_score);

-- Composite indexes
CREATE INDEX idx_session_activities_session_time ON unified_session_activities(session_id, timestamp DESC);
CREATE INDEX idx_session_activities_pubkey_time ON unified_session_activities(pubkey, timestamp DESC);

-- GIN index for JSONB details
CREATE INDEX idx_session_activities_details ON unified_session_activities USING GIN(details);

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_session_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_session_timestamp
  BEFORE UPDATE ON unified_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_session_timestamp();

-- =====================================================
-- STORED PROCEDURES
-- =====================================================

-- Function to cleanup expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS TABLE(cleaned_count BIGINT) AS $$
DECLARE
  result BIGINT;
BEGIN
  -- Mark expired sessions as inactive
  UPDATE unified_sessions
  SET active = FALSE, updated_at = NOW()
  WHERE active = TRUE
    AND (expires_at < NOW() OR idle_timeout_at < NOW());

  GET DIAGNOSTICS result = ROW_COUNT;

  RETURN QUERY SELECT result;
END;
$$ LANGUAGE plpgsql;

-- Function to get session statistics
CREATE OR REPLACE FUNCTION get_session_statistics(p_pubkey VARCHAR)
RETURNS TABLE(
  total_sessions BIGINT,
  active_sessions BIGINT,
  desktop_sessions BIGINT,
  mobile_sessions BIGINT,
  tablet_sessions BIGINT,
  high_risk_sessions BIGINT,
  avg_risk_score NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_sessions,
    COUNT(*) FILTER (WHERE active = TRUE)::BIGINT as active_sessions,
    COUNT(*) FILTER (WHERE device_info->>'deviceType' = 'desktop')::BIGINT as desktop_sessions,
    COUNT(*) FILTER (WHERE device_info->>'deviceType' = 'mobile')::BIGINT as mobile_sessions,
    COUNT(*) FILTER (WHERE device_info->>'deviceType' = 'tablet')::BIGINT as tablet_sessions,
    COUNT(*) FILTER (WHERE risk_score > 70)::BIGINT as high_risk_sessions,
    ROUND(AVG(risk_score)::NUMERIC, 2) as avg_risk_score
  FROM unified_sessions
  WHERE pubkey = p_pubkey;
END;
$$ LANGUAGE plpgsql;

-- Function to revoke all sessions for a pubkey except one
CREATE OR REPLACE FUNCTION revoke_all_sessions_except(
  p_pubkey VARCHAR,
  p_except_session_id VARCHAR DEFAULT NULL
)
RETURNS TABLE(revoked_count BIGINT) AS $$
DECLARE
  result BIGINT;
BEGIN
  -- Mark sessions as inactive
  UPDATE unified_sessions
  SET active = FALSE, updated_at = NOW()
  WHERE pubkey = p_pubkey
    AND active = TRUE
    AND (p_except_session_id IS NULL OR id != p_except_session_id);

  GET DIAGNOSTICS result = ROW_COUNT;

  -- Log revocation activities
  INSERT INTO unified_session_activities (
    id,
    session_id,
    pubkey,
    activity_type,
    timestamp,
    details,
    risk_score
  )
  SELECT
    'act_' || EXTRACT(EPOCH FROM NOW())::BIGINT || '_' || substr(md5(random()::text), 1, 16),
    id,
    pubkey,
    'logout',
    NOW(),
    jsonb_build_object('reason', 'bulk_revocation'),
    0
  FROM unified_sessions
  WHERE pubkey = p_pubkey
    AND active = FALSE
    AND updated_at >= NOW() - INTERVAL '1 second';

  RETURN QUERY SELECT result;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- ROW LEVEL SECURITY (Optional - Enable if needed)
-- =====================================================

-- Enable RLS
-- ALTER TABLE unified_sessions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE unified_session_activities ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own sessions
-- CREATE POLICY sessions_user_policy ON unified_sessions
--   FOR SELECT
--   USING (pubkey = current_setting('app.current_user_pubkey', true));

-- Policy: Users can only see their own activities
-- CREATE POLICY activities_user_policy ON unified_session_activities
--   FOR SELECT
--   USING (pubkey = current_setting('app.current_user_pubkey', true));

-- =====================================================
-- COMMENTS (Documentation)
-- =====================================================

COMMENT ON TABLE unified_sessions IS 'US-311: Unified session management for NOSTR authentication';
COMMENT ON COLUMN unified_sessions.id IS 'Format: sess_{pubkey_prefix}_{timestamp}_{random}';
COMMENT ON COLUMN unified_sessions.token_hash IS 'SHA-256 hash of JWT token for secure lookup';
COMMENT ON COLUMN unified_sessions.device_fingerprint IS 'Unique device identifier for security';
COMMENT ON COLUMN unified_sessions.risk_score IS 'Security risk score (0-100): 0-29=low, 30-69=medium, 70-100=high';
COMMENT ON COLUMN unified_sessions.idle_timeout_at IS 'Session expires after this timestamp if no activity';

COMMENT ON TABLE unified_session_activities IS 'US-311: Activity log for session monitoring and security';
COMMENT ON COLUMN unified_session_activities.activity_type IS 'Type of activity: login, api_call, page_view, logout, token_refresh, timeout, invalidation';

COMMENT ON FUNCTION cleanup_expired_sessions IS 'Periodic cleanup function to invalidate expired sessions';
COMMENT ON FUNCTION get_session_statistics IS 'Get aggregated statistics for a user sessions';
COMMENT ON FUNCTION revoke_all_sessions_except IS 'Revoke all sessions except specified one (for logout other devices)';

-- =====================================================
-- GRANT PERMISSIONS (Adjust based on your setup)
-- =====================================================

-- Grant necessary permissions to application user
-- GRANT SELECT, INSERT, UPDATE, DELETE ON unified_sessions TO app_user;
-- GRANT SELECT, INSERT ON unified_session_activities TO app_user;
-- GRANT EXECUTE ON FUNCTION cleanup_expired_sessions TO app_user;
-- GRANT EXECUTE ON FUNCTION get_session_statistics TO app_user;
-- GRANT EXECUTE ON FUNCTION revoke_all_sessions_except TO app_user;

-- =====================================================
-- SEED DATA (Optional - For testing)
-- =====================================================

-- Example: Insert a test session
-- INSERT INTO unified_sessions (
--   id, pubkey, user_id, token_hash, device_id, device_fingerprint,
--   device_info, expires_at, idle_timeout_at
-- ) VALUES (
--   'sess_test1234_1234567890_abcd1234',
--   'a'.repeat(64),
--   'user_test',
--   'token_hash_example',
--   'device_test',
--   'fingerprint_test',
--   '{"userAgent": "Test", "platform": "Test", "deviceType": "desktop", "browser": "Test", "browserVersion": "1.0", "os": "Test", "osVersion": "1.0", "fingerprint": "test"}'::jsonb,
--   NOW() + INTERVAL '7 days',
--   NOW() + INTERVAL '1 day'
-- );

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

-- Log migration completion
DO $$
BEGIN
  RAISE NOTICE 'US-311: Unified session management migration completed successfully';
  RAISE NOTICE 'Created tables: unified_sessions, unified_session_activities';
  RAISE NOTICE 'Created functions: cleanup_expired_sessions, get_session_statistics, revoke_all_sessions_except';
  RAISE NOTICE 'Session format: sess_{pubkey_prefix}_{timestamp}_{random}';
END $$;
