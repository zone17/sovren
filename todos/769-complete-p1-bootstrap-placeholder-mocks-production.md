---
status: pending
priority: p1
issue_id: 769
tags: [code-review, architecture, di, production-safety]
dependencies: []
---

# Bootstrap.ts Registers Placeholder Mocks in Production

## Problem Statement

bootstrap.ts (lines 242-338) registers placeholder mock implementations for Database, Elasticsearch, Lightning, NOSTR, and all repositories — in PRODUCTION. These mocks silently swallow operations that should fail loudly.

## Findings

- **Architecture Agent**: P1-02

## Proposed Solutions

1. Remove all placeholder registrations
2. Add environment guard — fail fast if required services not registered in production
3. Allow placeholders only in test/development environments

## Acceptance Criteria

- [ ] No placeholder/mock services registered in production
- [ ] Missing service registration throws at startup in production
- [ ] Development/test environments can still use placeholders
