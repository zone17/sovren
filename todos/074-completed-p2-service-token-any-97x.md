---
status: completed
priority: p2
issue_id: 074
tags: [code-review, typescript, type-safety, architecture]
dependencies: []
---

# 97 ServiceToken&lt;any&gt; in DI Container Defeats Type Safety

## Problem Statement

`packages/backend/src/container/types.ts` defines 97 `ServiceToken<any>` entries. Every service resolved from the container is typed as `any`, eliminating TypeScript's ability to catch misuse, wrong service injection, or API changes at compile time.

## Findings

- **TypeScript Quality P1-002**: Every ServiceToken uses `any`, making the entire DI container type-unsafe.
- **Architecture Strategist P2-005**: DI container type safety gap.

## Proposed Solutions

### Option A: Add proper generic types (Recommended)

Define each token with its service interface: `ServiceToken<UserProfileService>` instead of `ServiceToken<any>`.
**Pros:** Full type safety across DI, catches injection errors at compile time
**Cons:** Large changeset (97 tokens), need interface definitions for all services
**Effort:** Large | **Risk:** Low

### Option B: Incremental typed tokens

Start with critical services (auth, payment, content) and type those tokens first.
**Pros:** Delivers value incrementally
**Cons:** Partial type safety
**Effort:** Medium | **Risk:** Low

## Acceptance Criteria

- [ ] Critical service tokens (auth, payment, content) have proper types
- [ ] `any` count in container/types.ts reduced by at least 50%
- [ ] TypeScript catches wrong service injection at compile time
