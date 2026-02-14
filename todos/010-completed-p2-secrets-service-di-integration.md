---
status: completed
priority: p2
issue_id: 010
tags: [code-review, architecture]
dependencies: []
---

# SecretsService DI Container Integration

## Problem Statement

SecretsService manages its own singleton lifecycle outside the DI container. Config service reads process.env directly, bypassing AWS Secrets Manager integration.

## Findings

Architecture-strategist found no SecretsService token in TYPES, no binding module references it, bootstrap.ts Config wraps process.env directly. Security-sentinel also flagged this as the secret management flow is disconnected.

## Proposed Solutions

### Option A: Integrate SecretsService into DI Container

**Pros:** Proper dependency injection, testable secret management, enables AWS Secrets Manager in production
**Cons:** Requires refactoring Config service initialization order
**Effort:** Medium
**Risk:** Medium

## Technical Details

**Affected Files:**

- packages/backend/src/services/SecretsService.ts
- packages/backend/src/container/types.ts
- packages/backend/src/container/bootstrap.ts

## Acceptance Criteria

- [ ] SecretsService registered in DI container as singleton
- [ ] SecretsService initialized before Config service
- [ ] Config service delegates secret lookups to SecretsService
- [ ] AWS Secrets Manager accessible in production environment
- [ ] Tests verify proper DI initialization order
- [ ] Environment variable fallback still works for local development

## Work Log

- 2026-02-11: Created from /workflows:review multi-agent code review
