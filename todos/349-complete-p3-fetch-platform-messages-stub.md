---
status: pending
priority: p3
issue_id: 349
tags: [code-review, dead-code]
---

# `fetchPlatformMessages()` stub returns empty array

## Problem Statement

The `fetchPlatformMessages()` method is a stub that always returns an empty array, but BullMQ polling jobs actively call it. The entire polling infrastructure exists (queue setup, worker, scheduled jobs) but produces no results because the core fetch function is unimplemented.

## Findings

- File: `packages/backend/src/services/distribution/InboxPollingService.ts`
- `fetchPlatformMessages()` returns `[]` unconditionally
- BullMQ jobs are scheduled and run, consuming resources for no effect
- Polling infrastructure (queue, worker, cron) is fully wired up but functionally dead

## Proposed Solutions

1. **Implement**: Add actual platform API calls to fetch messages from connected platforms
2. **Remove**: If inbox polling is not on the roadmap, remove the entire polling infrastructure (queue, worker, scheduled jobs, service method) to reduce dead code and resource waste

## Acceptance Criteria

- [ ] Either `fetchPlatformMessages()` makes real API calls and returns messages, OR the entire polling infrastructure is removed
- [ ] No BullMQ jobs run for a no-op function
- [ ] If implemented, add tests for the fetch logic; if removed, verify no orphaned references
