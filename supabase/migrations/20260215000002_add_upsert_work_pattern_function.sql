-- Migration: Add upsert_work_pattern RPC function
-- P1 Fix: Todo 150 - Work Pattern Upsert Overwrites Instead of Accumulating
--
-- Problem: WellnessService.recordWorkPattern() used a Supabase .upsert() that
-- replaced the entire row on conflict (creator_id, date). When a creator logged
-- a second work session the same day, the first session's data was silently lost.
--
-- Solution: A Postgres function that uses ON CONFLICT DO UPDATE to accumulate
-- duration minutes, post counts, and maintain correct first/last activity times.

CREATE OR REPLACE FUNCTION upsert_work_pattern(
  p_creator_id UUID,
  p_date DATE,
  p_content_time_mins INTEGER DEFAULT 0,
  p_engagement_time_mins INTEGER DEFAULT 0,
  p_management_time_mins INTEGER DEFAULT 0,
  p_post_count INTEGER DEFAULT 0,
  p_activity_at TIMESTAMPTZ DEFAULT NOW()
) RETURNS SETOF creator_work_patterns AS $$
BEGIN
  RETURN QUERY
  INSERT INTO creator_work_patterns (
    creator_id,
    date,
    content_time_mins,
    engagement_time_mins,
    management_time_mins,
    post_count,
    total_hours,
    first_activity_at,
    last_activity_at,
    created_at,
    updated_at
  ) VALUES (
    p_creator_id,
    p_date,
    p_content_time_mins,
    p_engagement_time_mins,
    p_management_time_mins,
    p_post_count,
    (p_content_time_mins + p_engagement_time_mins + p_management_time_mins) / 60.0,
    p_activity_at,
    p_activity_at,
    NOW(),
    NOW()
  )
  ON CONFLICT (creator_id, date) DO UPDATE SET
    content_time_mins    = creator_work_patterns.content_time_mins    + EXCLUDED.content_time_mins,
    engagement_time_mins = creator_work_patterns.engagement_time_mins + EXCLUDED.engagement_time_mins,
    management_time_mins = creator_work_patterns.management_time_mins + EXCLUDED.management_time_mins,
    post_count           = creator_work_patterns.post_count           + EXCLUDED.post_count,
    total_hours          = (
      creator_work_patterns.content_time_mins    + EXCLUDED.content_time_mins +
      creator_work_patterns.engagement_time_mins + EXCLUDED.engagement_time_mins +
      creator_work_patterns.management_time_mins + EXCLUDED.management_time_mins
    ) / 60.0,
    first_activity_at    = LEAST(creator_work_patterns.first_activity_at, EXCLUDED.first_activity_at),
    last_activity_at     = GREATEST(creator_work_patterns.last_activity_at, EXCLUDED.last_activity_at),
    updated_at           = NOW()
  RETURNING *;
END;
$$ LANGUAGE plpgsql;

-- Add a comment describing the function's purpose
COMMENT ON FUNCTION upsert_work_pattern IS
  'Accumulates work pattern data for a creator on a given date. '
  'Multiple sessions per day are summed (durations, post counts) rather than overwritten. '
  'first_activity_at keeps the earliest timestamp, last_activity_at keeps the latest.';
