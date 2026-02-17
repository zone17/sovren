---
status: pending
priority: p2
issue_id: "160"
tags: [code-review, pr-82, phase-7, authentication, hardcoded-values, frontend]
dependencies: []
---

# Hardcoded PLACEHOLDER_CREATOR_ID in ShieldDashboard

## Problem Statement
`ShieldDashboard.tsx` (line 7) has `const PLACEHOLDER_CREATOR_ID = 'current-creator'` hardcoded. This means the shield dashboard doesn't use the actual authenticated creator's ID.

## Findings
- `packages/frontend/src/features/content-shield/components/ShieldDashboard.tsx` line 7
- Used in all API calls from the shield dashboard
- Backend expects `req.user!.nostr_pubkey` — the placeholder doesn't match
- All shield dashboard API calls would fail or return empty data
- Flagged by: pattern-recognition-specialist, agent-native-reviewer

## Proposed Solutions
### Option 1: Use Auth Context (Recommended)
**Approach:** Import the auth context/hook and use the authenticated creator's ID. `const { user } = useAuth(); const creatorId = user?.nostr_pubkey;`
**Pros:** Correct behavior, follows existing patterns
**Cons:** None
**Effort:** 30 minutes
**Risk:** Low

## Technical Details
- `packages/frontend/src/features/content-shield/components/ShieldDashboard.tsx` line 7

## Acceptance Criteria
- [ ] Creator ID comes from auth context
- [ ] PLACEHOLDER_CREATOR_ID removed
- [ ] Shield dashboard API calls use real creator ID
- [ ] Unauthenticated state handled gracefully

## Resources
- **PR:** #82
- **Agents:** pattern-recognition-specialist, agent-native-reviewer

## Work Log
### 2026-02-14 - Discovery
**By:** Claude Code Review
Tags: authentication, hardcoded-values, frontend
