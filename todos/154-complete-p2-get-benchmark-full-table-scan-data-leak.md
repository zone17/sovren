---
status: pending
priority: p2
issue_id: "154"
tags: [code-review, pr-82, phase-7, performance, security, data-leak, full-table-scan]
dependencies: []
---

# getBenchmark() Full Table Scan and Data Leakage

## Problem Statement
`WellnessService.getBenchmark()` (lines 357-361) queries ALL creators' wellness data to calculate benchmarks. This is both a performance issue (full table scan) and a data leak (one creator's handler can access other creators' raw scores).

## Findings
- Lines 357-361: `supabase.from('wellness_snapshots').select('*')` — no WHERE clause
- Returns all creators' data to the requesting creator's service context
- Benchmark calculation happens in application code, not database
- As creator count grows, this becomes a linear scan of ALL data
- Individual scores may be derivable from benchmark data
- Flagged by: performance-oracle, security-sentinel, data-integrity-guardian

## Proposed Solutions
### Option 1: Precomputed Aggregate View (Recommended)
**Approach:** Create a materialized view or scheduled job that computes benchmarks periodically. Query only the aggregate, never raw data.
**Pros:** No access to individual data, O(1) query, scales to millions
**Cons:** Slightly stale data (acceptable for benchmarks)
**Effort:** 2-3 hours
**Risk:** Low

### Option 2: Database Aggregate Query
**Approach:** Use `SELECT AVG(score), STDDEV(score) FROM wellness_snapshots` — database computes aggregate, never returns individual rows.
**Pros:** Real-time, simple
**Cons:** Still scans all rows (though in DB, not app)
**Effort:** 1 hour
**Risk:** Low

## Technical Details
- `packages/backend/src/services/wellness/WellnessService.ts` lines 357-361

## Acceptance Criteria
- [ ] Benchmark query does not return individual creator data
- [ ] Query performance is O(1) or bounded
- [ ] RLS still enforced on underlying data

## Resources
- **PR:** #82
- **Agents:** performance-oracle, security-sentinel, data-integrity-guardian

## Work Log
### 2026-02-14 - Discovery
**By:** Claude Code Review
Tags: performance, security, data-leak, full-table-scan
