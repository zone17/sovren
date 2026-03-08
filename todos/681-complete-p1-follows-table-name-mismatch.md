---
status: pending
priority: p1
issue_id: '681'
tags: [code-review, backend, database, slice-8]
dependencies: []
---

# FollowService queries non-existent `follows` table — should be `followers`

## Problem Statement

Every Supabase query in `FollowService` targets `.from('follows')` but the actual database table is `followers` (confirmed in baseline migration line 126 and follow_count_trigger migration). All 7 methods fail at runtime with PostgREST 404/42P01.

**Agent consensus: 6/8** (Performance, Security, Pattern, Data Integrity, Architecture, Agent-native)

## Findings

- `FollowService.ts` lines 47, 95, 110, 132, 162, 187, 191 — all use `.from<FollowRow>('follows')`
- Baseline schema: `CREATE TABLE IF NOT EXISTS followers`
- Trigger migration: `AFTER INSERT OR DELETE ON followers`
- Unit tests don't catch this because mocks accept any string

## Proposed Solutions

### Solution A: Rename all callsites (Recommended)

- Replace `.from<FollowRow>('follows')` with `.from<FollowRow>('followers')` at all 7 locations
- **Effort:** Small (find-replace)
- **Risk:** None — matches DDL exactly

## Technical Details

**Affected files:**

- `packages/backend/src/services/community/FollowService.ts` (7 locations)

## Acceptance Criteria

- [ ] All `.from('follows')` replaced with `.from('followers')` in FollowService.ts
- [ ] `tsc --noEmit` passes for backend package
- [ ] Unit tests pass
