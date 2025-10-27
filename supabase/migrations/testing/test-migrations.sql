-- 🧪 SOVREN MIGRATION TESTING SUITE
-- Elite Engineering Database Migration Testing Procedures
-- Description: Comprehensive testing framework for database migrations
-- Author: Sovren Engineering Team
-- Date: 2024-12-29

-- ============================================================================
-- TESTING FRAMEWORK SETUP
-- ============================================================================

-- Create test results table if it doesn't exist
CREATE TABLE IF NOT EXISTS migration_test_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    test_suite VARCHAR(100) NOT NULL,
    test_name VARCHAR(200) NOT NULL,
    migration_name VARCHAR(255),
    test_status VARCHAR(20) CHECK (test_status IN ('PASS', 'FAIL', 'SKIP', 'ERROR')),
    test_message TEXT,
    execution_time_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Test execution function
CREATE OR REPLACE FUNCTION run_migration_test(
    p_test_suite VARCHAR(100),
    p_test_name VARCHAR(200),
    p_migration_name VARCHAR(255) DEFAULT NULL,
    p_test_sql TEXT DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
    v_start_time TIMESTAMP WITH TIME ZONE;
    v_end_time TIMESTAMP WITH TIME ZONE;
    v_duration_ms INTEGER;
    v_test_result VARCHAR(20) := 'PASS';
    v_test_message TEXT := 'Test completed successfully';
BEGIN
    v_start_time := clock_timestamp();

    BEGIN
        -- Execute test SQL if provided
        IF p_test_sql IS NOT NULL THEN
            EXECUTE p_test_sql;
        END IF;

        v_end_time := clock_timestamp();
        v_duration_ms := EXTRACT(EPOCH FROM (v_end_time - v_start_time)) * 1000;

    EXCEPTION WHEN OTHERS THEN
        v_test_result := 'FAIL';
        v_test_message := SQLERRM;
        v_end_time := clock_timestamp();
        v_duration_ms := EXTRACT(EPOCH FROM (v_end_time - v_start_time)) * 1000;
    END;

    -- Record test result
    INSERT INTO migration_test_results (
        test_suite,
        test_name,
        migration_name,
        test_status,
        test_message,
        execution_time_ms
    ) VALUES (
        p_test_suite,
        p_test_name,
        p_migration_name,
        v_test_result,
        v_test_message,
        v_duration_ms
    );

    -- Log result
    RAISE NOTICE 'Test %: % - %ms', p_test_name, v_test_result, v_duration_ms;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- INFRASTRUCTURE VALIDATION TESTS
-- ============================================================================

-- Test: Migration tracking infrastructure exists
SELECT run_migration_test(
    'Infrastructure',
    'Migration tracking tables exist',
    NULL,
    $$
    DO $test$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'migration_history') THEN
            RAISE EXCEPTION 'migration_history table does not exist';
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'migration_performance') THEN
            RAISE EXCEPTION 'migration_performance table does not exist';
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'migration_backups') THEN
            RAISE EXCEPTION 'migration_backups table does not exist';
        END IF;
    END $test$;
    $$
);

-- Test: Required extensions are available
SELECT run_migration_test(
    'Infrastructure',
    'Required PostgreSQL extensions',
    NULL,
    $$
    DO $test$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'uuid-ossp') THEN
            RAISE EXCEPTION 'uuid-ossp extension not installed';
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto') THEN
            RAISE EXCEPTION 'pgcrypto extension not installed';
        END IF;
    END $test$;
    $$
);

-- ============================================================================
-- SCHEMA VALIDATION TESTS
-- ============================================================================

-- Test: Core tables exist with proper structure
SELECT run_migration_test(
    'Schema',
    'Core tables structure validation',
    NULL,
    $$
    DO $test$
    DECLARE
        v_table_count INTEGER;
        v_required_tables TEXT[] := ARRAY['users', 'content', 'payments', 'followers', 'comments', 'content_analytics'];
        v_table_name TEXT;
    BEGIN
        -- Check each required table
        FOREACH v_table_name IN ARRAY v_required_tables
        LOOP
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_name = v_table_name AND table_schema = 'public'
            ) THEN
                RAISE EXCEPTION 'Required table % does not exist', v_table_name;
            END IF;
        END LOOP;

        -- Validate minimum table count
        SELECT COUNT(*) INTO v_table_count
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE';

        IF v_table_count < 8 THEN
            RAISE EXCEPTION 'Insufficient tables: % (expected at least 8)', v_table_count;
        END IF;
    END $test$;
    $$
);

-- Test: Primary key constraints exist on all core tables
SELECT run_migration_test(
    'Schema',
    'Primary key constraints validation',
    NULL,
    $$
    DO $test$
    DECLARE
        v_table_name TEXT;
        v_pk_count INTEGER;
    BEGIN
        FOR v_table_name IN
            SELECT table_name FROM information_schema.tables
            WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        LOOP
            SELECT COUNT(*) INTO v_pk_count
            FROM information_schema.table_constraints
            WHERE table_name = v_table_name
            AND constraint_type = 'PRIMARY KEY'
            AND table_schema = 'public';

            IF v_pk_count = 0 THEN
                RAISE EXCEPTION 'Table % is missing primary key constraint', v_table_name;
            END IF;
        END LOOP;
    END $test$;
    $$
);

-- Test: Foreign key relationships are properly defined
SELECT run_migration_test(
    'Schema',
    'Foreign key constraints validation',
    NULL,
    $$
    DO $test$
    DECLARE
        v_fk_count INTEGER;
        v_expected_fks TEXT[] := ARRAY[
            'content.creator_id -> users.id',
            'payments.payer_id -> users.id',
            'payments.recipient_id -> users.id',
            'followers.follower_id -> users.id',
            'followers.following_id -> users.id',
            'comments.content_id -> content.id',
            'comments.user_id -> users.id'
        ];
    BEGIN
        -- Check minimum foreign key count
        SELECT COUNT(*) INTO v_fk_count
        FROM information_schema.table_constraints
        WHERE constraint_type = 'FOREIGN KEY'
        AND table_schema = 'public';

        IF v_fk_count < 7 THEN
            RAISE EXCEPTION 'Insufficient foreign key constraints: % (expected at least 7)', v_fk_count;
        END IF;
    END $test$;
    $$
);

-- ============================================================================
-- INDEX PERFORMANCE TESTS
-- ============================================================================

-- Test: Performance-critical indexes exist
SELECT run_migration_test(
    'Performance',
    'Critical indexes validation',
    NULL,
    $$
    DO $test$
    DECLARE
        v_index_count INTEGER;
        v_critical_indexes TEXT[] := ARRAY[
            'idx_users_nostr_pubkey',
            'idx_content_creator_id',
            'idx_payments_recipient_id',
            'idx_followers_follower_id',
            'idx_comments_content_id'
        ];
        v_index_name TEXT;
    BEGIN
        FOREACH v_index_name IN ARRAY v_critical_indexes
        LOOP
            IF NOT EXISTS (
                SELECT 1 FROM pg_indexes
                WHERE indexname = v_index_name AND schemaname = 'public'
            ) THEN
                RAISE EXCEPTION 'Critical index % does not exist', v_index_name;
            END IF;
        END LOOP;

        -- Check minimum index count
        SELECT COUNT(*) INTO v_index_count
        FROM pg_indexes
        WHERE schemaname = 'public';

        IF v_index_count < 20 THEN
            RAISE EXCEPTION 'Insufficient indexes: % (expected at least 20)', v_index_count;
        END IF;
    END $test$;
    $$
);

-- Test: Index usage efficiency (requires actual data)
SELECT run_migration_test(
    'Performance',
    'Index usage statistics',
    NULL,
    $$
    DO $test$
    BEGIN
        -- This test would check pg_stat_user_indexes in production
        -- For now, just verify that the statistics system is available
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_name = 'pg_stat_user_indexes'
        ) THEN
            RAISE EXCEPTION 'Index statistics not available';
        END IF;
    END $test$;
    $$
);

-- ============================================================================
-- SECURITY VALIDATION TESTS
-- ============================================================================

-- Test: Row Level Security is enabled on all user-facing tables
SELECT run_migration_test(
    'Security',
    'Row Level Security validation',
    NULL,
    $$
    DO $test$
    DECLARE
        v_table_name TEXT;
        v_rls_enabled BOOLEAN;
        v_secured_tables TEXT[] := ARRAY['users', 'content', 'payments', 'followers', 'comments'];
    BEGIN
        FOREACH v_table_name IN ARRAY v_secured_tables
        LOOP
            SELECT rowsecurity INTO v_rls_enabled
            FROM pg_tables
            WHERE tablename = v_table_name AND schemaname = 'public';

            IF NOT v_rls_enabled THEN
                RAISE EXCEPTION 'RLS not enabled on table %', v_table_name;
            END IF;
        END LOOP;
    END $test$;
    $$
);

-- Test: RLS policies exist for protected tables
SELECT run_migration_test(
    'Security',
    'RLS policies validation',
    NULL,
    $$
    DO $test$
    DECLARE
        v_policy_count INTEGER;
    BEGIN
        SELECT COUNT(*) INTO v_policy_count
        FROM pg_policies
        WHERE schemaname = 'public';

        IF v_policy_count < 10 THEN
            RAISE EXCEPTION 'Insufficient RLS policies: % (expected at least 10)', v_policy_count;
        END IF;
    END $test$;
    $$
);

-- Test: Sensitive data constraints
SELECT run_migration_test(
    'Security',
    'Data validation constraints',
    NULL,
    $$
    DO $test$
    DECLARE
        v_constraint_count INTEGER;
    BEGIN
        -- Check for validation constraints on sensitive fields
        SELECT COUNT(*) INTO v_constraint_count
        FROM information_schema.check_constraints
        WHERE constraint_schema = 'public';

        IF v_constraint_count < 5 THEN
            RAISE EXCEPTION 'Insufficient check constraints: % (expected at least 5)', v_constraint_count;
        END IF;
    END $test$;
    $$
);

-- ============================================================================
-- DATA INTEGRITY TESTS
-- ============================================================================

-- Test: Trigger functions exist and are valid
SELECT run_migration_test(
    'Integrity',
    'Trigger functions validation',
    NULL,
    $$
    DO $test$
    DECLARE
        v_trigger_count INTEGER;
        v_function_count INTEGER;
    BEGIN
        -- Check trigger count
        SELECT COUNT(*) INTO v_trigger_count
        FROM information_schema.triggers
        WHERE trigger_schema = 'public';

        IF v_trigger_count < 5 THEN
            RAISE EXCEPTION 'Insufficient triggers: % (expected at least 5)', v_trigger_count;
        END IF;

        -- Check for update timestamp functions
        SELECT COUNT(*) INTO v_function_count
        FROM information_schema.routines
        WHERE routine_schema = 'public'
        AND routine_name LIKE '%updated_at%';

        IF v_function_count < 1 THEN
            RAISE EXCEPTION 'Missing timestamp update functions';
        END IF;
    END $test$;
    $$
);

-- Test: Search functionality setup
SELECT run_migration_test(
    'Functionality',
    'Full-text search configuration',
    NULL,
    $$
    DO $test$
    BEGIN
        -- Check if search vector column exists
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'content'
            AND column_name = 'search_vector'
            AND table_schema = 'public'
        ) THEN
            RAISE EXCEPTION 'Search vector column not found in content table';
        END IF;

        -- Check for search index
        IF NOT EXISTS (
            SELECT 1 FROM pg_indexes
            WHERE tablename = 'content'
            AND indexname = 'idx_content_search'
            AND schemaname = 'public'
        ) THEN
            RAISE EXCEPTION 'Search index not found on content table';
        END IF;
    END $test$;
    $$
);

-- ============================================================================
-- MIGRATION HISTORY VALIDATION
-- ============================================================================

-- Test: Migration history is properly maintained
SELECT run_migration_test(
    'Migration',
    'Migration history validation',
    NULL,
    $$
    DO $test$
    DECLARE
        v_migration_count INTEGER;
        v_baseline_exists BOOLEAN;
    BEGIN
        -- Check if baseline migration exists
        SELECT EXISTS(
            SELECT 1 FROM migration_history
            WHERE migration_name = '001_baseline_schema'
            AND status = 'success'
        ) INTO v_baseline_exists;

        IF NOT v_baseline_exists THEN
            RAISE EXCEPTION 'Baseline migration not found or not successful';
        END IF;

        -- Check migration count
        SELECT COUNT(*) INTO v_migration_count
        FROM migration_history
        WHERE status = 'success';

        IF v_migration_count < 1 THEN
            RAISE EXCEPTION 'No successful migrations found';
        END IF;
    END $test$;
    $$
);

-- ============================================================================
-- PERFORMANCE BENCHMARKING TESTS
-- ============================================================================

-- Test: Basic query performance benchmarks
SELECT run_migration_test(
    'Performance',
    'Query performance benchmarks',
    NULL,
    $$
    DO $test$
    DECLARE
        v_start_time TIMESTAMP WITH TIME ZONE;
        v_end_time TIMESTAMP WITH TIME ZONE;
        v_duration_ms INTEGER;
    BEGIN
        -- Test basic queries that should be fast
        v_start_time := clock_timestamp();

        -- User lookup by NOSTR pubkey (should use index)
        PERFORM COUNT(*) FROM users WHERE nostr_pubkey = 'test_pubkey_that_does_not_exist_1234567890123456789012345678901234567890';

        -- Content lookup by creator (should use index)
        PERFORM COUNT(*) FROM content WHERE creator_id = '00000000-0000-0000-0000-000000000000';

        -- Payment lookup by recipient (should use index)
        PERFORM COUNT(*) FROM payments WHERE recipient_id = '00000000-0000-0000-0000-000000000000';

        v_end_time := clock_timestamp();
        v_duration_ms := EXTRACT(EPOCH FROM (v_end_time - v_start_time)) * 1000;

        -- Basic queries should complete in under 100ms even with empty tables
        IF v_duration_ms > 100 THEN
            RAISE EXCEPTION 'Basic queries too slow: %ms (expected < 100ms)', v_duration_ms;
        END IF;
    END $test$;
    $$
);

-- ============================================================================
-- TEST RESULTS SUMMARY
-- ============================================================================

-- Generate test summary
DO $$
DECLARE
    v_total_tests INTEGER;
    v_passed_tests INTEGER;
    v_failed_tests INTEGER;
    v_test_record RECORD;
BEGIN
    -- Count test results
    SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE test_status = 'PASS') as passed,
        COUNT(*) FILTER (WHERE test_status = 'FAIL') as failed
    INTO v_total_tests, v_passed_tests, v_failed_tests
    FROM migration_test_results
    WHERE created_at >= NOW() - INTERVAL '1 minute';

    RAISE NOTICE '';
    RAISE NOTICE '========================================================================';
    RAISE NOTICE 'SOVREN MIGRATION TESTING SUITE - RESULTS SUMMARY';
    RAISE NOTICE '========================================================================';
    RAISE NOTICE 'Total Tests: %', v_total_tests;
    RAISE NOTICE 'Passed: %', v_passed_tests;
    RAISE NOTICE 'Failed: %', v_failed_tests;
    RAISE NOTICE 'Success Rate: %.1f%%', (v_passed_tests::FLOAT / v_total_tests::FLOAT) * 100;
    RAISE NOTICE '========================================================================';

    -- Show failed tests if any
    IF v_failed_tests > 0 THEN
        RAISE NOTICE '';
        RAISE NOTICE 'FAILED TESTS:';
        FOR v_test_record IN
            SELECT test_suite, test_name, test_message
            FROM migration_test_results
            WHERE test_status = 'FAIL'
            AND created_at >= NOW() - INTERVAL '1 minute'
            ORDER BY test_suite, test_name
        LOOP
            RAISE NOTICE '❌ %.%: %', v_test_record.test_suite, v_test_record.test_name, v_test_record.test_message;
        END LOOP;
        RAISE NOTICE '';
    END IF;

    -- Overall status
    IF v_failed_tests = 0 THEN
        RAISE NOTICE '✅ ALL TESTS PASSED - Migration system is healthy';
    ELSE
        RAISE NOTICE '❌ SOME TESTS FAILED - Review and fix issues before proceeding';
    END IF;

    RAISE NOTICE '========================================================================';
END $$;
