---
status: pending
priority: p2
issue_id: 796
tags: [e2e, profile, playwright, journey-7]
dependencies: []
---

# Profile Management E2E Tests (Journey 7)

## Problem Statement
`/profile` route has a POM (`profile.page.ts`) but NO spec file. The profile page displays NOSTR pubkey, display name, and creator stats — none of which are E2E tested.

## Findings
- Route: `/profile` (protected)
- POM exists: `profile.page.ts`
- No spec: need `profile.auth.spec.ts`
- `creator-profile.auth.spec.ts` tests `/creator/:id` (other user's profile) with 8 tests — good
- `profile-dashboard.public.spec.ts` tests `/profile-dashboard` with 1 test — minimal
- Gherkin in `docs/plans/user-journey-gherkins.md` Journey 7

## Proposed Solutions

### Deliverables
1. `e2e/profile.auth.spec.ts` — 3-4 tests:
   - View own profile (heading, pubkey display, display name)
   - Profile shows NOSTR identity information
   - Creator stats visible on profile
   - Navigate to profile from nav bar

## Acceptance Criteria
- [ ] `profile.auth.spec.ts` exists with 3+ tests
- [ ] Profile heading and pubkey display assertions pass
- [ ] Tests use existing `profile.page.ts` POM

## Work Log
| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-09 | Created from user journey audit | POM exists, just needs spec |
