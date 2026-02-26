-- =====================================================
-- US-311: Unified Session Management - ROLLBACK Migration
-- WHY: Safely rollback unified session management changes
-- =====================================================

-- Drop functions
DROP FUNCTION IF EXISTS revoke_all_sessions_except(VARCHAR, VARCHAR) CASCADE;
DROP FUNCTION IF EXISTS get_session_statistics(VARCHAR) CASCADE;
DROP FUNCTION IF EXISTS cleanup_expired_sessions() CASCADE;
DROP FUNCTION IF EXISTS update_session_timestamp() CASCADE;

-- Drop tables (CASCADE will drop all dependent objects)
DROP TABLE IF EXISTS unified_session_activities CASCADE;
DROP TABLE IF EXISTS unified_sessions CASCADE;

-- Log rollback completion
DO $$
BEGIN
  RAISE NOTICE 'US-311: Unified session management rollback completed';
  RAISE NOTICE 'Dropped tables: unified_sessions, unified_session_activities';
  RAISE NOTICE 'Dropped functions: cleanup_expired_sessions, get_session_statistics, revoke_all_sessions_except, update_session_timestamp';
END $$;
