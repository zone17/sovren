---
status: pending
priority: p1
issue_id: '561'
tags: [code-review, pr-108, architecture]
---

# Replace manual error response with error middleware pattern

## Problem Statement

The discovery route manually constructs a 500 JSON response instead of throwing an error through the established `asyncHandler` + error middleware pipeline. This is the **only** v2 route that does this. The manual response is missing `metadata.requestId` and `metadata.timestamp`, making errors invisible to correlation tracking and observability (PR #103 monitoring baseline).

**Consensus: 4/9 agents flagged this (Pattern Recognition, Architecture, Git History, Performance Oracle)**

## Findings

- **File**: `packages/backend/src/routes/v2/discovery.routes.ts`, lines 91-97
- **Code**: `res.status(500).json({ success: false, error: '...', code: 'DISCOVERY_SEARCH_ERROR' })`
- **Pattern violation**: common-solutions.md #4 — "Never construct error responses manually"
- **Missing fields**: `metadata.requestId`, `metadata.timestamp`, `metadata.path`
- **All other v2 routes** throw errors and let middleware format them

## Proposed Solutions

**Option A: Throw typed error (Recommended)**

```typescript
if (error) {
  throw new DatabaseError(`Discovery search failed: ${error.message}`);
}
```

Pros: Consistent with every other route. Gets observability for free. Cons: Need to verify DatabaseError class exists.

**Option B: Use next(error)**

```typescript
if (error) {
  next(new Error('Failed to search creators'));
}
```

## Acceptance Criteria

- [ ] Error response uses centralized error middleware
- [ ] Error response includes `metadata.requestId` and `metadata.timestamp`
- [ ] Error is logged by the error middleware (visible in monitoring)
- [ ] Custom error code preserved if possible
