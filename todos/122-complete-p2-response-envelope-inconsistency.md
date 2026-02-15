---
status: pending
priority: p2
issue_id: '122'
tags:
  - code-review
  - api
  - consistency
  - agent-native
dependencies: []
---

# 122: Response Envelope Inconsistency — ContentController Has metadata, Others Don't

## Problem Statement

ContentController returns `{ success, data, metadata: { requestId, timestamp, processingTime } }` (see ContentController.ts lines 89-118). PaymentController and UserController return only `{ success: true, data: {...} }` without metadata (see PaymentController.ts line 38, UserController.ts line 35). Machine clients cannot rely on consistent response shape for correlation/tracing.

## Findings

Response envelope inconsistency across controllers. ContentController includes rich metadata for agent-native clients, but Payment and User controllers don't. This breaks the predictability required for machine clients.

## Proposed Solutions

1. **Option A**: Add metadata envelope to Payment/UserController responses. Extract shared `createApiResponse()` helper. Effort: Small, Risk: Low.
2. **Option B**: Remove metadata from ContentController for consistency. Effort: Small, Risk: Medium (loses useful data).

## Acceptance Criteria

- [ ] All controllers use same response envelope
- [ ] requestId and processingTime available on all endpoints
- [ ] Shared `createApiResponse()` helper function
- [ ] Tests verify consistent envelope structure

## Work Log

| Date       | Action                                      | Learnings                                                        |
| ---------- | ------------------------------------------- | ---------------------------------------------------------------- |
| 2026-02-14 | Identified in code review round 6 of PR #73 | Inconsistent response envelopes break machine client assumptions |
