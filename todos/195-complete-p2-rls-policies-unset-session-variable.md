---
status: pending
priority: p2
issue_id: "195"
tags: [code-review, pr-85, security]
---

# RLS Policies Reference Unset Session Variable

## Problem Statement
RLS policies use `current_setting('app.current_user_id', true)` but the backend never calls `set_config` to set this value. Either RLS is bypassed (service role key) or all queries return zero rows (anon key).

## Findings
- **Files**: All 5 `supabase/migrations/20260216200*_epic009_*.sql` migration files
- **File**: `packages/backend/src/config/database.ts`
- RLS policies across all Epic 009 tables rely on `current_setting('app.current_user_id', true)` to scope row access
- The backend Supabase client configuration in `database.ts` never sets this session variable via `set_config('app.current_user_id', ...)` or Supabase client headers
- If using the service role key, RLS is bypassed entirely (no row-level security)
- If using the anon key, `current_setting` returns NULL (the `true` flag suppresses errors), causing all equality checks to fail and returning zero rows

## Proposed Solutions
1. Set `app.current_user_id` via Supabase client headers per request using the authenticated user's ID from the JWT, ensuring RLS policies actually filter correctly
2. Switch RLS policies from `current_setting('app.current_user_id', true)` to `auth.uid()` which is natively set by Supabase Auth and requires no manual configuration

## Acceptance Criteria
- [ ] RLS policies correctly filter rows to the authenticated user
- [ ] Queries using the anon key return the correct user-scoped rows (not zero rows)
- [ ] Service role key usage is limited to admin/system operations only
- [ ] Integration test confirms user A cannot read user B's rows
