---
status: pending
priority: p2
issue_id: 798
tags: [e2e, agent-native, auth, api, playwright, journey-15]
dependencies: [790]
---

# Agent Auth Flow API E2E Tests (Journey 15)

## Problem Statement
No programmatic auth flow test exists. Agents need to authenticate via NOSTR challenge-response, and this flow has zero E2E coverage.

## Findings
- Depends on: #790 (API project in playwright config)
- Auth flow: POST /api/auth/challenge → POST /api/auth/authenticate
- Require `USE_BACKEND=1`
- Also test: /health, /ready, /live endpoints
- Gherkin in `docs/plans/user-journey-gherkins.md` Journey 15

## Proposed Solutions

### Deliverables
1. `e2e/agent-auth.api.spec.ts` — 4-6 tests:
   - Challenge-response auth flow
   - Token works for subsequent API calls
   - 401 for expired/invalid token
   - Health endpoint accessible
   - Ready endpoint accessible
   - Live endpoint accessible

## Acceptance Criteria
- [ ] `agent-auth.api.spec.ts` exists with 4+ tests
- [ ] Challenge-response flow works end-to-end
- [ ] Health/ready/live endpoints return 200

## Work Log
| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-09 | Created from user journey audit | Agent auth path |
