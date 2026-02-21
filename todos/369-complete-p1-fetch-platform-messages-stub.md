---
status: complete
priority: p1
issue_id: 369
tags:
  - code-review
  - broken-feature
  - pattern
dependencies: []
---

# fetchPlatformMessages() Is a Stub — Inbox Polling Non-Functional

## Problem Statement

fetchPlatformMessages() in InboxPollingService is a stub function that returns empty or throws. This means the inbox polling worker (BullMQ) runs but never actually fetches messages, making the entire adaptive polling feature non-functional. The polling infrastructure (queue, worker, scheduling) executes on every interval but produces zero results, wasting compute resources.

## Findings

**Source agents:** pattern-review, broken-feature-review

**Evidence:**

- File: `packages/backend/src/services/distribution/InboxPollingService.ts`
- Issue: fetchPlatformMessages() is a stub — either returns an empty array or throws a "not implemented" error. The BullMQ polling worker calls this function on every poll interval, consuming resources but never delivering messages. The entire adaptive polling pipeline (scheduling, backoff, processing) is wired up but produces no output.

## Proposed Solutions

### Option A: Implement platform message fetching

- **Approach:** Implement fetchPlatformMessages() to actually call platform APIs (e.g., Nostr relays, connected social platforms) using the platform's API client. Handle authentication, pagination, and error cases.
- **Effort:** Large
- **Risk:** Medium

### Option B: Disable polling until implementation is ready

- **Approach:** Add a clear TODO comment, disable the BullMQ worker registration so it doesn't consume resources, and add a feature flag to re-enable when the implementation is complete. Log a warning at startup indicating the feature is disabled.
- **Effort:** Small
- **Risk:** Low

## Recommended Action

_To be filled during triage_

## Technical Details

**Affected files:**

- `packages/backend/src/services/distribution/InboxPollingService.ts`

## Acceptance Criteria

- [ ] Either fetchPlatformMessages() returns real messages from connected platforms, OR the polling worker is disabled with clear documentation
- [ ] No silent failures — either functioning or explicitly disabled with startup log
- [ ] BullMQ worker does not consume resources for a non-functional feature
- [ ] If implemented: messages from connected platforms appear in the user's inbox
- [ ] If deferred: feature flag exists to re-enable when ready

## Work Log

| Date       | Action  | Notes                      |
| ---------- | ------- | -------------------------- |
| 2026-02-19 | Created | PR #86 code review finding |

## Resources

- PR: https://github.com/zone17/sovren/pull/86
