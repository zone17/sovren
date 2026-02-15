---
status: pending
priority: p3
issue_id: '034'
tags: [code-review, duplication, architecture]
dependencies: []
---

# Consolidate Sanitization, Logger, and Rotation Script Duplications

## Problem Statement

Three areas of significant duplication:

1. **Sensitive data sanitization** exists in 3 locations with different field lists:

   - `sentry.ts`: password, token, secret, private_key, nsec
   - `logger.ts`: 10 fields including credit_card, ssn
   - `error-handler-middleware.ts`: password, token, secret, apiKey, privateKey, signature, authorization

2. **Dual logger implementations**: `lib/logger.ts` (Winston, structured, correlation IDs) vs `utils/logger.ts` (raw console.\*). Code importing `utils/logger` loses all observability.

3. **Rotation scripts**: Same rotation logic in TypeScript, Python, AND Bash. Non-Vault and Vault variants are ~80% identical.

## Findings

- **pattern-recognition-specialist**: MEDIUM - sanitization duplication, logger duplication, 70% rotation duplication

## Proposed Solutions

1. Create shared `SENSITIVE_FIELDS` constant + pre-compiled regex
2. Deprecate `utils/logger.ts`, migrate all imports to `lib/logger.ts`
3. Pick one language for rotation, create base class with strategy pattern

**Effort**: Medium | **Risk**: Low

## Acceptance Criteria

- [ ] Single source of truth for sensitive field names
- [ ] No imports from `utils/logger`
- [ ] Rotation scripts consolidated to one implementation
