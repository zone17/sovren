---
status: pending
priority: p2
issue_id: "159"
tags: [code-review, pr-82, phase-7, agent-native, api-coverage, frontend]
dependencies: []
---

# Missing Frontend API Methods for 5 Backend Endpoints

## Problem Statement
The frontend API service clients are missing methods for 5 backend endpoints, meaning agents and UI components cannot access these features. This reduces agent-native coverage to ~65%.

## Findings
- Missing from wellness API client: `getBenchmarks()`, `getResourceLibrary()`, `getPulseHistory()`
- Missing from shield API client: `getDmcaReports()`, `getProvenanceVerification()`
- Backend endpoints exist and work, frontend just has no way to call them
- Flagged by: agent-native-reviewer

## Proposed Solutions
### Option 1: Add Missing API Methods (Recommended)
**Approach:** Add the 5 missing methods to the frontend API service clients following the existing TanStack Query pattern.
**Pros:** Complete API coverage, agents can access all features
**Cons:** None
**Effort:** 1-2 hours
**Risk:** Low

## Technical Details
- `packages/frontend/src/features/wellness/services/wellnessApi.ts`
- `packages/frontend/src/features/content-shield/services/shieldApi.ts`

## Acceptance Criteria
- [ ] All 5 missing API methods added
- [ ] TanStack Query hooks created for each
- [ ] Methods match backend endpoint contracts
- [ ] Frontend coverage reaches 100% of backend endpoints

## Resources
- **PR:** #82
- **Agents:** agent-native-reviewer

## Work Log
### 2026-02-14 - Discovery
**By:** Claude Code Review
Tags: agent-native, api-coverage, frontend
