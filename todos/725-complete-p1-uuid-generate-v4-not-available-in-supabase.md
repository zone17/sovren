---
status: pending
priority: p1
issue_id: '725'
tags: [code-review, slice-8, backend, database, migration]
dependencies: []
---

# uuid_generate_v4() may not exist in Supabase (migration failure)

## Problem Statement

One or more migration files in `supabase/migrations/` use `uuid_generate_v4()` to generate UUIDs. This function requires the `uuid-ossp` PostgreSQL extension, which is not enabled by default in Supabase projects. Supabase provides `gen_random_uuid()` natively via the `pgcrypto` extension (always enabled). Migrations using `uuid_generate_v4()` will fail on fresh Supabase project creation or when replayed in CI with error: `"function uuid_generate_v4() does not exist"`.

**Agent consensus: migration failure**

## Findings

- `supabase/migrations/20260306000000_notifications.sql` (and potentially other migration files) contain calls to `uuid_generate_v4()`
- Supabase does not enable `uuid-ossp` by default in new projects
- The project's existing migrations use `gen_random_uuid()` — this is an inconsistency introduced in the Slice 8 migrations
- CI pipeline runs `supabase db reset` which replays all migrations from scratch; any `uuid_generate_v4()` call will break the pipeline on a fresh project

## Proposed Solutions

Replace all occurrences of `uuid_generate_v4()` with `gen_random_uuid()` in affected migration files:

```sql
-- Before (BROKEN on Supabase without uuid-ossp):
id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,

-- After (correct — uses pgcrypto which is always available):
id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
```

Also verify no other migration files (especially newly added ones in Slice 8) introduced `uuid_generate_v4()`.

If `uuid-ossp` is genuinely required for another reason, the alternative is to add `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";` at the top of the migration — but this is unnecessary since `gen_random_uuid()` is a direct drop-in replacement.

## Technical Details

- Affected file(s): `supabase/migrations/20260306000000_notifications.sql` (confirm exact count with grep)
- Run `grep -rn "uuid_generate_v4" supabase/migrations/` to find all occurrences
- `gen_random_uuid()` produces RFC 4122 compliant UUID v4 — identical output to `uuid_generate_v4()` for all practical purposes
- No application code changes needed — only the migration SQL files
- After fix, run `supabase db reset` locally to confirm all migrations apply cleanly

## Acceptance Criteria

- [ ] Zero occurrences of `uuid_generate_v4()` in any file under `supabase/migrations/`
- [ ] All replaced with `gen_random_uuid()`
- [ ] `supabase db reset` completes without errors on a fresh local project
- [ ] No `CREATE EXTENSION "uuid-ossp"` added (it is not needed)
- [ ] CI migration step (if present) passes on next run
