-- E2E Test Seed Data
-- Deterministic test users with pubkeys derived from hardcoded keys in test-users.ts
-- Run: psql "$DATABASE_URL" -f src/database/seed.sql

-- Create wellness tables if they don't exist (not in any migration yet)
CREATE TABLE IF NOT EXISTS creator_work_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id VARCHAR(64) NOT NULL REFERENCES users(nostr_pubkey) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  content_time_mins INTEGER DEFAULT 0,
  engagement_time_mins INTEGER DEFAULT 0,
  management_time_mins INTEGER DEFAULT 0,
  total_hours NUMERIC(5,2) GENERATED ALWAYS AS (
    (content_time_mins + engagement_time_mins + management_time_mins) / 60.0
  ) STORED,
  post_count INTEGER DEFAULT 0,
  first_activity_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(creator_id, date)
);

CREATE TABLE IF NOT EXISTS wellness_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id VARCHAR(64) NOT NULL REFERENCES users(nostr_pubkey) ON DELETE CASCADE,
  overall_score INTEGER CHECK (overall_score BETWEEN 0 AND 100),
  burnout_risk VARCHAR(20) CHECK (burnout_risk IN ('low', 'moderate', 'high', 'critical')),
  snapshot_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Clean existing test data (idempotent)
DELETE FROM creator_work_patterns WHERE creator_id IN (
  '5877220aaae6e54a6f974602d5995c0fe24a3ea7ddabd8644bec795b9da00743',
  'b812567c95eb1bb6b8c639720cdcaf9c514152b0dc150fad330a58cf34ce47f1',
  'ad6e39fa4c4014c2f536cc9716aaef7e3f384541e2a9a2ad51a0ed731dc9ea26'
);
DELETE FROM wellness_snapshots WHERE creator_id IN (
  '5877220aaae6e54a6f974602d5995c0fe24a3ea7ddabd8644bec795b9da00743',
  'b812567c95eb1bb6b8c639720cdcaf9c514152b0dc150fad330a58cf34ce47f1',
  'ad6e39fa4c4014c2f536cc9716aaef7e3f384541e2a9a2ad51a0ed731dc9ea26'
);
DELETE FROM users WHERE nostr_pubkey IN (
  '5877220aaae6e54a6f974602d5995c0fe24a3ea7ddabd8644bec795b9da00743',
  'b812567c95eb1bb6b8c639720cdcaf9c514152b0dc150fad330a58cf34ce47f1',
  'ad6e39fa4c4014c2f536cc9716aaef7e3f384541e2a9a2ad51a0ed731dc9ea26'
);

-- Alice: creator, primary test user (pubkey from test-users.ts alice key)
INSERT INTO users (nostr_pubkey, role, display_name, username, bio, nip05_verified, status)
VALUES (
  '5877220aaae6e54a6f974602d5995c0fe24a3ea7ddabd8644bec795b9da00743',
  'creator', 'Alice Test', 'alice_test', 'E2E test user Alice - Content creator', true, 'active'
);

-- Bob: supporter (pubkey from test-users.ts bob key)
INSERT INTO users (nostr_pubkey, role, display_name, username, bio, status)
VALUES (
  'b812567c95eb1bb6b8c639720cdcaf9c514152b0dc150fad330a58cf34ce47f1',
  'supporter', 'Bob Test', 'bob_test', 'E2E test user Bob - Regular user', 'active'
);

-- Charlie: creator, power user (pubkey from test-users.ts charlie key)
INSERT INTO users (nostr_pubkey, role, display_name, username, bio, nip05_verified, status)
VALUES (
  'ad6e39fa4c4014c2f536cc9716aaef7e3f384541e2a9a2ad51a0ed731dc9ea26',
  'creator', 'Charlie Test', 'charlie_test', 'E2E test user Charlie - Power user', true, 'active'
);

-- Wellness work patterns for Alice (last 7 days)
INSERT INTO creator_work_patterns (creator_id, date, content_time_mins, engagement_time_mins, management_time_mins, post_count, first_activity_at, last_activity_at)
VALUES
  ('5877220aaae6e54a6f974602d5995c0fe24a3ea7ddabd8644bec795b9da00743', CURRENT_DATE - INTERVAL '1 day', 120, 45, 30, 2, NOW() - INTERVAL '1 day 8 hours', NOW() - INTERVAL '1 day 2 hours'),
  ('5877220aaae6e54a6f974602d5995c0fe24a3ea7ddabd8644bec795b9da00743', CURRENT_DATE - INTERVAL '2 days', 90, 60, 15, 1, NOW() - INTERVAL '2 days 9 hours', NOW() - INTERVAL '2 days 3 hours'),
  ('5877220aaae6e54a6f974602d5995c0fe24a3ea7ddabd8644bec795b9da00743', CURRENT_DATE - INTERVAL '3 days', 150, 30, 45, 3, NOW() - INTERVAL '3 days 7 hours', NOW() - INTERVAL '3 days 1 hour'),
  ('5877220aaae6e54a6f974602d5995c0fe24a3ea7ddabd8644bec795b9da00743', CURRENT_DATE - INTERVAL '5 days', 60, 90, 20, 1, NOW() - INTERVAL '5 days 10 hours', NOW() - INTERVAL '5 days 4 hours'),
  ('5877220aaae6e54a6f974602d5995c0fe24a3ea7ddabd8644bec795b9da00743', CURRENT_DATE - INTERVAL '6 days', 180, 40, 35, 4, NOW() - INTERVAL '6 days 6 hours', NOW() - INTERVAL '6 days 1 hour');

-- Wellness snapshot for Alice
INSERT INTO wellness_snapshots (creator_id, overall_score, burnout_risk, snapshot_data)
VALUES (
  '5877220aaae6e54a6f974602d5995c0fe24a3ea7ddabd8644bec795b9da00743',
  75,
  'low',
  '{"work_hours_7d": 14.5, "rest_days": 2, "content_pct": 55, "engagement_pct": 25, "management_pct": 20}'
);
