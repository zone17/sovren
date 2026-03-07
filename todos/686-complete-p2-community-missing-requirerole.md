---
status: pending
priority: p2
issue_id: 686
tags: [code-review, security, routing, authorization]
dependencies: []
---

# /community route missing requireRole="creator"

## Problem Statement

The `/community` route in App.tsx uses `<ProtectedRoute>` but omits `requireRole="creator"`, unlike other creator routes (`/dashboard/*`, `/create`, `/business`). Additionally, there is no nav link for `/community` in Layout.tsx — the route is undiscoverable through normal navigation.

**Consensus: 2/8 agents flagged requireRole (Security, Architecture). 1/8 flagged missing nav link (Agent-Native).**

## Findings

- `packages/frontend/src/App.tsx:349` — `<ProtectedRoute>` without `requireRole`
- `packages/frontend/src/components/ui/Layout.tsx` — no nav entry for `/community`
- Other creator routes: `/dashboard/analytics`, `/dashboard/subscriptions`, `/dashboard/revenue`, `/create`, `/business` all have `requireRole="creator"`

## Proposed Solutions

### Option A: Add requireRole="creator" and nav link

- Pros: Consistent with other creator routes, discoverable
- Cons: None
- Effort: Small (2 lines)
- Risk: None

## Acceptance Criteria

- [ ] `/community` route has `requireRole="creator"`
- [ ] Nav link added in Layout.tsx for /community

## Work Log

| Date       | Action                                    | Learnings                        |
| ---------- | ----------------------------------------- | -------------------------------- |
| 2026-03-07 | Created from /workflows:review of PR #146 | Orphan route + missing role gate |
