-- Migration: 20260220100000_epic010_creator_circles.sql
-- EPIC-010: Creator Network — Creator Circles, Members, and Posts
-- RLS: (select auth.uid()) for initPlan optimization (100x perf)
-- SECURITY DEFINER: get_user_circle_ids() prevents RLS recursion on circle_members self-lookup

-- UP

CREATE TABLE creator_circles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  niche TEXT,
  max_members INT DEFAULT 20 CHECK (max_members BETWEEN 5 AND 20),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE circle_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id UUID NOT NULL REFERENCES creator_circles(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(circle_id, creator_id)
);

-- Supabase-based messaging MVP for circle posts
-- (NIP-28 is public, NIP-29 needs specialized relay — Supabase for MVP)
CREATE TABLE circle_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id UUID NOT NULL REFERENCES creator_circles(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- SECURITY DEFINER function to avoid RLS recursion on circle_members self-lookup
-- Hardened: SET search_path = '' prevents search_path injection
CREATE OR REPLACE FUNCTION get_user_circle_ids(p_user_id UUID)
RETURNS SETOF UUID
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = '' AS $$
  SELECT circle_id FROM public.circle_members WHERE creator_id = p_user_id;
$$;

-- Harden: only authenticated users can call this function
REVOKE ALL ON FUNCTION get_user_circle_ids(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_user_circle_ids(UUID) TO authenticated;

-- RLS: creator_circles
ALTER TABLE creator_circles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Creators can view circles they belong to"
  ON creator_circles FOR SELECT USING (
    created_by = (select auth.uid())
    OR id IN (SELECT get_user_circle_ids((select auth.uid())))
  );

CREATE POLICY "Creator can create circles"
  ON creator_circles FOR INSERT WITH CHECK (created_by = (select auth.uid()));

CREATE POLICY "Circle admin can update"
  ON creator_circles FOR UPDATE USING (created_by = (select auth.uid()));

CREATE POLICY "Circle admin can delete"
  ON creator_circles FOR DELETE USING (created_by = (select auth.uid()));

-- RLS: circle_members
ALTER TABLE circle_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view circle membership"
  ON circle_members FOR SELECT USING (
    circle_id IN (SELECT get_user_circle_ids((select auth.uid())))
  );

CREATE POLICY "Circle admin can manage members"
  ON circle_members FOR ALL USING (
    circle_id IN (SELECT id FROM creator_circles WHERE created_by = (select auth.uid()))
  );

CREATE POLICY "Creator can join circles"
  ON circle_members FOR INSERT WITH CHECK (creator_id = (select auth.uid()));

-- RLS: circle_posts
ALTER TABLE circle_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Circle members can view posts"
  ON circle_posts FOR SELECT USING (
    circle_id IN (SELECT get_user_circle_ids((select auth.uid())))
  );

CREATE POLICY "Members can post to circles they belong to"
  ON circle_posts FOR INSERT WITH CHECK (
    author_id = (select auth.uid())
    AND circle_id IN (SELECT get_user_circle_ids((select auth.uid())))
  );

CREATE POLICY "Author can delete own posts"
  ON circle_posts FOR DELETE USING (author_id = (select auth.uid()));

-- Indexes
CREATE INDEX idx_circle_members_creator ON circle_members(creator_id);
CREATE INDEX idx_circle_members_circle ON circle_members(circle_id);
CREATE INDEX idx_circle_posts_circle_created ON circle_posts(circle_id, created_at DESC);
CREATE INDEX idx_creator_circles_niche ON creator_circles(niche) WHERE niche IS NOT NULL;
CREATE INDEX idx_creator_circles_created_by ON creator_circles(created_by);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_creator_circles_updated_at
  BEFORE UPDATE ON creator_circles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- DOWN (run in reverse order)
-- DROP TRIGGER IF EXISTS trg_creator_circles_updated_at ON creator_circles;
-- DROP TABLE IF EXISTS circle_posts CASCADE;
-- DROP TABLE IF EXISTS circle_members CASCADE;
-- DROP TABLE IF EXISTS creator_circles CASCADE;
-- DROP FUNCTION IF EXISTS get_user_circle_ids(UUID);
