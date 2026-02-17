---
status: pending
priority: p3
issue_id: "170"
tags: [code-review, pr-82, phase-7, security, validation, input-size]
dependencies: []
---

# Unbounded Metadata Objects in Wellness and Shield Endpoints

## Problem Statement
Several endpoints accept `metadata` or `additional_data` JSON fields with no size limit on the Zod schema. An attacker could send a massive JSON payload.

## Findings
- Zod schemas validate type but not size of metadata fields
- `z.record(z.unknown())` or `z.object({}).passthrough()` patterns
- Could be used for storage abuse or DoS
- Flagged by: security-sentinel

## Proposed Solutions
### Option 1: Add Size Limits
**Approach:** Add `.refine(obj => JSON.stringify(obj).length < 10000)` to metadata Zod schemas.
**Effort:** 30 minutes | **Risk:** Low

## Technical Details
- `packages/backend/src/validators/wellness.validators.ts`
- `packages/backend/src/validators/shield.validators.ts`

## Acceptance Criteria
- [ ] Metadata fields have max size limit
- [ ] Oversized payloads rejected with 400

## Work Log
### 2026-02-14 - Discovery
**By:** Claude Code Review
Tags: security, validation, input-size
