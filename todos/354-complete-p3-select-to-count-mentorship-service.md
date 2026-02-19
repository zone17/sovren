---
status: pending
priority: p3
issue_id: 354
tags: [code-review, performance]
---

# Select-to-count in MentorshipService — should use `head: true`

## Problem Statement

The MentorshipService fetches all rows from a query just to count them, transferring unnecessary data over the wire when Supabase natively supports count-only queries with `{ count: 'exact', head: true }`.

## Findings

- File: `packages/backend/src/services/community/MentorshipService.ts` (lines 138-144)
- Query fetches full row data, then uses `.length` or similar to get a count
- Supabase supports `{ count: 'exact', head: true }` which returns only the count without row data
- Wasted bandwidth and memory proportional to the number of rows

## Proposed Solutions

1. Replace the select query with `.select('*', { count: 'exact', head: true })` and read the count from the response
2. Use the count value directly instead of fetching and measuring the array

## Acceptance Criteria

- [ ] Query uses `{ count: 'exact', head: true }` instead of fetching all rows
- [ ] Count value is read from the Supabase response metadata
- [ ] No full row data is transferred for count-only operations
