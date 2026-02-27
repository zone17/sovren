---
status: pending
priority: p2
issue_id: '568'
tags: [code-review, pr-108, architecture]
dependencies: []
---

# Extract discovery query logic into service layer

## Problem Statement

The route handler contains ~90 lines of query building, data transformation, and error handling inline. Every other v2 route delegates to a DI-resolved service. This makes the business logic untestable without hitting the database and inconsistent with the codebase architecture.

**Consensus: 3/9 agents (Architecture, Pattern Recognition, Simplicity noted acceptable for Sprint 0)**

## Findings

- `discovery.routes.ts`, lines 33-123: all logic inline
- `wellness.routes.ts` pattern: `getWellnessService().recordWorkPattern()`
- Plan doc says "no new service class needed" as architectural decision
- Sprint 1 features (personalized results, featured creators) will bloat this further

## Proposed Solutions

**Option A: Defer to Sprint 1 (Recommended)**
Accept tech debt for Sprint 0. Create tracked issue for Sprint 1 extraction.

**Option B: Extract minimal DiscoveryService now**
Move query building + mapping into `DiscoveryService.searchCreators()`.

## Acceptance Criteria

- [ ] If deferred: tracked issue created for Sprint 1
- [ ] If extracted: service registered in DI container, route delegates to service
