---
status: pending
priority: p2
issue_id: '620'
tags: [code-review, performance, frontend, content-shield]
dependencies: []
---

# P2: N+1 API Calls from AuthenticityBadge in ContentLibrary Lists

## Problem Statement

Each `AuthenticityBadge` fires its own `useProvenanceChain(contentId)` query. In a list of 20 published items, that's 20 parallel HTTP requests. At scale this creates a thundering herd on the API.

## Findings

- **Performance Oracle (#1)**: "20 requests per page view... multiplies the database connection pool pressure linearly"
- **Races Agent 1 (F6)**: "50 parallel HTTP requests... popcorn pattern"
- **Races Agent 2 (F5)**: "Thundering herd"
- **Consensus**: 3/6 agents

## Proposed Solutions

### Option A: Batch provenance endpoint (Recommended for future)

`POST /api/v2/shield/provenance/batch` accepting array of content IDs.

### Option B: Accept for MVP, document tech debt

With 2 mock items and `staleTime: 5min`, the impact is negligible. Defer to when real data is wired.

## Acceptance Criteria

- [ ] Decision documented (batch endpoint or accept for MVP)
- [ ] If deferred, TODO comment added in AuthenticityBadge

## Resources

- PR #132: https://github.com/zone17/sovren/pull/132
