-- Migration: 20260220100100_epic010_mentorships.sql
-- EPIC-010: Creator Network — Mentor Profiles and Mentorship Relationships
-- RLS: (select auth.uid()) for initPlan optimization
-- Partial index on niche+active for efficient mentor browsing

-- UP

CREATE TABLE mentor_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  niche TEXT NOT NULL,
  audience_size_range TEXT CHECK (audience_size_range IN ('0-1k', '1k-10k', '10k-100k', '100k+')),
  bio TEXT,
  max_mentees INT DEFAULT 3 CHECK (max_mentees BETWEEN 1 AND 10),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE mentorships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id UUID NOT NULL REFERENCES auth.users(id),
  mentee_id UUID NOT NULL REFERENCES auth.users(id),
  niche TEXT,
  goals JSONB DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'completed', 'declined')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT different_mentor_mentee CHECK (mentor_id != mentee_id)
);

-- RLS: mentor_profiles
ALTER TABLE mentor_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active mentors"
  ON mentor_profiles FOR SELECT USING (active = true);

CREATE POLICY "Creator manages own mentor profile"
  ON mentor_profiles FOR ALL USING (creator_id = (select auth.uid()));

-- RLS: mentorships
ALTER TABLE mentorships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view own mentorships"
  ON mentorships FOR SELECT USING (
    mentor_id = (select auth.uid()) OR mentee_id = (select auth.uid())
  );

CREATE POLICY "Mentee can request mentorship"
  ON mentorships FOR INSERT WITH CHECK (mentee_id = (select auth.uid()));

CREATE POLICY "Participants can update mentorship status"
  ON mentorships FOR UPDATE USING (
    mentor_id = (select auth.uid()) OR mentee_id = (select auth.uid())
  );

-- Indexes
-- Partial index for niche+active (active mentor browsing only)
CREATE INDEX idx_mentor_profiles_niche_active
  ON mentor_profiles(niche, active) WHERE active = true;

CREATE INDEX idx_mentorships_mentor ON mentorships(mentor_id);
CREATE INDEX idx_mentorships_mentee ON mentorships(mentee_id);
CREATE INDEX idx_mentorships_status ON mentorships(status);

-- DOWN (run in reverse order)
-- DROP TABLE IF EXISTS mentorships CASCADE;
-- DROP TABLE IF EXISTS mentor_profiles CASCADE;
