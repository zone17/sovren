-- Discovery Performance Indexes
-- Supports ILIKE pattern matching and sort operations on the discovery_creators view.

-- Enable trigram extension for ILIKE index support
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN trigram indexes for ILIKE %...% text search
CREATE INDEX IF NOT EXISTS idx_users_display_name_trgm ON users USING gin (display_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_users_username_trgm ON users USING gin (username gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_creator_profiles_bio_trgm ON creator_profiles USING gin (bio gin_trgm_ops);

-- B-tree indexes for ORDER BY columns
CREATE INDEX IF NOT EXISTS idx_creators_follower_count_desc ON creators (follower_count DESC);
CREATE INDEX IF NOT EXISTS idx_creator_profiles_created_at_desc ON creator_profiles (created_at DESC);

-- GIN index for array overlap (category filter)
CREATE INDEX IF NOT EXISTS idx_creator_profiles_categories_gin ON creator_profiles USING gin (categories);
