---
status: pending
priority: p2
issue_id: '563'
tags: [code-review, pr-108, frontend, ux]
---

# Fix "Load More" button to accumulate results instead of replacing

## Problem Statement

The "Load More" button calls `setPage(page + 1)` which changes the React Query key. The new page's data **replaces** page 1 data entirely. `keepPreviousData` only shows old data while fetching — once page 2 loads, page 1 creators disappear. This is standard pagination disguised as "Load More".

**Consensus: 6/9 agents flagged this.**

## Findings

- `useDiscovery.ts`: Returns `data?.data?.creators ?? []` — single page only
- `DiscoveryPage.tsx`: "Load More" button calls `setPage(page + 1)`
- Plan doc says "manual array accumulation for Load More" but implementation doesn't accumulate

## Proposed Solutions

**Option A: Use `useInfiniteQuery` (Recommended)**
TanStack Query's `useInfiniteQuery` is designed exactly for this — accumulates pages automatically.

**Option B: Rename to "Next Page" + add "Previous"**
Honest pagination UI. Simplest fix for Sprint 0.

**Option C: Remove Load More entirely for Sprint 0**
20-item limit is sufficient for MVP. Defer pagination to Sprint 1. Removes ~8 lines.

## Acceptance Criteria

- [ ] Clicking "Load More" shows page 1 + page 2 results (not just page 2)
- [ ] OR button renamed to "Next Page" with proper pagination controls
- [ ] Resetting filters clears accumulated results
