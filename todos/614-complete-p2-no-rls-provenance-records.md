---
status: pending
priority: p2
issue_id: '614'
tags: [code-review, security, database, content-shield, rls]
dependencies: []
---

# P2: No RLS Policies on provenance_records Table

## Problem Statement

The `provenance_records` table has no `ENABLE ROW LEVEL SECURITY` and no RLS policies anywhere in the codebase. While the backend uses the service role key (bypasses RLS), any future code using the authenticated role has unrestricted access to ALL provenance records.

## Findings

- **Security Sentinel (P1-002)**: "Any authenticated user can SELECT all provenance records, any authenticated user can INSERT records for any creator_id"
- Downgraded to P2: Backend currently uses service role key, so this is defense-in-depth not an active exploit.

## Proposed Solutions

Create a migration adding RLS policies:

```sql
ALTER TABLE provenance_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY provenance_records_creator_read ON provenance_records FOR SELECT TO authenticated USING (creator_id = auth.uid());
CREATE POLICY provenance_records_service_all ON provenance_records FOR ALL TO service_role USING (true);
```

## Acceptance Criteria

- [ ] RLS enabled on provenance_records
- [ ] Creator can only read own records via authenticated role
- [ ] Service role retains full access

## Resources

- PR #132: https://github.com/zone17/sovren/pull/132
