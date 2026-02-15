---
status: pending
priority: p3
issue_id: '133'
tags:
  - code-review
  - data-integrity
  - content
dependencies: []
---

# 133: Scheduled Content Publish Jobs Stored In-Memory Only

## Problem Statement

`ContentPublishingService.ts` (lines 293-299) stores scheduled publish jobs in an in-memory Map with setTimeout. Content status is 'scheduled' in the database, but on restart, all scheduled jobs are lost — content stays permanently in 'scheduled' status without ever publishing.

## Findings

- Lines 293-299 implement scheduled publishing with in-memory Map and setTimeout
- Database records content status as 'scheduled'
- Process restart loses all scheduled job timers
- Content stuck in 'scheduled' state indefinitely after restart
- No recovery mechanism for lost scheduled jobs

## Proposed Solutions

**Option A: Startup Routine for Pending Jobs**

- Add startup routine that queries `content_schedule` for future jobs and re-registers them
- Effort: Small
- Risk: Low
- Benefit: Simple solution, maintains current architecture

**Option B: Use Proper Job Queue**

- Use a proper job queue (Bull, Agenda)
- Effort: Medium
- Risk: Low
- Benefit: Production-grade reliability, persistent job storage, retry logic

## Acceptance Criteria

- [ ] Scheduled publishes survive process restart
- [ ] Startup re-registers pending scheduled jobs
- [ ] No content permanently stuck in 'scheduled' status
- [ ] All scheduled jobs execute at their designated time even after restart

## Work Log

| Date       | Action                                      | Learnings                                                                                                   |
| ---------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 2026-02-14 | Identified in code review round 6 of PR #73 | In-memory job storage loses scheduled publishes on restart; need persistent job queue or recovery mechanism |
