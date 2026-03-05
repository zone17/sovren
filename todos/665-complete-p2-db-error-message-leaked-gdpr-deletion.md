---
status: complete
priority: p2
issue_id: 665
tags: [code-review, security, information-leak, gdpr, wellness]
dependencies: []
---

## Problem Statement

The GDPR data deletion handler in WellnessService leaks raw Supabase error messages to the caller. These messages can contain internal database details such as table names, column names, constraint names, and the creator ID. This violates information disclosure best practices and could aid attackers in mapping the database schema.

## Findings

- **Reporter**: security-sentinel (1 agent)
- **File**: `packages/backend/src/services/wellness/WellnessService.ts:403`
- Raw `error.message` from Supabase is included in the thrown Error
- Error messages may contain PostgreSQL constraint names, table names, column names
- The creator ID is embedded in the error message string
- GDPR deletion is a sensitive operation where error details should not be exposed

## Proposed Solutions

1. **Log full error, throw generic message**: Log the complete Supabase error (including message, code, details) via the structured logger for debugging, then throw a generic error: `"GDPR data deletion failed. Contact support."` Include a correlation ID in the log for support traceability.

2. **Wrap in a domain-specific error class**: Create or reuse a `GdprDeletionError` that carries an internal error reference for logging but exposes only a safe message to callers. The error handler middleware strips internal details.

3. **Use error code mapping**: Map known Supabase error codes to user-safe messages (e.g., constraint violation -> "deletion blocked by dependent data") while logging full details. Falls back to generic message for unknown codes.

## Recommended Action

## Technical Details

- Line 403 in WellnessService.ts currently does something like: `throw new Error(\`GDPR deletion failed: ${error.message}\`)`
- The fix should:
  1. Log: `logger.error('GDPR deletion failed', { creatorId, error: error.message, code: error.code, details: error.details })`
  2. Throw: `throw new Error('GDPR data deletion failed. Contact support.')`
- Alternatively, use the project's custom error classes if a suitable one exists
- This pattern aligns with critical-patterns.md guidance on error information leakage

## Acceptance Criteria

- [ ] Raw Supabase error messages are not exposed in thrown errors
- [ ] Full error details are logged via structured logger with correlation context
- [ ] Thrown error contains only a generic, user-safe message
- [ ] Creator ID is not embedded in the thrown error message
- [ ] GDPR deletion still functions correctly for successful cases
- [ ] Existing tests pass; new test verifies error message is sanitized

## Work Log

## Resources

- `packages/backend/src/services/wellness/WellnessService.ts`
- common-solutions.md #61 (error cause sanitization)
