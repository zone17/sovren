---
status: complete
priority: p2
issue_id: '528'
tags: [code-review, typescript, security, api]
dependencies: []
---

# apiClient.ts: `as Promise<T>` trust boundary lacks runtime validation

## Problem Statement

`return response.json() as Promise<T>` casts untrusted server responses to the expected type with zero runtime validation. While this improves over the previous `Promise<any>`, it creates a false sense of type safety at a trust boundary (server → client).

**Consensus:** 4/8 agents flagged. Accepted as P2 because it's an improvement over the baseline and runtime Zod validation is planned in ADR-020.

## Findings

- `packages/frontend/src/services/api/apiClient.ts:115`
- Previous: `return response.json()` (returned `Promise<any>`)
- Current: `return response.json() as Promise<T>` (compile-time only assertion)
- ADR-020 already specifies Zod validation as the standard — this will be addressed during v2.0 API migration

## Proposed Solutions

### Option A: Defer to ADR-020 implementation (Recommended)

- ADR-020 mandates `validate()` with Zod schemas at API boundaries
- Will be addressed systematically during v2.0 Sprint 1-2
- **Effort:** None now
- **Risk:** Low — pre-existing condition

### Option B: Add optional schema parameter now

- Add `responseSchema?: z.ZodType<T>` to request() for critical paths (financial)
- **Effort:** Medium
- **Risk:** Low

## Acceptance Criteria

- [x] Decision: deferred to ADR-020 with explicit TODO comment at trust boundary
- [x] If deferred: TODO(ADR-020) comment added at apiClient.ts:115

## Work Log

| Date       | Action                                      | Learnings                           |
| ---------- | ------------------------------------------- | ----------------------------------- |
| 2026-02-26 | Created from 8-agent review (4/8 consensus) | ADR-020 will address systematically |
