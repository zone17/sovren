-- 🔄 ROLLBACK MIGRATION TEMPLATE
-- Rollback: [TIMESTAMP]_rollback_[DESCRIPTION].sql
-- Original Migration: [ORIGINAL_MIGRATION_NAME]
-- Description: Rollback for [ORIGINAL_DESCRIPTION]
-- Author: [AUTHOR_NAME]
-- Date: [DATE]

-- ============================================================================
-- ROLLBACK METADATA
-- ============================================================================
-- Rollback Type: [TABLE/INDEX/CONSTRAINT/DATA]
-- Target Objects: [OBJECT_NAMES]
-- Estimated Execution Time: [TIME_ESTIMATE]
-- Data Loss Risk: [YES/NO - with explanation]
-- Prerequisites: [LIST_OF_PREREQUISITES]

BEGIN;

-- ============================================================================
-- SAFETY CHECKS
-- ============================================================================

-- Check if original migration exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM migration_history
        WHERE migration_name = '[ORIGINAL_MIGRATION_NAME]'
        AND status = 'success'
    ) THEN
        RAISE EXCEPTION 'Original migration [ORIGINAL_MIGRATION_NAME] not found or not successful';
    END IF;

    -- Check if rollback has already been applied
    IF EXISTS (
        SELECT 1 FROM migration_history
        WHERE migration_name = '[ORIGINAL_MIGRATION_NAME]'
        AND rollback_at IS NOT NULL
    ) THEN
        RAISE EXCEPTION 'Migration [ORIGINAL_MIGRATION_NAME] has already been rolled back';
    END IF;
END $$;

-- ============================================================================
-- DATA BACKUP (if necessary)
-- ============================================================================

-- Create backup tables for data preservation
-- Only if rollback involves data loss
/*
CREATE TABLE IF NOT EXISTS [TABLE_NAME]_backup_[TIMESTAMP] AS
SELECT * FROM [TABLE_NAME]
WHERE [BACKUP_CONDITIONS];

-- Log backup creation
INSERT INTO migration_backups (
    migration_name,
    backup_table,
    backup_timestamp,
    record_count
) VALUES (
    '[ORIGINAL_MIGRATION_NAME]',
    '[TABLE_NAME]_backup_[TIMESTAMP]',
    NOW(),
    (SELECT COUNT(*) FROM [TABLE_NAME]_backup_[TIMESTAMP])
);
*/

-- ============================================================================
-- ROLLBACK OPERATIONS
-- ============================================================================

-- Drop triggers first
DROP TRIGGER IF EXISTS trigger_[TABLE_NAME]_updated_at ON [TABLE_NAME];
DROP FUNCTION IF EXISTS update_[TABLE_NAME]_updated_at();

-- Drop RLS policies
DROP POLICY IF EXISTS "[TABLE_NAME]_select_own_records" ON [TABLE_NAME];
DROP POLICY IF EXISTS "[TABLE_NAME]_insert_own_records" ON [TABLE_NAME];
DROP POLICY IF EXISTS "[TABLE_NAME]_update_own_records" ON [TABLE_NAME];
DROP POLICY IF EXISTS "[TABLE_NAME]_delete_own_records" ON [TABLE_NAME];

-- Disable RLS
ALTER TABLE IF EXISTS [TABLE_NAME] DISABLE ROW LEVEL SECURITY;

-- Drop indexes
DROP INDEX IF EXISTS idx_[TABLE_NAME]_user_id;
DROP INDEX IF EXISTS idx_[TABLE_NAME]_created_at;
DROP INDEX IF EXISTS idx_[TABLE_NAME]_user_created;
DROP INDEX IF EXISTS idx_[TABLE_NAME]_unique_business_rule;

-- Drop constraints
ALTER TABLE IF EXISTS [TABLE_NAME] DROP CONSTRAINT IF EXISTS [CONSTRAINT_NAME];

-- Drop columns (if added in original migration)
-- ALTER TABLE [EXISTING_TABLE] DROP COLUMN IF EXISTS [COLUMN_NAME];

-- Drop tables
DROP TABLE IF EXISTS [TABLE_NAME];

-- ============================================================================
-- RESTORE PREVIOUS STATE (if applicable)
-- ============================================================================

-- Restore any modified objects to their previous state
-- This section is specific to each migration type

-- Example: Restore previous table structure
/*
CREATE TABLE [TABLE_NAME] (
    -- Previous table structure
);
*/

-- ============================================================================
-- UPDATE MIGRATION HISTORY
-- ============================================================================

-- Mark original migration as rolled back
UPDATE migration_history
SET
    rollback_at = NOW(),
    status = 'rolled_back'
WHERE migration_name = '[ORIGINAL_MIGRATION_NAME]';

-- Record rollback execution
INSERT INTO migration_history (
    migration_name,
    applied_at,
    description,
    execution_time_ms,
    applied_by,
    status
) VALUES (
    '[ROLLBACK_MIGRATION_NAME]',
    NOW(),
    'Rollback of [ORIGINAL_MIGRATION_NAME]: [ROLLBACK_REASON]',
    EXTRACT(EPOCH FROM (NOW() - transaction_timestamp())) * 1000,
    current_user,
    'success'
);

-- ============================================================================
-- POST-ROLLBACK VALIDATION
-- ============================================================================

-- Validate rollback completion
DO $$
BEGIN
    -- Validate table is dropped
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = '[TABLE_NAME]' AND table_schema = 'public'
    ) THEN
        RAISE EXCEPTION 'Table [TABLE_NAME] still exists after rollback';
    END IF;

    -- Validate indexes are dropped
    IF EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE tablename = '[TABLE_NAME]'
    ) THEN
        RAISE EXCEPTION 'Indexes for [TABLE_NAME] still exist after rollback';
    END IF;

    -- Validate triggers are dropped
    IF EXISTS (
        SELECT 1 FROM information_schema.triggers
        WHERE trigger_name = 'trigger_[TABLE_NAME]_updated_at'
    ) THEN
        RAISE EXCEPTION 'Triggers for [TABLE_NAME] still exist after rollback';
    END IF;

    -- Log successful validation
    RAISE NOTICE 'Rollback [ROLLBACK_MIGRATION_NAME] completed successfully';
END $$;

COMMIT;

-- ============================================================================
-- POST-ROLLBACK NOTES
-- ============================================================================

/*
Rollback Summary:
- Original migration [ORIGINAL_MIGRATION_NAME] has been successfully rolled back
- All objects created by the migration have been removed
- Migration history has been updated to reflect the rollback

Data Recovery:
- [IF_BACKUP_CREATED]: Data backup available in [BACKUP_TABLE_NAME]
- [IF_NO_BACKUP]: No data backup was created (no data loss risk)

Next Steps:
1. Verify application functionality after rollback
2. Address the issues that caused the rollback requirement
3. Create and test a new migration if needed
4. Clean up backup tables if no longer needed

Monitoring:
- Check application logs for any errors
- Monitor database performance
- Validate all dependent features are working correctly
*/
