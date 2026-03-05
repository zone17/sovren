---
status: pending
priority: p2
issue_id: '630'
tags: [code-review, backend, yagni, simplicity]
dependencies: []
---

# Unused callerPubkey parameter in listComments (YAGNI)

## Problem Statement

`listComments` in `CommentsService.ts` line 132 accepts `callerPubkey: string | null` but never uses it. The parameter is threaded through the interface, service, route, and tests but has no effect.

## Findings

- Architecture Strategist, Pattern-Recognition, and Simplicity agents all flagged (3/8 consensus)

## Proposed Solutions

### Option A: Remove parameter (Recommended)

Remove from ICommentsService, CommentsService, and route. Add when needed.

- Effort: Small

## Acceptance Criteria

- [ ] callerPubkey removed from listComments signature, interface, and route call
