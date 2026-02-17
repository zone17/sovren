---
status: pending
priority: p3
issue_id: "212"
tags: [code-review, pr-85, database]
---

# Down Migrations Are Comments Only

## Problem Statement
All 6 migration files have rollback SQL as comments rather than executable down migration files. Manual intervention required for rollback.

## Findings
- Files: `supabase/migrations/20260216200*_epic009_*.sql` (all 6 files)
- Rollback SQL exists but is commented out within the up migration files
- No separate down migration files exist
- A rollback in production would require manual extraction and execution of the commented SQL

## Proposed Solutions
1. Document the rollback procedure in the deployment checklist (already done in `pr85-deployment-checklist.md`)
2. Create executable down migration scripts alongside each up migration for automated rollback capability

## Acceptance Criteria
- [ ] Rollback procedure is documented in deployment checklist with step-by-step instructions
- [ ] Each migration's rollback SQL is verified to correctly reverse the up migration
- [ ] Decision on whether to create executable down migration files is documented in an ADR
