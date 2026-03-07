---
status: pending
priority: p1
issue_id: '724'
tags: [code-review, slice-8, backend, database, migration, community]
dependencies: []
---

# Missing create_circle_atomic RPC function (runtime failure)

## Problem Statement

`CreatorCircleService` calls `supabase.rpc('create_circle_atomic', ...)` to atomically create a circle and add the creator as the first member. However, no migration defines this PostgreSQL function. Circle creation will fail at runtime with a PostgREST error such as `"function create_circle_atomic() does not exist"` for every user attempting to create a circle.

**Agent consensus: runtime failure**

## Findings

- `services/community/CreatorCircleService.ts` contains a `.rpc('create_circle_atomic', ...)` call
- Searching all files in `supabase/migrations/` finds no `CREATE FUNCTION create_circle_atomic` definition
- The function is not defined in `supabase/migrations/20260306000000_notifications.sql` or any other migration file
- This is a complete blocker for the circle creation flow — no circles can be created until the function exists in the database

## Proposed Solutions

Create a new migration file that defines the `create_circle_atomic` PostgreSQL function:

```sql
-- supabase/migrations/20260307000001_create_circle_atomic.sql

CREATE OR REPLACE FUNCTION create_circle_atomic(
  p_name        TEXT,
  p_description TEXT,
  p_niche       TEXT,
  p_creator_id  UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_circle_id UUID;
  v_result    JSONB;
BEGIN
  -- Insert the circle
  INSERT INTO creator_circles (name, description, niche, created_by)
  VALUES (p_name, p_description, p_niche, p_creator_id)
  RETURNING id INTO v_circle_id;

  -- Add creator as first active member
  INSERT INTO circle_members (circle_id, user_id, status, role)
  VALUES (v_circle_id, p_creator_id, 'active', 'owner');

  -- Return the created circle data
  SELECT to_jsonb(c) INTO v_result
  FROM creator_circles c
  WHERE c.id = v_circle_id;

  RETURN v_result;

EXCEPTION WHEN OTHERS THEN
  RAISE; -- Let Supabase/PostgREST surface the error
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION create_circle_atomic(TEXT, TEXT, TEXT, UUID) TO authenticated;
```

Key requirements:

- Use `SECURITY DEFINER` so the function runs with the definer's privileges (required for atomic multi-table inserts that bypass per-table RLS)
- Wrap in a transaction (implicit in `plpgsql` functions)
- Grant `EXECUTE` to `authenticated` role

## Technical Details

- New migration file should be created at: `supabase/migrations/20260307000001_create_circle_atomic.sql` (adjust timestamp to be after existing migrations)
- The function signature must exactly match what `CreatorCircleService.ts` passes to `.rpc()`
- Verify parameter names in the service call before writing the migration
- `SECURITY DEFINER` functions must not leak data — add a `SET search_path = public, pg_temp` line to prevent search_path injection
- After creating the migration, apply it to the local Supabase instance: `supabase db reset` or `supabase migration up`

## Acceptance Criteria

- [ ] A migration file exists that defines `create_circle_atomic` with the correct parameter signature
- [ ] Function uses `SECURITY DEFINER` with `SET search_path = public, pg_temp`
- [ ] Function atomically inserts into `creator_circles` AND `circle_members` in a single transaction
- [ ] `GRANT EXECUTE` to `authenticated` role is included in the migration
- [ ] Migration is idempotent: uses `CREATE OR REPLACE FUNCTION`
- [ ] `supabase db reset` completes without errors after adding the migration
- [ ] Integration test or manual test confirms circle creation no longer throws "function does not exist"
