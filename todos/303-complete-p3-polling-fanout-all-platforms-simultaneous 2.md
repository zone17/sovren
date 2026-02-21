---
status: complete
priority: p3
issue_id: '303'
tags: [code-review, performance, scalability]
dependencies: []
---

# Polling Fan-Out: All Platforms Polled Simultaneously

## Problem Statement

AdaptivePollingService polls all connected platforms for a user simultaneously. At scale (many users x many platforms), this creates burst traffic to external APIs, risking rate limits.

## Findings

- `packages/backend/src/services/inbox/AdaptivePollingService.ts` — polls all platforms in parallel
- No jitter or staggering between platform polls

## Proposed Solutions

### Option 1: Add jitter and staggering

**Approach:** Randomize poll timing with jitter. Use BullMQ's built-in delay/backoff to spread load.
**Effort:** 1h **Risk:** Low

## Acceptance Criteria

- [ ] Poll timing has random jitter
- [ ] Platforms staggered, not simultaneous
- [ ] External API rate limits respected

## Work Log

### 2026-02-18 - Code Review Discovery

**By:** Claude Code (13-agent parallel review)
