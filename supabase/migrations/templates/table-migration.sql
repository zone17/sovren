-- 🗄️ TABLE MIGRATION TEMPLATE
-- Migration: [TIMESTAMP]_[TYPE]_[DESCRIPTION].sql
-- Description: [DETAILED_DESCRIPTION]
-- Author: [AUTHOR_NAME]
-- Date: [DATE]
-- Rollback: [TIMESTAMP]_rollback_[DESCRIPTION].sql

-- ============================================================================
-- MIGRATION METADATA
-- ============================================================================
-- Migration Type: TABLE
-- Target Tables: [TABLE_NAMES]
-- Estimated Execution Time: [TIME_ESTIMATE]
-- Breaking Changes: [YES/NO - with explanation]
-- Performance Impact: [LOW/MEDIUM/HIGH - with details]
-- Dependencies: [LIST_OF_DEPENDENT_MIGRATIONS]

BEGIN;

-- ============================================================================
-- SAFETY CHECKS
-- ============================================================================

-- Check if migration has already been applied
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM migration_history
        WHERE migration_name = '[MIGRATION_NAME]'
    ) THEN
        RAISE EXCEPTION 'Migration [MIGRATION_NAME] has already been applied';
    END IF;
END $$;

-- Validate prerequisites
DO $$
BEGIN
    -- Add any prerequisite checks here
    -- Example: Check if dependent tables exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'users' AND table_schema = 'public'
    ) THEN
        RAISE EXCEPTION 'Required table "users" does not exist';
    END IF;
END $$;

-- ============================================================================
-- TABLE OPERATIONS
-- ============================================================================

-- CREATE TABLE Example
CREATE TABLE IF NOT EXISTS [TABLE_NAME] (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Foreign Keys
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Data Columns
    [COLUMN_NAME] [DATA_TYPE] [CONSTRAINTS],

    -- Metadata Columns
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),

    -- Constraints
    CONSTRAINT [CONSTRAINT_NAME] CHECK ([CONSTRAINT_CONDITION]),
    CONSTRAINT [UNIQUE_CONSTRAINT_NAME] UNIQUE ([COLUMN_LIST])
);

-- ALTER TABLE Example (if modifying existing table)
-- ALTER TABLE [EXISTING_TABLE_NAME]
-- ADD COLUMN [COLUMN_NAME] [DATA_TYPE] [CONSTRAINTS];

-- ALTER TABLE [EXISTING_TABLE_NAME]
-- ALTER COLUMN [COLUMN_NAME] SET DEFAULT [DEFAULT_VALUE];

-- ALTER TABLE [EXISTING_TABLE_NAME]
-- ADD CONSTRAINT [CONSTRAINT_NAME] CHECK ([CONSTRAINT_CONDITION]);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Primary indexes for performance
CREATE INDEX IF NOT EXISTS idx_[TABLE_NAME]_user_id
ON [TABLE_NAME](user_id);

CREATE INDEX IF NOT EXISTS idx_[TABLE_NAME]_created_at
ON [TABLE_NAME](created_at DESC);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_[TABLE_NAME]_user_created
ON [TABLE_NAME](user_id, created_at DESC);

-- Unique indexes for business rules
CREATE UNIQUE INDEX IF NOT EXISTS idx_[TABLE_NAME]_unique_business_rule
ON [TABLE_NAME]([COLUMN1], [COLUMN2])
WHERE [CONDITION];

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Updated timestamp trigger
CREATE OR REPLACE FUNCTION update_[TABLE_NAME]_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    NEW.updated_by = COALESCE(NEW.updated_by, OLD.updated_by);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_[TABLE_NAME]_updated_at
    BEFORE UPDATE ON [TABLE_NAME]
    FOR EACH ROW
    EXECUTE FUNCTION update_[TABLE_NAME]_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS
ALTER TABLE [TABLE_NAME] ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "[TABLE_NAME]_select_own_records" ON [TABLE_NAME]
    FOR SELECT
    USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM users
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "[TABLE_NAME]_insert_own_records" ON [TABLE_NAME]
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "[TABLE_NAME]_update_own_records" ON [TABLE_NAME]
    FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "[TABLE_NAME]_delete_own_records" ON [TABLE_NAME]
    FOR DELETE
    USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM users
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- ============================================================================
-- COMMENTS AND DOCUMENTATION
-- ============================================================================

-- Table comment
COMMENT ON TABLE [TABLE_NAME] IS '[TABLE_DESCRIPTION_AND_PURPOSE]';

-- Column comments
COMMENT ON COLUMN [TABLE_NAME].id IS 'Primary key - UUID v4';
COMMENT ON COLUMN [TABLE_NAME].user_id IS 'Foreign key to users table';
COMMENT ON COLUMN [TABLE_NAME].[COLUMN_NAME] IS '[COLUMN_DESCRIPTION]';
COMMENT ON COLUMN [TABLE_NAME].created_at IS 'Record creation timestamp';
COMMENT ON COLUMN [TABLE_NAME].updated_at IS 'Record last update timestamp';

-- ============================================================================
-- MIGRATION HISTORY TRACKING
-- ============================================================================

-- Record migration in history
INSERT INTO migration_history (
    migration_name,
    applied_at,
    description,
    execution_time_ms,
    applied_by,
    status
) VALUES (
    '[MIGRATION_NAME]',
    NOW(),
    '[MIGRATION_DESCRIPTION]',
    EXTRACT(EPOCH FROM (NOW() - transaction_timestamp())) * 1000,
    current_user,
    'success'
);

-- ============================================================================
-- POST-MIGRATION VALIDATION
-- ============================================================================

-- Validate table creation
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = '[TABLE_NAME]' AND table_schema = 'public'
    ) THEN
        RAISE EXCEPTION 'Table [TABLE_NAME] was not created successfully';
    END IF;

    -- Validate indexes
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE tablename = '[TABLE_NAME]' AND indexname = 'idx_[TABLE_NAME]_user_id'
    ) THEN
        RAISE EXCEPTION 'Required index idx_[TABLE_NAME]_user_id was not created';
    END IF;

    -- Validate RLS is enabled
    IF NOT EXISTS (
        SELECT 1 FROM pg_tables
        WHERE tablename = '[TABLE_NAME]' AND rowsecurity = true
    ) THEN
        RAISE EXCEPTION 'Row Level Security is not enabled on [TABLE_NAME]';
    END IF;

    -- Log successful validation
    RAISE NOTICE 'Migration [MIGRATION_NAME] completed successfully';
END $$;

COMMIT;

-- ============================================================================
-- ROLLBACK INSTRUCTIONS
-- ============================================================================

/*
To rollback this migration, run:
./scripts/rollback.sh --migration [MIGRATION_NAME]

Or manually execute the rollback migration:
[TIMESTAMP]_rollback_[DESCRIPTION].sql

The rollback will:
1. Drop all created triggers
2. Drop all created indexes
3. Drop the table [TABLE_NAME]
4. Remove the migration from history
5. Validate rollback completion
*/

-- ============================================================================
-- PERFORMANCE NOTES
-- ============================================================================

/*
Performance Considerations:
- [LIST_PERFORMANCE_IMPACTS]
- [SUGGEST_OPTIMIZATIONS]
- [MONITORING_RECOMMENDATIONS]

Post-Migration Monitoring:
- Monitor query performance on [TABLE_NAME]
- Check index usage statistics
- Validate RLS policy performance
- Monitor table size growth
*/
