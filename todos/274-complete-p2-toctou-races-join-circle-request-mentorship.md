---
status: complete
priority: p2
issue_id: '274'
tags: [code-review, data-integrity, race-condition]
dependencies: []
---

# TOCTOU Races in joinCircle and requestMentorship

## Problem Statement

joinCircle checks member count then inserts (SELECT then INSERT). requestMentorship checks active mentorship count then inserts. Both are vulnerable to time-of-check-time-of-use races under concurrent requests, allowing limits to be exceeded.

## Findings

- `packages/backend/src/services/community/CreatorCircleService.ts` — joinCircle: count check then insert
- `packages/backend/src/services/community/MentorshipService.ts` — requestMentorship: count check then insert

## Proposed Solutions

### Option 1: Supabase RPC with SELECT FOR UPDATE

**Approach:** Wrap check+insert in a plpgsql function that locks the relevant row during the check. Ensures atomicity.
**Effort:** 2h **Risk:** Low

### Option 2: Unique constraint + catch duplicate

**Approach:** Add unique constraint on (circle_id, user_id) and (mentor_id, mentee_id), catch constraint violation errors.
**Effort:** 1h **Risk:** Low

## Acceptance Criteria

- [ ] Concurrent joinCircle cannot exceed member limit
- [ ] Concurrent requestMentorship cannot exceed active limit
- [ ] Race condition eliminated at DB level

## Work Log

### 2026-02-18 - Code Review Discovery

**By:** Claude Code (13-agent parallel review)
