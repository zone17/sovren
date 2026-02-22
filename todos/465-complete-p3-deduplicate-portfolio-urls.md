---
status: pending
priority: p3
issue_id: 465
tags: [code-review, performance]
dependencies: []
---

# P3: Deduplicate portfolio URLs before SSRF validation

## Problem Statement

If a user submits duplicate portfolio URLs in `createListing`/`updateListing`, each duplicate triggers a redundant DNS lookup. A simple `new Set()` dedup before the `Promise.all` map would eliminate this.

## Findings

- No deduplication in either `createListing` (line 126) or `updateListing` (line 242)
- Redundant DNS lookups waste libuv thread pool resources

Source: Performance oracle (PR #93)

## Proposed Solutions

### Option A: Add Set dedup before validation

```typescript
const uniqueUrls = [...new Set(data.portfolioUrls)];
```

- Effort: Small (1 line)
- Risk: None

## Technical Details

- **Affected files**: `packages/backend/src/services/community/MarketplaceService.ts`

## Acceptance Criteria

- [ ] Duplicate URLs deduplicated before SSRF validation
- [ ] Applied in both `createListing` and `updateListing`

## Work Log

| Date       | Action                     | Learnings |
| ---------- | -------------------------- | --------- |
| 2026-02-21 | Created from PR #93 review |           |
