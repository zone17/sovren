---
status: pending
priority: p2
issue_id: "155"
tags: [code-review, pr-82, phase-7, performance, scalability, fingerprinting]
dependencies: []
---

# FingerprintService.compare() O(n) Linear Scan

## Problem Statement
`FingerprintService.compare()` (lines 147-158) loads ALL fingerprints and compares sequentially. As content grows, this becomes slower linearly.

## Findings
- Lines 147-158: Fetches all fingerprints, iterates and compares each
- No index on similarity, no prefiltering
- SimHash comparison is cheap per-item but N items is still O(n)
- At 100K fingerprints, each comparison request scans all 100K
- Flagged by: performance-oracle

## Proposed Solutions
### Option 1: Hamming Distance Index (Recommended)
**Approach:** Use Postgres bit operations with a GIN index on hash prefixes. Prefilter candidates with `WHERE hamming_distance(hash, target) < threshold` using indexed prefix matching.
**Pros:** Sublinear search, scales to millions
**Cons:** Requires understanding of Postgres bit indexing
**Effort:** 3-4 hours
**Risk:** Medium

### Option 2: Batch with Limit
**Approach:** Add pagination and time-window filtering to reduce scan size. Compare only fingerprints from last 30 days.
**Pros:** Simple, reduces scan size significantly
**Cons:** May miss older duplicates
**Effort:** 1 hour
**Risk:** Low

## Technical Details
- `packages/backend/src/services/provenance/FingerprintService.ts` lines 147-158

## Acceptance Criteria
- [ ] Comparison does not scan all fingerprints
- [ ] Performance is sublinear or bounded
- [ ] Similarity threshold still configurable

## Resources
- **PR:** #82
- **Agents:** performance-oracle

## Work Log
### 2026-02-14 - Discovery
**By:** Claude Code Review
Tags: performance, scalability, fingerprinting
