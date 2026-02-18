---
status: pending
priority: p3
issue_id: "211"
tags: [code-review, pr-85, dead-code]
---

# pollMessages() and snapshotMetrics() Unreachable via API

## Problem Statement
UnifiedInboxService.pollMessages() and CrossPlatformAnalyticsService.snapshotMetrics() have no routes. Code exists but is unreachable via API.

## Findings
- File: `packages/backend/src/services/distribution/UnifiedInboxService.ts` — `pollMessages()` has no route or job triggering it
- File: `packages/backend/src/services/distribution/CrossPlatformAnalyticsService.ts` — `snapshotMetrics()` has no route or job triggering it
- Both methods contain implemented logic but are never invoked from any route handler or scheduled task

## Proposed Solutions
1. Add scheduled BullMQ repeatable jobs to call these methods at appropriate intervals (e.g., pollMessages every 60s, snapshotMetrics every 5 minutes)
2. Add admin-only routes (e.g., POST /api/v2/admin/inbox/poll, POST /api/v2/admin/analytics/snapshot) behind authentication

## Acceptance Criteria
- [ ] Both methods are reachable via either scheduled jobs or admin routes
- [ ] If using scheduled jobs, job registration is documented and tested
- [ ] If using admin routes, routes are protected by authentication and admin authorization
